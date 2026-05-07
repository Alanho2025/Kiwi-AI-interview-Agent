import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMicrophonePermission } from './useMicrophonePermission.js';
import { useRealtimeMicStream } from './voice/useRealtimeMicStream.js';
import { useVoiceActivityDetection } from './voice/useVoiceActivityDetection.js';
import { useDuplexVoiceSocket } from './voice/useDuplexVoiceSocket.js';
import { useAssistantAudioQueue } from './voice/useAssistantAudioQueue.js';
import { useSessionAudioRecorder } from './voice/useSessionAudioRecorder.js';
import { uploadSessionRecording } from '../api/recordingApi.js';
import { createVoiceLatencyTrace } from '../utils/voiceLatencyTrace.js';
import { buildVoiceLatencyDebugSummary, buildVoiceLatencyTargetSummary } from '../utils/voiceLatencySummary.js';
import { DEFAULT_VAD_CONFIG } from '../utils/voiceActivityDetectionCore.js';
import { assessVoiceNetworkQuality } from '../utils/voiceRuntimeNetwork.js';
import { cancelLatencyAcknowledgement, playLatencyAcknowledgement } from '../utils/voiceLatencyAcknowledgement.js';

const DEFAULT_VOICE_NAME = 'en-NZ-MollyNeural';
const DEFAULT_LANGUAGE = 'en-NZ';
const MIC_ARM_DELAY_MS = 350;
const VAD_WARMUP_IGNORE_MS = 500;
const SLOW_PROCESSING_WARNING_MS = 8000;
const NETWORK_PING_INTERVAL_MS = 6000;
const SLOW_FIRST_AUDIO_MS = 3500;
const LATENCY_ACK_DELAY_MS = 650;
const LATENCY_ACK_COOLDOWN_MS = 16000;

const buildVoiceStatus = (type, title, message) => ({ type, title, message });

