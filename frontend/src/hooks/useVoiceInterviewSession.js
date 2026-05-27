import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMicrophonePermission } from './useMicrophonePermission.js';
import { useRealtimeMicStream } from './voice/useRealtimeMicStream.js';
import { useVoiceActivityDetection } from './voice/useVoiceActivityDetection.js';
import { useDuplexVoiceSocket } from './voice/useDuplexVoiceSocket.js';
import { useAssistantAudioQueue } from './voice/useAssistantAudioQueue.js';
import { useSessionAudioRecorder } from './voice/useSessionAudioRecorder.js';
import { useVoiceSessionRefs } from './voice/useVoiceSessionRefs.js';
import { uploadSessionRecording } from '../api/recordingApi.js';
import { createVoiceLatencyTrace } from '../utils/voiceLatencyTrace.js';
import { buildVoiceLatencyDebugSummary, buildVoiceLatencyTargetSummary } from '../utils/voiceLatencySummary.js';
import { DEFAULT_VAD_CONFIG } from '../utils/voiceActivityDetectionCore.js';
import { assessVoiceNetworkQuality } from '../utils/voiceRuntimeNetwork.js';
import { cancelLatencyAcknowledgement, playLatencyAcknowledgement } from '../utils/voiceLatencyAcknowledgement.js';
import {
  BARGE_IN_CONFIRMATION_MS,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE_NAME,
  DUPLEX_CONNECTED_STATES,
  LATENCY_ACK_COOLDOWN_MS,
  LATENCY_ACK_DELAY_MS,
  MIC_ARM_DELAY_MS,
  NETWORK_PING_INTERVAL_MS,
  RECORDING_VOICE_STATES,
  SLOW_FIRST_AUDIO_MS,
  SLOW_PROCESSING_WARNING_MS,
  SPEECH_END_CONFIRMATION_MS,
  VAD_WARMUP_IGNORE_MS,
} from './voice/voiceSessionConstants.js';
import {
  buildTranscriptFromTurnPayload,
  buildVoiceStatus,
  formatDurationLabel,
  getLatestAssistantQuestionText,
  getLatestTurnByRole,
  getVoiceStateLabel,
  resolveSessionId,
} from './voice/voiceSessionHelpers.js';

export { formatDurationLabel, getLatestTurnByRole, resolveSessionId } from './voice/voiceSessionHelpers.js';

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

  const {
    autoLoopActiveRef,
    voiceSessionTraceRef,
    activeVoiceTurnTraceRef,
    activeBackendLatencyRef,
    voiceTurnSequenceRef,
    vadMetricsRef,
    latestSocketLatencyRef,
    firstAudioChunkSeenRef,
    activeVoiceTurnStartedAtRef,
    latestFirstAudioDelayRef,
    consecutiveSlowTurnsRef,
    latencyAcknowledgementTimerRef,
    lastLatencyAcknowledgementAtRef,
    noSpeechPromptedRef,
    completedCleanupDoneRef,
    startListeningRef,
    cleanupRef,
    isAssistantSpeakingRef,
    pendingBargeInRef,
    pendingSpeechEndTimerRef,
    pendingSpeechEndMetricsRef,
    speechStartSentRef,
  } = useVoiceSessionRefs();

  const sessionAudioRecorder = useSessionAudioRecorder();
  const activeSessionId = resolveSessionId(session, sessionId);

  const currentQuestion = useMemo(
    () => getLatestTurnByRole(session?.transcript || [], 'ai'),
    [session?.transcript]
  );
  const latestUserTurn = useMemo(
    () => getLatestTurnByRole(session?.transcript || [], 'user'),
    [session?.transcript]
  );

  const setReadyState = useCallback(() => {
    if (!enabled) return;
    setVoiceState('ready');
    setVoiceStatus(buildVoiceStatus(
      'success',
      'Voice ready',
      'Duplex Voice Agent is ready. KiwiCoach can listen, speak, and handle interruption.'
    ));
  }, [enabled]);

  const logVoiceLatencySummary = useCallback((phase = 'turn', backendLatency = null) => {
    const trace = activeVoiceTurnTraceRef.current?.toJSON?.();
    if (!trace && !backendLatency) return;

    const targetSummary = buildVoiceLatencyTargetSummary({ trace, backendLatency, phase });
    const debugSummary = buildVoiceLatencyDebugSummary({ trace, backendLatency, phase });

    console.info('[voice-latency] target', targetSummary);
    console.debug('[voice-latency:debug]', debugSummary);
    if (typeof console.table === 'function') console.table(targetSummary);
  }, [activeVoiceTurnTraceRef]);

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
  }, [
    activeBackendLatencyRef,
    activeSessionId,
    activeVoiceTurnStartedAtRef,
    activeVoiceTurnTraceRef,
    firstAudioChunkSeenRef,
    voiceTurnSequenceRef,
  ]);

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
  }, [consecutiveSlowTurnsRef, latestFirstAudioDelayRef, latestSocketLatencyRef]);

  const clearLatencyAcknowledgementTimer = useCallback(() => {
    if (!latencyAcknowledgementTimerRef.current) return;
    window.clearTimeout(latencyAcknowledgementTimerRef.current);
    latencyAcknowledgementTimerRef.current = null;
  }, [latencyAcknowledgementTimerRef]);

  const stopLatencyAcknowledgement = useCallback(() => {
    clearLatencyAcknowledgementTimer();
    cancelLatencyAcknowledgement();
  }, [clearLatencyAcknowledgementTimer]);

  const clearPendingBargeIn = useCallback(() => {
    pendingBargeInRef.current = null;
  }, [pendingBargeInRef]);

  const clearPendingSpeechEnd = useCallback(() => {
    if (pendingSpeechEndTimerRef.current) {
      window.clearTimeout(pendingSpeechEndTimerRef.current);
      pendingSpeechEndTimerRef.current = null;
    }
    pendingSpeechEndMetricsRef.current = null;
  }, [pendingSpeechEndMetricsRef, pendingSpeechEndTimerRef]);

  const scheduleLatencyAcknowledgement = useCallback(() => {
    clearLatencyAcknowledgementTimer();
    latencyAcknowledgementTimerRef.current = window.setTimeout(() => {
      const now = Date.now();
      const recentlyPlayed = now - lastLatencyAcknowledgementAtRef.current < LATENCY_ACK_COOLDOWN_MS;
      if (recentlyPlayed || !autoLoopActiveRef.current || firstAudioChunkSeenRef.current) return;

      const played = playLatencyAcknowledgement({ index: voiceTurnSequenceRef.current });
      if (played) lastLatencyAcknowledgementAtRef.current = now;
    }, LATENCY_ACK_DELAY_MS);
  }, [
    autoLoopActiveRef,
    clearLatencyAcknowledgementTimer,
    firstAudioChunkSeenRef,
    lastLatencyAcknowledgementAtRef,
    latencyAcknowledgementTimerRef,
    voiceTurnSequenceRef,
  ]);

  const audioQueue = useAssistantAudioQueue({
    onPlaybackStart: () => {
      console.log('[FRONTEND-TTS-TRACE] Assistant audio playback started.');
      stopLatencyAcknowledgement();
      isAssistantSpeakingRef.current = true;
      activeVoiceTurnTraceRef.current?.mark('assistant_audio_play_start');
      if (activeVoiceTurnTraceRef.current) {
        logVoiceLatencySummary('assistant_playback_start', activeBackendLatencyRef.current);
      }
      setVoiceState('ai_speaking');
      setVoiceStatus(buildVoiceStatus('success', 'KiwiCoach is speaking', 'You can interrupt naturally by speaking.'));
    },
    onPlaybackEnd: () => {
      activeVoiceTurnTraceRef.current?.mark('assistant_audio_play_end');
    },
    onQueueDrained: () => {
      console.log('[FRONTEND-TTS-TRACE] Assistant audio queue drained.');
      isAssistantSpeakingRef.current = false;
      clearPendingBargeIn();
      if (autoLoopActiveRef.current && !isPaused && !isCompleted && !isProcessingTurn) {
        window.setTimeout(() => startListeningRef.current?.(), MIC_ARM_DELAY_MS);
        return;
      }
      if (!isPaused && !isCompleted) setReadyState();
    },
    onPlaybackError: (message) => {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Audio playback blocked', message));
    },
  });

  const handleFirstAudioChunk = useCallback((chunk) => {
    if (firstAudioChunkSeenRef.current) return;

    console.log('[FRONTEND-TTS-TRACE] Received first TTS audio chunk from backend.');
    firstAudioChunkSeenRef.current = true;
    const firstAudioDelayMs = activeVoiceTurnStartedAtRef.current
      ? Math.round(performance.now() - activeVoiceTurnStartedAtRef.current)
      : null;

    latestFirstAudioDelayRef.current = firstAudioDelayMs;
    consecutiveSlowTurnsRef.current = firstAudioDelayMs > SLOW_FIRST_AUDIO_MS
      ? consecutiveSlowTurnsRef.current + 1
      : 0;

    updateVoiceNetworkQuality({
      firstAudioDelayMs,
      consecutiveSlowTurns: consecutiveSlowTurnsRef.current,
    });
    activeVoiceTurnTraceRef.current?.mark('first_audio_chunk_received', { index: chunk.index });
  }, [
    activeVoiceTurnStartedAtRef,
    activeVoiceTurnTraceRef,
    consecutiveSlowTurnsRef,
    firstAudioChunkSeenRef,
    latestFirstAudioDelayRef,
    updateVoiceNetworkQuality,
  ]);

  const applyTurnTranscript = useCallback((payload) => {
    const transcript = buildTranscriptFromTurnPayload(payload);
    if (!transcript) return;

    setPendingTranscript(transcript);
    setEditableTranscript(transcript.displayText);
    setLastAsrConfidence(transcript.confidence);
  }, []);

  const duplexSocket = useDuplexVoiceSocket({
    onAudioChunk: (chunk) => {
      stopLatencyAcknowledgement();
      handleFirstAudioChunk(chunk);
      activeVoiceTurnTraceRef.current?.mark('tts_audio_chunk_received', { index: chunk.index });
      audioQueue.enqueueAudioChunk(chunk);
    },
    onAssistantText: (payload) => {
      setAssistantTextPreview((current) => `${current}${payload.text || ''}`);
    },
    onSpeechDone: () => {
      console.log('[FRONTEND-TTS-TRACE] Assistant speech stream done.');
      audioQueue.finishAudioStream?.();
      setIsProcessingTurn(false);
    },
    onTranscriptRejected: (payload) => {
      console.log('[FRONTEND-STT-TRACE] Transcript rejected by backend (repair prompt).');
      stopLatencyAcknowledgement();
      setIsProcessingTurn(false);
      setIsVoiceTakingLong(false);
      setPendingTranscript(null);
      setEditableTranscript('');
      setLastAsrConfidence(payload?.transcription?.confidence ?? null);
      setLastTranscriptRejection(payload);
      setVoiceState('repair_prompt');
      setVoiceStatus(buildVoiceStatus(
        'warning',
        'Voice did not catch that clearly',
        payload?.message || 'Please answer again so KiwiCoach can score the right content.'
      ));
    },
    onTurnDone: (payload) => {
      console.log('[FRONTEND-STT-TRACE] Turn done received. Final transcript:', payload?.transcription?.text);
      stopLatencyAcknowledgement();
      activeVoiceTurnTraceRef.current?.mark('auto_submit_response');
      setIsProcessingTurn(false);
      setIsVoiceTakingLong(false);
      setLastTranscriptRejection(null);
      speechStartSentRef.current = false;
      activeBackendLatencyRef.current = payload?.latency || null;
      logVoiceLatencySummary('duplex_turn_done', activeBackendLatencyRef.current);
      if (payload?.session) onVoiceSessionUpdate?.(payload.session);
      applyTurnTranscript(payload);
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

  const {
    socketState: duplexSocketState,
    partialTranscript,
    finalTranscript,
    socketError,
    latency: duplexLatency,
    connect: connectDuplexSocket,
    closeSocket: closeDuplexSocket,
    sendAudioChunk,
    sendSpeechStart,
    sendSpeechEnd,
    sendBargeIn,
    speakText,
    sendPing,
    stopSession,
  } = duplexSocket;

  const realtimeMic = useRealtimeMicStream({ onAudioChunk: sendAudioChunk });
  const {
    isStreaming: isMicStreaming,
    levelHistory: micLevelHistory,
    durationMs: micDurationMs,
    mediaStream: micMediaStream,
    startStream,
    stopStream,
    setSendAudio,
  } = realtimeMic;

  const sendSpeechStartIfNeeded = useCallback(() => {
    if (speechStartSentRef.current) return false;
    speechStartSentRef.current = true;
    setSendAudio?.(true);
    const sent = sendSpeechStart();
    if (!sent) speechStartSentRef.current = false;
    return sent;
  }, [sendSpeechStart, setSendAudio, speechStartSentRef]);

  const confirmPendingBargeIn = useCallback(() => {
    const pending = pendingBargeInRef.current;
    if (!pending || pending.confirmed || !isAssistantSpeakingRef.current) return false;

    pendingBargeInRef.current = { ...pending, confirmed: true };
    sendSpeechStartIfNeeded();
    audioQueue.clearQueue();
    sendBargeIn('user_started_speaking');
    setVoiceState('interrupted');
    setVoiceStatus(buildVoiceStatus('info', 'Interrupting KiwiCoach', 'Your voice interrupted the assistant. Keep speaking.'));
    return true;
  }, [audioQueue, isAssistantSpeakingRef, pendingBargeInRef, sendBargeIn, sendSpeechStartIfNeeded]);

  const stopListening = useCallback(async (reason = 'speech_end') => {
    clearPendingSpeechEnd();
    console.log(`[FRONTEND-STT-TRACE] Stopping listening. Reason: ${reason}`);
    const { turnId } = startVoiceTurnTrace(reason);
    activeVoiceTurnTraceRef.current?.mark('auto_submit_start', { reason, turnId });
    activeVoiceTurnTraceRef.current?.mark('stt_stop_sent', { reason, turnId });
    vad.stopVad?.();
    console.log('[FRONTEND-STT-TRACE] Sending speech_end to backend.');
    sendSpeechEnd(vadMetricsRef.current || null);
    speechStartSentRef.current = false;
    setSendAudio?.(false);
    setIsProcessingTurn(true);
    setVoiceState('agent_thinking');
    setVoiceStatus(buildVoiceStatus('info', 'Processing your answer', 'KiwiCoach is preparing the next turn. This may take a few seconds.'));
    scheduleLatencyAcknowledgement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearPendingSpeechEnd, scheduleLatencyAcknowledgement, sendSpeechEnd, setSendAudio, startVoiceTurnTrace]);

  const handleVadFrame = useCallback((frame = {}) => {
    const pending = pendingBargeInRef.current;
    if (!pending || pending.confirmed || !isAssistantSpeakingRef.current) return;

    const thresholds = frame.metrics?.thresholds || {};
    const speechThreshold = thresholds.speechThreshold || DEFAULT_VAD_CONFIG.speechThreshold;
    const silenceThreshold = thresholds.silenceThreshold || DEFAULT_VAD_CONFIG.silenceThreshold;
    const rms = Number(frame.rms || 0);

    if (rms <= silenceThreshold) {
      clearPendingBargeIn();
      return;
    }
    if (rms < speechThreshold) return;
    if (frame.at - pending.startedAt >= BARGE_IN_CONFIRMATION_MS) confirmPendingBargeIn();
  }, [clearPendingBargeIn, confirmPendingBargeIn, isAssistantSpeakingRef, pendingBargeInRef]);

  const handleVadSpeechStart = useCallback((metrics = {}) => {
    clearPendingSpeechEnd();
    console.log('[FRONTEND-STT-TRACE] VAD detected speech start.');
    stopLatencyAcknowledgement();
    setLastTranscriptRejection(null);
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };
    voiceSessionTraceRef.current?.mark('vad_speech_start', metrics);

    if (isAssistantSpeakingRef.current) {
      pendingBargeInRef.current = {
        startedAt: Number(metrics.speechStartedAt || performance.now()),
        confirmed: false,
      };
      return;
    }

    console.log('[FRONTEND-STT-TRACE] Arming microphone and sending speech_start.');
    sendSpeechStartIfNeeded();
    setVoiceState('user_speaking');
    setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Keep answering naturally. KiwiCoach will stop when you pause.'));
  }, [
    clearPendingSpeechEnd,
    isAssistantSpeakingRef,
    pendingBargeInRef,
    sendSpeechStartIfNeeded,
    stopLatencyAcknowledgement,
    vadMetricsRef,
    voiceSessionTraceRef,
  ]);

  const handleVadSpeechEnd = useCallback((metrics = {}) => {
    clearPendingBargeIn();
    pendingSpeechEndMetricsRef.current = metrics;
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };

    console.log('[FRONTEND-STT-TRACE] VAD possible speech_end detected. Waiting before final submit.', metrics);
    setVoiceStatus(buildVoiceStatus('info', 'Still listening', 'Pause detected. Continue speaking if you have more to add.'));

    if (pendingSpeechEndTimerRef.current) window.clearTimeout(pendingSpeechEndTimerRef.current);
    pendingSpeechEndTimerRef.current = window.setTimeout(async () => {
      pendingSpeechEndTimerRef.current = null;
      const finalMetrics = pendingSpeechEndMetricsRef.current || metrics;
      pendingSpeechEndMetricsRef.current = null;
      vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...finalMetrics };

      console.log('[FRONTEND-STT-TRACE] VAD speech_end confirmed after grace window.');
      await stopListening('vad_speech_end_confirmed');
    }, SPEECH_END_CONFIRMATION_MS);
  }, [
    clearPendingBargeIn,
    pendingSpeechEndMetricsRef,
    pendingSpeechEndTimerRef,
    stopListening,
    vadMetricsRef,
  ]);

  const handleNoSpeechTimeout = useCallback(() => {
    if (!autoLoopActiveRef.current || noSpeechPromptedRef.current) return;
    noSpeechPromptedRef.current = true;
    setVoiceStatus(buildVoiceStatus('info', 'Take your time', 'Start answering when you are ready.'));
  }, [autoLoopActiveRef, noSpeechPromptedRef]);

  const handleMaxAnswerTimeout = useCallback(async (metrics = {}) => {
    clearPendingSpeechEnd();
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics, maxAnswerTimeout: true };
    await stopListening('vad_max_answer_timeout');
  }, [clearPendingSpeechEnd, stopListening, vadMetricsRef]);

  const vad = useVoiceActivityDetection({
    stream: micMediaStream,
    enabled,
    onSpeechStart: handleVadSpeechStart,
    onSpeechEnd: handleVadSpeechEnd,
    onNoSpeechTimeout: handleNoSpeechTimeout,
    onMaxAnswerTimeout: handleMaxAnswerTimeout,
    onVadFrame: handleVadFrame,
  });

  const startListening = useCallback(async () => {
    if (!enabled || !activeSessionId || isPaused || isCompleted) return;
    if (isAssistantSpeakingRef.current || isProcessingTurn) {
      console.warn('[FRONTEND-STT-TRACE] Blocked startListening because assistant or backend is busy.', {
        isAssistantSpeaking: isAssistantSpeakingRef.current,
        isProcessingTurn,
      });
      return;
    }

    let permissionResult = { ok: true, stream: null };
    try {
      if (!micMediaStream) {
        permissionResult = await requestPermission({ keepStream: true });
        if (!permissionResult.ok) {
          setVoiceState('permission_denied');
          setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', permissionResult.error || 'Allow microphone access to use Voice Mode.'));
          return;
        }
      }

      clearPendingSpeechEnd();
      speechStartSentRef.current = false;
      noSpeechPromptedRef.current = false;
      setVoiceState('arming_mic');
      setVoiceStatus(buildVoiceStatus('info', 'Opening microphone', 'Duplex Voice Agent is ready to hear your answer.'));

      setSendAudio?.(false);
      const stream = micMediaStream || await startStream({ sendAudio: false, stream: permissionResult.stream });
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
  }, [
    activeSessionId,
    activeVoiceTurnTraceRef,
    clearPendingSpeechEnd,
    enabled,
    isAssistantSpeakingRef,
    isCompleted,
    isPaused,
    isProcessingTurn,
    micMediaStream,
    noSpeechPromptedRef,
    requestPermission,
    sessionAudioRecorder,
    setSendAudio,
    speechStartSentRef,
    startStream,
    vad,
  ]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening, startListeningRef]);

  const speakQuestionText = useCallback((questionText, statusMessage = 'Listen to the question. You can start speaking to interrupt when needed.') => {
    const cleanQuestion = String(questionText || '').trim();
    if (!cleanQuestion) return false;

    setAssistantTextPreview('');
    firstAudioChunkSeenRef.current = false;
    setVoiceState('ai_speaking');
    setVoiceStatus(buildVoiceStatus('info', 'KiwiCoach is speaking', statusMessage));
    speakText(cleanQuestion);
    return true;
  }, [firstAudioChunkSeenRef, speakText]);

  const speakCurrentQuestion = useCallback((options = {}) => {
    const questionText = getLatestAssistantQuestionText(session, !options.repeatOnly);
    return speakQuestionText(
      questionText,
      options.repeatOnly ? 'Repeating the current question without the question number.' : undefined
    );
  }, [session, speakQuestionText]);

  const ensureDuplexConnected = useCallback(async () => {
    if (!activeSessionId) throw new Error('Missing session ID.');
    if (DUPLEX_CONNECTED_STATES.includes(duplexSocketState)) return;
    await connectDuplexSocket({
      sessionId: activeSessionId,
      language: DEFAULT_LANGUAGE,
      sampleRate: 16000,
      voiceName: DEFAULT_VOICE_NAME,
    });
  }, [activeSessionId, connectDuplexSocket, duplexSocketState]);

  const startPassiveMicMonitor = useCallback(async () => {
    if (!enabled || !activeSessionId || isPaused || isCompleted) return false;

    let permissionResult = { ok: true, stream: null };
    try {
      if (!micMediaStream) {
        permissionResult = await requestPermission({ keepStream: true });
        if (!permissionResult.ok) {
          setVoiceState('permission_denied');
          setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', permissionResult.error || 'Allow microphone access to use Voice Mode.'));
          return false;
        }
      }

      clearPendingSpeechEnd();
      speechStartSentRef.current = false;
      setSendAudio?.(false);
      const stream = micMediaStream || await startStream({ sendAudio: false, stream: permissionResult.stream });
      sessionAudioRecorder.startRecording(stream);
      await vad.startVad({ stream, ignoreFirstMs: VAD_WARMUP_IGNORE_MS });
      voiceSessionTraceRef.current?.mark('passive_mic_monitor_ready');
      return true;
    } catch (error) {
      permissionResult.stream?.getTracks?.().forEach((track) => track.stop());
      throw error;
    }
  }, [
    activeSessionId,
    clearPendingSpeechEnd,
    enabled,
    isCompleted,
    isPaused,
    micMediaStream,
    requestPermission,
    sessionAudioRecorder,
    setSendAudio,
    speechStartSentRef,
    startStream,
    vad,
    voiceSessionTraceRef,
  ]);

  const ensureInterviewStarted = useCallback(async () => {
    if (session?.status !== 'ready') return session;
    const startedSession = await onStartInterview?.();
    return startedSession || session;
  }, [onStartInterview, session]);

  const resetVoiceTraceState = useCallback(() => {
    activeVoiceTurnTraceRef.current = null;
    activeBackendLatencyRef.current = null;
    firstAudioChunkSeenRef.current = false;
    latestFirstAudioDelayRef.current = null;
    consecutiveSlowTurnsRef.current = 0;
    updateVoiceNetworkQuality({ firstAudioDelayMs: null, consecutiveSlowTurns: 0 });
  }, [
    activeBackendLatencyRef,
    activeVoiceTurnTraceRef,
    consecutiveSlowTurnsRef,
    firstAudioChunkSeenRef,
    latestFirstAudioDelayRef,
    updateVoiceNetworkQuality,
  ]);

  const stopActiveVoiceLoop = useCallback(async () => {
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    stopLatencyAcknowledgement();
    audioQueue.clearQueue();
    clearPendingBargeIn();
    clearPendingSpeechEnd();
    speechStartSentRef.current = false;
    vad.stopVad?.();
    await sessionAudioRecorder.stopCurrentSegment();
    await stopStream();
    stopSession();
    setReadyState();
  }, [
    audioQueue,
    autoLoopActiveRef,
    clearPendingBargeIn,
    clearPendingSpeechEnd,
    sessionAudioRecorder,
    setReadyState,
    speechStartSentRef,
    stopLatencyAcknowledgement,
    stopSession,
    stopStream,
    vad,
  ]);

  const handleToggleRecording = useCallback(async () => {
    if (!enabled || isCompleted || isPaused) return;
    if (!isSupported) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice unavailable', 'This browser cannot record microphone audio.'));
      return;
    }

    if (isAutoLoopActive || isMicStreaming) {
      await stopActiveVoiceLoop();
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
      resetVoiceTraceState();
      voiceSessionTraceRef.current.mark('voice_loop_start');
      voiceSessionTraceRef.current.mark('vad_config', { ...DEFAULT_VAD_CONFIG, warmupIgnoreMs: VAD_WARMUP_IGNORE_MS });

      autoLoopActiveRef.current = true;
      setIsAutoLoopActive(true);
      setVoiceState('starting');
      setVoiceStatus(buildVoiceStatus('info', 'Starting duplex voice interview', 'KiwiCoach will speak, listen, and allow interruption.'));

      await ensureDuplexConnected();
      await startPassiveMicMonitor();

      window.setTimeout(async () => {
        try {
          if (!autoLoopActiveRef.current) return;
          const spoke = speakQuestionText(firstQuestionText);
          if (!spoke) await startListening();
        } catch (error) {
          console.error('Failed to start first voice turn', error);
        }
      }, 1200);
    } catch (error) {
      autoLoopActiveRef.current = false;
      setIsAutoLoopActive(false);
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Duplex voice failed', error.message || 'Could not start Voice Mode.'));
    }
  }, [
    activeSessionId,
    audioQueue,
    autoLoopActiveRef,
    enabled,
    ensureDuplexConnected,
    ensureInterviewStarted,
    isAutoLoopActive,
    isCompleted,
    isMicStreaming,
    isPaused,
    isSupported,
    resetVoiceTraceState,
    speakQuestionText,
    startListening,
    startPassiveMicMonitor,
    stopActiveVoiceLoop,
    voiceSessionTraceRef,
  ]);

  const handleRequestPermission = useCallback(async () => {
    setVoiceState('requesting_permission');
    setVoiceStatus(buildVoiceStatus('info', 'Requesting microphone access', 'Allow microphone access so the duplex voice interview can listen.'));
    const result = await requestPermission();
    if (result.ok) {
      setReadyState();
      return;
    }
    setVoiceState('permission_denied');
    setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', result.error || 'Microphone access is required.'));
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
    clearPendingBargeIn();
    clearPendingSpeechEnd();
    speechStartSentRef.current = false;
    vad.stopVad?.();
    await sessionAudioRecorder.stopCurrentSegment();
    await stopStream();
    closeDuplexSocket();
    setTranscriptionPreview('');
    setPendingTranscript(null);
    setLastTranscriptRejection(null);
    setIsVoiceTakingLong(false);
    setEditableTranscript('');
    setLastAsrConfidence(null);
    setAssistantTextPreview('');
    resetVoiceTraceState();
    setReadyState();
  }, [
    audioQueue,
    autoLoopActiveRef,
    clearPendingBargeIn,
    clearPendingSpeechEnd,
    closeDuplexSocket,
    resetVoiceTraceState,
    sessionAudioRecorder,
    setReadyState,
    speechStartSentRef,
    stopLatencyAcknowledgement,
    stopStream,
    vad,
  ]);

  const handleRetryVoice = useCallback(async () => {
    await handleResetShell();
    if (!isCompleted && !isPaused) {
      window.setTimeout(() => {
        handleToggleRecording();
      }, 300);
    }
  }, [handleResetShell, handleToggleRecording, isCompleted, isPaused]);

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
    clearPendingBargeIn();
    clearPendingSpeechEnd();
    speechStartSentRef.current = false;
    vad.stopVad?.();
    stopSession();
    await uploadRecordingIfAvailable();
    await stopStream();
    closeDuplexSocket();
    voiceSessionTraceRef.current?.mark('voice_session_stopped', { reason });
  }, [
    audioQueue,
    autoLoopActiveRef,
    clearPendingBargeIn,
    clearPendingSpeechEnd,
    closeDuplexSocket,
    speechStartSentRef,
    stopLatencyAcknowledgement,
    stopSession,
    stopStream,
    uploadRecordingIfAvailable,
    vad,
    voiceSessionTraceRef,
  ]);

  useEffect(() => {
    if (!enabled || !isCompleted || completedCleanupDoneRef.current) return;
    if (!isAutoLoopActive && !isMicStreaming && !sessionAudioRecorder.isRecordingSessionAudio) return;

    completedCleanupDoneRef.current = true;
    stopVoiceSession('session_completed').catch((error) => {
      setRecordingStatus({
        state: 'failed',
        error: error.message || 'Could not finalise the MP3 recording.',
      });
    });
  }, [
    completedCleanupDoneRef,
    enabled,
    isAutoLoopActive,
    isCompleted,
    isMicStreaming,
    sessionAudioRecorder.isRecordingSessionAudio,
    stopVoiceSession,
  ]);

  useEffect(() => {
    if (!isCompleted) completedCleanupDoneRef.current = false;
  }, [completedCleanupDoneRef, isCompleted]);

  useEffect(() => {
    if (isPaused && isAutoLoopActive) handleResetShell();
  }, [handleResetShell, isAutoLoopActive, isPaused]);

  useEffect(() => {
    if (permissionState === 'granted' && voiceState === 'idle') setReadyState();
  }, [permissionState, setReadyState, voiceState]);

  useEffect(() => {
    if (partialTranscript) setTranscriptionPreview(partialTranscript);
  }, [partialTranscript]);

  useEffect(() => {
    if (!finalTranscript?.displayText) return;
    console.log('[FRONTEND-STT-TRACE] Final transcript segment received:', finalTranscript.displayText);
    activeVoiceTurnTraceRef.current?.mark('final_transcript_received', {
      source: finalTranscript.type || 'duplex_socket',
      confidence: finalTranscript.confidence ?? null,
    });
    setTranscriptionPreview(finalTranscript.displayText);
    setPendingTranscript(finalTranscript);
    setEditableTranscript(finalTranscript.displayText);
    setLastAsrConfidence(finalTranscript.confidence ?? null);
  }, [activeVoiceTurnTraceRef, finalTranscript]);

  useEffect(() => {
    if (!socketError) return;
    stopLatencyAcknowledgement();
    setVoiceState('error');
    setVoiceStatus(buildVoiceStatus('error', 'Duplex voice failed', socketError));
  }, [socketError, stopLatencyAcknowledgement]);

  useEffect(() => {
    latestSocketLatencyRef.current = duplexLatency || {};
    updateVoiceNetworkQuality();
  }, [duplexLatency, latestSocketLatencyRef, updateVoiceNetworkQuality]);

  useEffect(() => {
    if (!isAutoLoopActive || !DUPLEX_CONNECTED_STATES.includes(duplexSocketState)) return undefined;
    sendPing?.();
    const timer = window.setInterval(() => sendPing?.(), NETWORK_PING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [duplexSocketState, isAutoLoopActive, sendPing]);

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
      clearPendingBargeIn();
      clearPendingSpeechEnd();
      speechStartSentRef.current = false;
      vad.stopVad?.();
      sessionAudioRecorder.resetRecording();
      stopStream();
      closeDuplexSocket();
    };
  }, [
    audioQueue,
    clearPendingBargeIn,
    clearPendingSpeechEnd,
    cleanupRef,
    closeDuplexSocket,
    sessionAudioRecorder,
    speechStartSentRef,
    stopLatencyAcknowledgement,
    stopStream,
    vad,
  ]);

  useEffect(() => () => cleanupRef.current?.(), [cleanupRef]);

  const stateLabel = useMemo(() => getVoiceStateLabel(voiceState), [voiceState]);
  const liveTranscript = useMemo(() => (session?.transcript || []).slice(-8), [session?.transcript]);
  const isRecording = isMicStreaming || RECORDING_VOICE_STATES.includes(voiceState);
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
    realtimeStatus: duplexSocketState,
    realtimeLatency: duplexLatency,
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
    levelHistory: micLevelHistory,
    recordingDurationMs: micDurationMs,
    recordingDurationLabel: formatDurationLabel(micDurationMs),
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
    handleRecordAgain: () => setReadyState(),
    handleReplayAssistantAudio,
    handleResetShell,
    handleRetryVoice,
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