export const formatDurationLabel = (valueMs = 0) => {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const getLatestTurnByRole = (transcript = [], role) => {
  const filteredTurns = transcript.filter((message) => message.role === role);
  return filteredTurns[filteredTurns.length - 1] || null;
};

export const resolveSessionId = (session, explicitSessionId) => explicitSessionId || session?.id || session?._id || session?.sessionId || '';

export function useVoiceInterviewSession({
  enabled = true,
  session,
  sessionId,
  onPause,
  onRepeat,
  onEnd,
  isPaused,
  isCompleted,
  isSubmitting,
  onVoiceSessionUpdate,
  onStartInterview,
}) {
  const {
    permissionState,
    isRequesting,
    error: permissionError,
    requestPermission,
    isSupported,
  } = useMicrophonePermission();

  const [voiceState, setVoiceState] = useState('idle');
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [transcriptionPreview, setTranscriptionPreview] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState(null);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [lastAsrConfidence, setLastAsrConfidence] = useState(null);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [isVoiceTakingLong, setIsVoiceTakingLong] = useState(false);
  const [isAutoLoopActive, setIsAutoLoopActive] = useState(false);
  const [assistantTextPreview, setAssistantTextPreview] = useState('');
  const [recordingStatus, setRecordingStatus] = useState({ state: 'idle', error: null });
  const [lastTranscriptRejection, setLastTranscriptRejection] = useState(null);
  const [voiceNetworkQuality, setVoiceNetworkQuality] = useState(() => assessVoiceNetworkQuality());

  const autoLoopActiveRef = useRef(false);
  const voiceSessionTraceRef = useRef(null);
  const activeVoiceTurnTraceRef = useRef(null);
  const activeBackendLatencyRef = useRef(null);
  const voiceTurnSequenceRef = useRef(0);
  const vadMetricsRef = useRef(null);
  const latestSocketLatencyRef = useRef({});
  const firstAudioChunkSeenRef = useRef(false);
  const activeVoiceTurnStartedAtRef = useRef(null);
  const latestFirstAudioDelayRef = useRef(null);
  const consecutiveSlowTurnsRef = useRef(0);
  const latencyAcknowledgementTimerRef = useRef(null);
  const lastLatencyAcknowledgementAtRef = useRef(0);
  const noSpeechPromptedRef = useRef(false);
  const completedCleanupDoneRef = useRef(false);
  const startListeningRef = useRef(null);
  const cleanupRef = useRef(null);
  const isAssistantSpeakingRef = useRef(false);
  const sessionAudioRecorder = useSessionAudioRecorder();

  const activeSessionId = resolveSessionId(session, sessionId);
  const currentQuestion = useMemo(() => getLatestTurnByRole(session?.transcript || [], 'ai'), [session?.transcript]);
  const latestUserTurn = useMemo(() => getLatestTurnByRole(session?.transcript || [], 'user'), [session?.transcript]);

  const getLatestAssistantQuestionText = useCallback((sourceSession = session, preferDisplayText = true) => {
    const latestQuestion = getLatestTurnByRole(sourceSession?.transcript || [], 'ai');
    const displayText = String(latestQuestion?.displayText || '').trim();
    const rawText = String(latestQuestion?.text || '').trim();
    return preferDisplayText ? (displayText || rawText) : (rawText || displayText);
  }, [session]);


  const setReadyState = useCallback(() => {
    if (!enabled) return;
    setVoiceState('ready');
    setVoiceStatus(buildVoiceStatus('success', 'Voice ready', 'Duplex Voice Agent is ready. KiwiCoach can listen, speak, and handle interruption.'));
  }, [enabled]);

  const logVoiceLatencySummary = useCallback((phase = 'turn', backendLatency = null) => {
    const trace = activeVoiceTurnTraceRef.current?.toJSON?.();
    if (!trace && !backendLatency) return;

    const targetSummary = buildVoiceLatencyTargetSummary({ trace, backendLatency, phase });
    const debugSummary = buildVoiceLatencyDebugSummary({ trace, backendLatency, phase });

    console.info('[voice-latency] target', targetSummary);
    console.debug('[voice-latency:debug]', debugSummary);
    if (typeof console.table === 'function') {
      console.table(targetSummary);
    }
  }, []);

  const startVoiceTurnTrace = useCallback((reason = 'vad_speech_end') => {
    voiceTurnSequenceRef.current += 1;
    const turnId = `voice-turn-${voiceTurnSequenceRef.current}`;
    const trace = createVoiceLatencyTrace({
      sessionId: activeSessionId,
      mode: 'duplex_voice',
      traceType: 'voice_turn',
      target: 'speech_end_to_ai_speech_start',
      turnId,
    });

    activeVoiceTurnTraceRef.current = trace;
    activeBackendLatencyRef.current = null;
    firstAudioChunkSeenRef.current = false;
    activeVoiceTurnStartedAtRef.current = performance.now();
    trace.mark('vad_config', { ...DEFAULT_VAD_CONFIG, warmupIgnoreMs: VAD_WARMUP_IGNORE_MS, turnId });
    trace.mark('vad_speech_end', { reason, turnId });
    return { trace, turnId };
  }, [activeSessionId]);

  const updateVoiceNetworkQuality = useCallback((overrides = {}) => {
    const socketLatency = latestSocketLatencyRef.current || {};
    setVoiceNetworkQuality(assessVoiceNetworkQuality({
      rttMs: socketLatency.networkRttMs,
      jitterMs: socketLatency.networkJitterMs,
      socketOpenMs: socketLatency.socketOpenMs,
      firstAudioDelayMs: latestFirstAudioDelayRef.current,
      consecutiveSlowTurns: consecutiveSlowTurnsRef.current,
      ...overrides,
    }));
  }, []);

  const clearLatencyAcknowledgementTimer = useCallback(() => {
    if (latencyAcknowledgementTimerRef.current) {
      window.clearTimeout(latencyAcknowledgementTimerRef.current);
      latencyAcknowledgementTimerRef.current = null;
    }
  }, []);

  const stopLatencyAcknowledgement = useCallback(() => {
    clearLatencyAcknowledgementTimer();
    cancelLatencyAcknowledgement();
  }, [clearLatencyAcknowledgementTimer]);

  const scheduleLatencyAcknowledgement = useCallback(() => {
    clearLatencyAcknowledgementTimer();
    latencyAcknowledgementTimerRef.current = window.setTimeout(() => {
      const now = Date.now();
      const recentlyPlayed = now - lastLatencyAcknowledgementAtRef.current < LATENCY_ACK_COOLDOWN_MS;
      if (
        recentlyPlayed ||
        !autoLoopActiveRef.current ||
        firstAudioChunkSeenRef.current
      ) {
        return;
      }

      const played = playLatencyAcknowledgement({ index: voiceTurnSequenceRef.current });
      if (played) lastLatencyAcknowledgementAtRef.current = now;
    }, LATENCY_ACK_DELAY_MS);
  }, [clearLatencyAcknowledgementTimer]);


  const audioQueue = useAssistantAudioQueue({
    onPlaybackStart: () => {
      stopLatencyAcknowledgement();
      isAssistantSpeakingRef.current = true;
      activeVoiceTurnTraceRef.current?.mark('assistant_audio_play_start');
      if (activeVoiceTurnTraceRef.current) logVoiceLatencySummary('assistant_playback_start', activeBackendLatencyRef.current);
      setVoiceState('ai_speaking');
      setVoiceStatus(buildVoiceStatus('success', 'KiwiCoach is speaking', 'You can interrupt naturally by speaking.'));
    },
    onPlaybackEnd: () => {
      activeVoiceTurnTraceRef.current?.mark('assistant_audio_play_end');
    },
    onQueueDrained: () => {
      isAssistantSpeakingRef.current = false;
      if (autoLoopActiveRef.current && !isPaused && !isCompleted && !isProcessingTurn) {
        window.setTimeout(() => startListeningRef.current?.(), MIC_ARM_DELAY_MS);
      } else if (!isPaused && !isCompleted) {
        setReadyState();
      }
    },
    onPlaybackError: (message) => {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Audio playback blocked', message));
    },
  });


  const duplexSocket = useDuplexVoiceSocket({
    onAudioChunk: (chunk) => {
      stopLatencyAcknowledgement();
      if (!firstAudioChunkSeenRef.current) {
        firstAudioChunkSeenRef.current = true;
        const firstAudioDelayMs = activeVoiceTurnStartedAtRef.current
          ? Math.round(performance.now() - activeVoiceTurnStartedAtRef.current)
          : null;
        latestFirstAudioDelayRef.current = firstAudioDelayMs;
        consecutiveSlowTurnsRef.current = firstAudioDelayMs > SLOW_FIRST_AUDIO_MS
          ? consecutiveSlowTurnsRef.current + 1
          : 0;
        updateVoiceNetworkQuality({ firstAudioDelayMs, consecutiveSlowTurns: consecutiveSlowTurnsRef.current });
        activeVoiceTurnTraceRef.current?.mark('first_audio_chunk_received', { index: chunk.index });
      }
      activeVoiceTurnTraceRef.current?.mark('tts_audio_chunk_received', { index: chunk.index });
      audioQueue.enqueueAudioChunk(chunk);
    },
    onAssistantText: (payload) => {
      setAssistantTextPreview((current) => `${current}${payload.text || ''}`);
    },
    onSpeechDone: () => {
      setIsProcessingTurn(false);
    },
    onTranscriptRejected: (payload) => {
      stopLatencyAcknowledgement();
      setIsProcessingTurn(false);
      setIsVoiceTakingLong(false);
      setPendingTranscript(null);
      setEditableTranscript('');
      setLastAsrConfidence(payload?.transcription?.confidence ?? null);
      setLastTranscriptRejection(payload);
      setVoiceState('repair_prompt');
      setVoiceStatus(buildVoiceStatus('warning', 'Voice did not catch that clearly', payload?.message || 'Please answer again so KiwiCoach can score the right content.'));
    },
    onTurnDone: (payload) => {
      stopLatencyAcknowledgement();
      activeVoiceTurnTraceRef.current?.mark('auto_submit_response');
      setIsProcessingTurn(false);
      setIsVoiceTakingLong(false);
      setLastTranscriptRejection(null);
      activeBackendLatencyRef.current = payload?.latency || null;
      logVoiceLatencySummary('duplex_turn_done', activeBackendLatencyRef.current);
      if (payload?.session) onVoiceSessionUpdate?.(payload.session);
      if (payload?.transcription?.text) {
        const transcript = {
          displayText: payload.transcription.text,
          normalizedText: payload.transcription.text,
          rawText: payload.transcription.text,
          confidence: payload.transcription.confidence ?? null,
          confidenceStatus: payload.transcription.confidence != null ? `${Math.round(payload.transcription.confidence * 100)}%` : 'unknown',
        };
        setPendingTranscript(transcript);
        setEditableTranscript(transcript.displayText);
        setLastAsrConfidence(payload.transcription.confidence ?? null);
      }
      if (payload?.isComplete) {
        autoLoopActiveRef.current = false;
        setIsAutoLoopActive(false);
        setVoiceState('ready');
        setVoiceStatus(buildVoiceStatus('success', 'Interview completed', 'The planned voice interview is complete.'));
      }
    },
    onBargeInAck: () => {
      voiceSessionTraceRef.current?.mark('barge_in_ack');
      setVoiceStatus(buildVoiceStatus('info', 'Interrupted', 'KiwiCoach stopped speaking and is listening to you.'));
    },
  });

  const realtimeMic = useRealtimeMicStream({ onAudioChunk: duplexSocket.sendAudioChunk });

  const stopListening = useCallback(async (reason = 'speech_end') => {
    const { turnId } = startVoiceTurnTrace(reason);
    activeVoiceTurnTraceRef.current?.mark('auto_submit_start', { reason, turnId });
    activeVoiceTurnTraceRef.current?.mark('stt_stop_sent', { reason, turnId });
    vad.stopVad?.();
    duplexSocket.sendSpeechEnd(vadMetricsRef.current || null);
    realtimeMic.setSendAudio?.(false);
    setIsProcessingTurn(true);
    setVoiceState('agent_thinking');
    setVoiceStatus(buildVoiceStatus('info', 'Processing your answer', 'KiwiCoach is preparing the next turn. This may take a few seconds.'));
    scheduleLatencyAcknowledgement();

    if (realtimeMic.mediaStream && autoLoopActiveRef.current) {
      await vad.startVad({ stream: realtimeMic.mediaStream, ignoreFirstMs: VAD_WARMUP_IGNORE_MS });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSocket, realtimeMic, scheduleLatencyAcknowledgement, startVoiceTurnTrace]);

  const handleVadSpeechStart = useCallback((metrics = {}) => {
    stopLatencyAcknowledgement();
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };
    voiceSessionTraceRef.current?.mark('vad_speech_start', metrics);
    realtimeMic.setSendAudio?.(true);
    duplexSocket.sendSpeechStart();

    if (isAssistantSpeakingRef.current) {
      audioQueue.clearQueue();
      duplexSocket.sendBargeIn('user_started_speaking');
      setVoiceState('interrupted');
      setVoiceStatus(buildVoiceStatus('info', 'Interrupting KiwiCoach', 'Your voice interrupted the assistant. Keep speaking.'));
    } else {
      setVoiceState('user_speaking');
      setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Keep answering naturally. KiwiCoach will stop when you pause.'));
    }
  }, [audioQueue, duplexSocket, realtimeMic, stopLatencyAcknowledgement]);

  const handleVadSpeechEnd = useCallback(async (metrics = {}) => {
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };
    await stopListening('vad_speech_end');
  }, [stopListening]);

  const handleNoSpeechTimeout = useCallback(() => {
    if (!autoLoopActiveRef.current || noSpeechPromptedRef.current) return;
    noSpeechPromptedRef.current = true;
    setVoiceStatus(buildVoiceStatus('info', 'Take your time', 'Start answering when you are ready.'));
  }, []);

  const handleMaxAnswerTimeout = useCallback(async (metrics = {}) => {
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics, maxAnswerTimeout: true };
    await stopListening('vad_max_answer_timeout');
  }, [stopListening]);

  const vad = useVoiceActivityDetection({
    stream: realtimeMic.mediaStream,
    enabled,
    onSpeechStart: handleVadSpeechStart,
    onSpeechEnd: handleVadSpeechEnd,
    onNoSpeechTimeout: handleNoSpeechTimeout,
    onMaxAnswerTimeout: handleMaxAnswerTimeout,
  });

  const startListening = useCallback(async () => {
    if (!enabled || !activeSessionId || isPaused || isCompleted) return;
    let permissionResult = { ok: true, stream: null };
    try {
      if (!realtimeMic.mediaStream) {
        permissionResult = await requestPermission({ keepStream: true });
        if (!permissionResult.ok) {
          setVoiceState('permission_denied');
          setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', permissionResult.error || 'Allow microphone access to use Voice Mode.'));
          return;
        }
      }
      noSpeechPromptedRef.current = false;
      setVoiceState('arming_mic');
      setVoiceStatus(buildVoiceStatus('info', 'Opening microphone', 'Duplex Voice Agent is ready to hear your answer.'));
      duplexSocket.sendSpeechStart();
      realtimeMic.setSendAudio?.(true);
      const stream = realtimeMic.mediaStream || await realtimeMic.startStream({ sendAudio: true, stream: permissionResult.stream });
      sessionAudioRecorder.startRecording(stream);
      await vad.startVad({ stream, ignoreFirstMs: VAD_WARMUP_IGNORE_MS });
      activeVoiceTurnTraceRef.current?.mark('mic_ready');
      setVoiceState('listening');
      setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Answer naturally. KiwiCoach will stop recording when you pause.'));
    } catch (error) {
      permissionResult.stream?.getTracks?.().forEach((track) => track.stop());
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice failed', error.message || 'Could not start duplex voice.'));
    }
  }, [enabled, activeSessionId, isPaused, isCompleted, requestPermission, duplexSocket, realtimeMic, vad, sessionAudioRecorder]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const speakQuestionText = useCallback((questionText, statusMessage = 'Listen to the question. You can start speaking to interrupt when needed.') => {
    const cleanQuestion = String(questionText || '').trim();
    if (!cleanQuestion) return false;
    setAssistantTextPreview('');
    firstAudioChunkSeenRef.current = false;
    setVoiceState('ai_speaking');
    setVoiceStatus(buildVoiceStatus('info', 'KiwiCoach is speaking', statusMessage));
    duplexSocket.speakText(cleanQuestion);
    return true;
  }, [duplexSocket]);

  const speakCurrentQuestion = useCallback((options = {}) => {
    const questionText = getLatestAssistantQuestionText(session, !options.repeatOnly);
    return speakQuestionText(
      questionText,
      options.repeatOnly ? 'Repeating the current question without the question number.' : undefined
    );
  }, [getLatestAssistantQuestionText, session, speakQuestionText]);

  const ensureDuplexConnected = useCallback(async () => {
    if (!activeSessionId) throw new Error('Missing session ID.');
    if (['ready', 'listening', 'open'].includes(duplexSocket.socketState)) return;
    await duplexSocket.connect({
      sessionId: activeSessionId,
      language: DEFAULT_LANGUAGE,
      sampleRate: 16000,
      voiceName: DEFAULT_VOICE_NAME,
    });
  }, [activeSessionId, duplexSocket]);

  const startPassiveMicMonitor = useCallback(async () => {
    if (!enabled || !activeSessionId || isPaused || isCompleted) return false;

    let permissionResult = { ok: true, stream: null };
    try {
      if (!realtimeMic.mediaStream) {
        permissionResult = await requestPermission({ keepStream: true });
        if (!permissionResult.ok) {
          setVoiceState('permission_denied');
          setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', permissionResult.error || 'Allow microphone access to use Voice Mode.'));
          return false;
        }
      }

      realtimeMic.setSendAudio?.(false);
      const stream = realtimeMic.mediaStream || await realtimeMic.startStream({ sendAudio: false, stream: permissionResult.stream });
      sessionAudioRecorder.startRecording(stream);
      await vad.startVad({ stream, ignoreFirstMs: VAD_WARMUP_IGNORE_MS });
      voiceSessionTraceRef.current?.mark('passive_mic_monitor_ready');
      return true;
    } catch (error) {
      permissionResult.stream?.getTracks?.().forEach((track) => track.stop());
      throw error;
    }
  }, [enabled, activeSessionId, isPaused, isCompleted, requestPermission, realtimeMic, vad, sessionAudioRecorder]);


  const ensureInterviewStarted = useCallback(async () => {
    if (session?.status !== 'ready') return session;
    const startedSession = await onStartInterview?.();
    return startedSession || session;
  }, [onStartInterview, session]);

  const handleToggleRecording = useCallback(async () => {
    if (!enabled || isCompleted || isPaused) return;
    if (!isSupported) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice unavailable', 'This browser cannot record microphone audio.'));
      return;
    }

    if (isAutoLoopActive || realtimeMic.isStreaming) {
      autoLoopActiveRef.current = false;
      setIsAutoLoopActive(false);
      stopLatencyAcknowledgement();
      audioQueue.clearQueue();
      vad.stopVad?.();
      await sessionAudioRecorder.stopCurrentSegment();
      await realtimeMic.stopStream();
      duplexSocket.stopSession();
      setReadyState();
      return;
    }

    try {
      const audioUnlock = await audioQueue.unlockAudio?.();
      if (audioUnlock && !audioUnlock.ok) {
        setVoiceStatus(buildVoiceStatus('warning', 'Tap to enable audio', audioUnlock.error || 'Your browser needs a tap before it can play interview audio.'));
      }
      const startedSession = await ensureInterviewStarted();
      const firstQuestionText = getLatestAssistantQuestionText(startedSession, true);

      voiceSessionTraceRef.current = createVoiceLatencyTrace({
        sessionId: activeSessionId,
        mode: 'duplex_voice',
        traceType: 'voice_session',
      });
      activeVoiceTurnTraceRef.current = null;
      activeBackendLatencyRef.current = null;
      firstAudioChunkSeenRef.current = false;
      latestFirstAudioDelayRef.current = null;
      consecutiveSlowTurnsRef.current = 0;
      updateVoiceNetworkQuality({ firstAudioDelayMs: null, consecutiveSlowTurns: 0 });
      voiceSessionTraceRef.current.mark('voice_loop_start');
      voiceSessionTraceRef.current.mark('vad_config', { ...DEFAULT_VAD_CONFIG, warmupIgnoreMs: VAD_WARMUP_IGNORE_MS });
      autoLoopActiveRef.current = true;
      setIsAutoLoopActive(true);
      setVoiceState('starting');
      setVoiceStatus(buildVoiceStatus('info', 'Starting duplex voice interview', 'KiwiCoach will speak, listen, and allow interruption.'));
      await ensureDuplexConnected();
      await startPassiveMicMonitor();
      const spoke = speakQuestionText(firstQuestionText);
      if (!spoke) await startListening();
    } catch (error) {
      autoLoopActiveRef.current = false;
      setIsAutoLoopActive(false);
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Duplex voice failed', error.message || 'Could not start Voice Mode.'));
    }
  }, [enabled, isCompleted, isPaused, isSupported, isAutoLoopActive, realtimeMic, stopLatencyAcknowledgement, audioQueue, vad, duplexSocket, setReadyState, activeSessionId, ensureDuplexConnected, startPassiveMicMonitor, speakQuestionText, getLatestAssistantQuestionText, ensureInterviewStarted, startListening, sessionAudioRecorder, updateVoiceNetworkQuality]);

  const handleRequestPermission = useCallback(async () => {
    setVoiceState('requesting_permission');
    setVoiceStatus(buildVoiceStatus('info', 'Requesting microphone access', 'Allow microphone access so the duplex voice interview can listen.'));
    const result = await requestPermission();
    if (result.ok) setReadyState();
    else {
      setVoiceState('permission_denied');
      setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', result.error || 'Microphone access is required.'));
    }
  }, [requestPermission, setReadyState]);

  const handleReplayAssistantAudio = useCallback(() => {
    ensureDuplexConnected().then(() => speakCurrentQuestion({ repeatOnly: true })).catch(() => {});
    return true;
  }, [ensureDuplexConnected, speakCurrentQuestion]);

  const handleResetShell = useCallback(async () => {
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    stopLatencyAcknowledgement();
    audioQueue.clearQueue();
    vad.stopVad?.();
    await sessionAudioRecorder.stopCurrentSegment();
    await realtimeMic.stopStream();
    duplexSocket.closeSocket();
    setTranscriptionPreview('');
    setPendingTranscript(null);
    setLastTranscriptRejection(null);
    setIsVoiceTakingLong(false);
    setEditableTranscript('');
    setLastAsrConfidence(null);
    setAssistantTextPreview('');
    latestFirstAudioDelayRef.current = null;
    consecutiveSlowTurnsRef.current = 0;
    updateVoiceNetworkQuality({ firstAudioDelayMs: null, consecutiveSlowTurns: 0 });
    setReadyState();
  }, [audioQueue, vad, realtimeMic, duplexSocket, setReadyState, sessionAudioRecorder, stopLatencyAcknowledgement, updateVoiceNetworkQuality]);

  const uploadRecordingIfAvailable = useCallback(async () => {
    const recordingBlob = await sessionAudioRecorder.getCombinedRecording();
    if (!recordingBlob || !activeSessionId) return null;

    setRecordingStatus({ state: 'uploading', error: null });
    try {
      const result = await uploadSessionRecording({ sessionId: activeSessionId, audioBlob: recordingBlob });
      setRecordingStatus({ state: 'ready', error: null });
      return result;
    } catch (error) {
      setRecordingStatus({ state: 'failed', error: error.message || 'Could not save MP3 recording.' });
      return null;
    }
  }, [activeSessionId, sessionAudioRecorder]);

  const stopVoiceSession = useCallback(async (reason = 'manual_end') => {
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    setVoiceState('ending');
    setVoiceStatus(buildVoiceStatus('info', 'Stopping voice session', 'Microphone, audio, and voice connection are being closed.'));

    stopLatencyAcknowledgement();
    audioQueue.clearQueue();
    vad.stopVad?.();
    duplexSocket.stopSession();
    await uploadRecordingIfAvailable();
    await realtimeMic.stopStream();
    duplexSocket.closeSocket();
    voiceSessionTraceRef.current?.mark('voice_session_stopped', { reason });
  }, [audioQueue, vad, duplexSocket, uploadRecordingIfAvailable, realtimeMic, stopLatencyAcknowledgement]);

  useEffect(() => {
    if (!enabled || !isCompleted || completedCleanupDoneRef.current) return;
    if (!isAutoLoopActive && !realtimeMic.isStreaming && !sessionAudioRecorder.isRecordingSessionAudio) return;

    completedCleanupDoneRef.current = true;
    stopVoiceSession('session_completed').catch((error) => {
      setRecordingStatus({
        state: 'failed',
        error: error.message || 'Could not finalise the MP3 recording.',
      });
    });
  }, [enabled, isCompleted, isAutoLoopActive, realtimeMic.isStreaming, sessionAudioRecorder.isRecordingSessionAudio, stopVoiceSession]);

  useEffect(() => {
    if (!isCompleted) completedCleanupDoneRef.current = false;
  }, [isCompleted]);

  useEffect(() => {
    if (permissionState === 'granted' && voiceState === 'idle') setReadyState();
  }, [permissionState, voiceState, setReadyState]);

  useEffect(() => {
    if (duplexSocket.partialTranscript) setTranscriptionPreview(duplexSocket.partialTranscript);
  }, [duplexSocket.partialTranscript]);

  useEffect(() => {
    if (!duplexSocket.finalTranscript?.displayText) return;
    activeVoiceTurnTraceRef.current?.mark('final_transcript_received', {
      source: duplexSocket.finalTranscript.type || 'duplex_socket',
      confidence: duplexSocket.finalTranscript.confidence ?? null,
    });
    setTranscriptionPreview(duplexSocket.finalTranscript.displayText);
    setPendingTranscript(duplexSocket.finalTranscript);
    setEditableTranscript(duplexSocket.finalTranscript.displayText);
    setLastAsrConfidence(duplexSocket.finalTranscript.confidence ?? null);
  }, [duplexSocket.finalTranscript]);

  useEffect(() => {
    if (!duplexSocket.socketError) return;
    stopLatencyAcknowledgement();
    setVoiceState('error');
    setVoiceStatus(buildVoiceStatus('error', 'Duplex voice failed', duplexSocket.socketError));
  }, [duplexSocket.socketError, stopLatencyAcknowledgement]);

  useEffect(() => {
    latestSocketLatencyRef.current = duplexSocket.latency || {};
    updateVoiceNetworkQuality();
  }, [duplexSocket.latency, updateVoiceNetworkQuality]);

  useEffect(() => {
    if (!isAutoLoopActive || !['open', 'ready', 'listening'].includes(duplexSocket.socketState)) return undefined;
    duplexSocket.sendPing?.();
    const timer = window.setInterval(() => duplexSocket.sendPing?.(), NETWORK_PING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [duplexSocket, duplexSocket.socketState, isAutoLoopActive]);

  useEffect(() => {
    if (!isProcessingTurn || voiceState !== 'agent_thinking') {
      setIsVoiceTakingLong(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIsVoiceTakingLong(true);
    }, SLOW_PROCESSING_WARNING_MS);

    return () => window.clearTimeout(timer);
  }, [isProcessingTurn, voiceState]);

  useEffect(() => {
    cleanupRef.current = () => {
      stopLatencyAcknowledgement();
      audioQueue.clearQueue();
      vad.stopVad?.();
      sessionAudioRecorder.resetRecording();
      realtimeMic.stopStream();
      duplexSocket.closeSocket();
    };
  }, [audioQueue, vad, realtimeMic, duplexSocket, sessionAudioRecorder, stopLatencyAcknowledgement]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const stateLabel = useMemo(() => {
    switch (voiceState) {
      case 'requesting_permission': return 'Requesting mic access';
      case 'permission_denied': return 'Microphone blocked';
      case 'ready': return 'Duplex voice ready';
      case 'starting': return 'Starting duplex voice';
      case 'ai_speaking': return 'KiwiCoach speaking';
      case 'arming_mic': return 'Opening microphone';
      case 'listening': return 'Listening';
      case 'user_speaking': return 'Answering';
      case 'interrupted': return 'Interrupted';
      case 'agent_thinking': return 'Processing answer';
      case 'repair_prompt': return 'Please repeat';
      case 'ending': return 'Ending voice session';
      case 'error': return 'Voice error';
      default: return 'Idle';
    }
  }, [voiceState]);

  const liveTranscript = useMemo(() => (session?.transcript || []).slice(-8), [session?.transcript]);
  const isRecording = realtimeMic.isStreaming || ['listening', 'user_speaking', 'interrupted'].includes(voiceState);
  const canUseVoice = enabled && !isPaused && !isCompleted && (!isSubmitting || isAutoLoopActive) && (!isProcessingTurn || isAutoLoopActive);

  return {
    currentQuestion,
    latestUserTurn,
    liveTranscript,
    permissionState,
    permissionError,
    isRequesting,
    isSupported,
    stateLabel,
    voiceState,
    voiceStatus,
    voiceMode: 'duplex',
    realtimeStatus: duplexSocket.socketState,
    realtimeLatency: duplexSocket.latency,
    vadState: vad.vadState,
    vadMetrics: vad.vadMetrics,
    isAutoLoopActive,
    pendingTranscript,
    editableTranscript,
    setEditableTranscript,
    isRecording,
    isProcessingTurn,
    isVoiceTakingLong,
    voiceNetworkQuality,
    canUseVoice,
    recordingStatus,
    lastTranscriptRejection,
    levelHistory: realtimeMic.levelHistory,
    recordingDurationMs: realtimeMic.durationMs,
    recordingDurationLabel: formatDurationLabel(realtimeMic.durationMs),
    transcriptionPreview: transcriptionPreview || assistantTextPreview,
    assistantAudioUrl: audioQueue.assistantAudioUrl,
    playbackError: audioQueue.playbackError,
    audioRef: audioQueue.audioRef,
    lastAsrConfidence,
    manualAudioFile: null,
    backupText: '',
    isBackupExpanded: false,
    handleRequestPermission,
    handleToggleRecording,
    handleUseRealtimeTranscript: () => {},
    handleRecordAgain: () => setReadyState(),
    handleReplayAssistantAudio,
    handleResetShell,
    stopVoiceSession,
    handleAudioFileSelect: () => {},
    handleSubmitSelectedAudio: () => {},
    setBackupText: () => {},
    setIsBackupExpanded: () => {},
    onPause,
    onRepeat,
    onEnd,
  };
}
