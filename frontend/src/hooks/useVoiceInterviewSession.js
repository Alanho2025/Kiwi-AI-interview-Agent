import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMicrophonePermission } from './useMicrophonePermission.js';
import { useRealtimeMicStream } from './voice/useRealtimeMicStream.js';
import { useVoiceActivityDetection } from './voice/useVoiceActivityDetection.js';
import { useDuplexVoiceSocket } from './voice/useDuplexVoiceSocket.js';
import { useAssistantAudioQueue } from './voice/useAssistantAudioQueue.js';
import { createVoiceLatencyTrace } from '../utils/voiceLatencyTrace.js';
import { DEFAULT_VAD_CONFIG } from '../utils/voiceActivityDetectionCore.js';

const DEFAULT_VOICE_NAME = 'en-NZ-MollyNeural';
const DEFAULT_LANGUAGE = 'en-NZ';
const MIC_ARM_DELAY_MS = 350;
const VAD_WARMUP_IGNORE_MS = 500;

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
  const [isAutoLoopActive, setIsAutoLoopActive] = useState(false);
  const [assistantTextPreview, setAssistantTextPreview] = useState('');

  const autoLoopActiveRef = useRef(false);
  const voiceTraceRef = useRef(null);
  const vadMetricsRef = useRef(null);
  const noSpeechPromptedRef = useRef(false);
  const startListeningRef = useRef(null);
  const cleanupRef = useRef(null);
  const isAssistantSpeakingRef = useRef(false);

  const activeSessionId = resolveSessionId(session, sessionId);
  const currentQuestion = useMemo(() => getLatestTurnByRole(session?.transcript || [], 'ai'), [session?.transcript]);
  const latestUserTurn = useMemo(() => getLatestTurnByRole(session?.transcript || [], 'user'), [session?.transcript]);

  const setReadyState = useCallback(() => {
    if (!enabled) return;
    setVoiceState('ready');
    setVoiceStatus(buildVoiceStatus('success', 'Voice ready', 'Duplex Voice Agent is ready. KiwiCoach can listen, speak, and handle interruption.'));
  }, [enabled]);

  const audioQueue = useAssistantAudioQueue({
    onPlaybackStart: () => {
      isAssistantSpeakingRef.current = true;
      voiceTraceRef.current?.mark('assistant_audio_play_start');
      setVoiceState('ai_speaking');
      setVoiceStatus(buildVoiceStatus('success', 'KiwiCoach is speaking', 'You can interrupt naturally by speaking.'));
    },
    onPlaybackEnd: () => {
      voiceTraceRef.current?.mark('assistant_audio_play_end');
    },
    onQueueDrained: () => {
      isAssistantSpeakingRef.current = false;
      if (autoLoopActiveRef.current && !isPaused && !isCompleted && !isProcessingTurn) {
        window.setTimeout(() => startListeningRef.current?.(), MIC_ARM_DELAY_MS);
      } else if (!isPaused && !isCompleted) {
        setReadyState();
      }
    },
  });

  const duplexSocket = useDuplexVoiceSocket({
    onAudioChunk: (chunk) => {
      voiceTraceRef.current?.mark('tts_audio_chunk_received', { index: chunk.index });
      audioQueue.enqueueAudioChunk(chunk);
    },
    onAssistantText: (payload) => {
      setAssistantTextPreview((current) => `${current}${payload.text || ''}`);
    },
    onSpeechDone: () => {
      setIsProcessingTurn(false);
    },
    onTurnDone: (payload) => {
      setIsProcessingTurn(false);
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
      voiceTraceRef.current?.mark('barge_in_ack');
      setVoiceStatus(buildVoiceStatus('info', 'Interrupted', 'KiwiCoach stopped speaking and is listening to you.'));
    },
  });

  const realtimeMic = useRealtimeMicStream({ onAudioChunk: duplexSocket.sendAudioChunk });

  const stopListening = useCallback(async (reason = 'speech_end') => {
    voiceTraceRef.current?.mark('speech_end', { reason });
    vad.stopVad?.();
    await realtimeMic.stopStream();
    duplexSocket.sendSpeechEnd(vadMetricsRef.current || null);
    setIsProcessingTurn(true);
    setVoiceState('agent_thinking');
    setVoiceStatus(buildVoiceStatus('info', 'Preparing next question', 'KiwiCoach is planning the next turn.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSocket, realtimeMic]);

  const handleVadSpeechStart = useCallback((metrics = {}) => {
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };
    voiceTraceRef.current?.mark('vad_speech_start', metrics);
    if (isAssistantSpeakingRef.current) {
      audioQueue.clearQueue();
      duplexSocket.sendBargeIn('user_started_speaking');
      setVoiceState('interrupted');
      setVoiceStatus(buildVoiceStatus('info', 'Interrupting KiwiCoach', 'Your voice interrupted the assistant. Keep speaking.'));
    } else {
      setVoiceState('user_speaking');
      setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Keep answering naturally. KiwiCoach will stop when you pause.'));
    }
  }, [audioQueue, duplexSocket]);

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
    const permissionResult = await requestPermission();
    if (!permissionResult.ok) {
      setVoiceState('permission_denied');
      setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', permissionResult.error || 'Allow microphone access to use Voice Mode.'));
      return;
    }
    try {
      noSpeechPromptedRef.current = false;
      setVoiceState('arming_mic');
      setVoiceStatus(buildVoiceStatus('info', 'Opening microphone', 'Duplex Voice Agent is ready to hear your answer.'));
      duplexSocket.sendSpeechStart();
      const stream = await realtimeMic.startStream();
      await vad.startVad({ stream, ignoreFirstMs: VAD_WARMUP_IGNORE_MS });
      setVoiceState('listening');
      setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Answer naturally. KiwiCoach will stop recording when you pause.'));
    } catch (error) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice failed', error.message || 'Could not start duplex voice.'));
    }
  }, [enabled, activeSessionId, isPaused, isCompleted, requestPermission, duplexSocket, realtimeMic, vad]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const speakCurrentQuestion = useCallback(() => {
    const questionText = String(currentQuestion?.displayText || currentQuestion?.text || '').trim();
    if (!questionText) return false;
    setAssistantTextPreview('');
    setVoiceState('ai_speaking');
    setVoiceStatus(buildVoiceStatus('info', 'KiwiCoach is speaking', 'Listen to the question. The microphone opens after the audio finishes.'));
    duplexSocket.speakText(questionText);
    return true;
  }, [currentQuestion, duplexSocket]);

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
      audioQueue.clearQueue();
      vad.stopVad?.();
      await realtimeMic.stopStream();
      duplexSocket.stopSession();
      setReadyState();
      return;
    }

    try {
      voiceTraceRef.current = createVoiceLatencyTrace({ sessionId: activeSessionId, mode: 'duplex_voice' });
      voiceTraceRef.current.mark('voice_loop_start');
      voiceTraceRef.current.mark('vad_config', { ...DEFAULT_VAD_CONFIG, warmupIgnoreMs: VAD_WARMUP_IGNORE_MS });
      autoLoopActiveRef.current = true;
      setIsAutoLoopActive(true);
      setVoiceState('starting');
      setVoiceStatus(buildVoiceStatus('info', 'Starting duplex voice interview', 'KiwiCoach will speak, listen, and allow interruption.'));
      await ensureDuplexConnected();
      const spoke = speakCurrentQuestion();
      if (!spoke) await startListening();
    } catch (error) {
      autoLoopActiveRef.current = false;
      setIsAutoLoopActive(false);
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Duplex voice failed', error.message || 'Could not start Voice Mode.'));
    }
  }, [enabled, isCompleted, isPaused, isSupported, isAutoLoopActive, realtimeMic, audioQueue, vad, duplexSocket, setReadyState, activeSessionId, ensureDuplexConnected, speakCurrentQuestion, startListening]);

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
    ensureDuplexConnected().then(() => speakCurrentQuestion()).catch(() => {});
    return true;
  }, [ensureDuplexConnected, speakCurrentQuestion]);

  const handleResetShell = useCallback(async () => {
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    audioQueue.clearQueue();
    vad.stopVad?.();
    await realtimeMic.stopStream();
    duplexSocket.closeSocket();
    setTranscriptionPreview('');
    setPendingTranscript(null);
    setEditableTranscript('');
    setLastAsrConfidence(null);
    setAssistantTextPreview('');
    setReadyState();
  }, [audioQueue, vad, realtimeMic, duplexSocket, setReadyState]);

  useEffect(() => {
    if (permissionState === 'granted' && voiceState === 'idle') setReadyState();
  }, [permissionState, voiceState, setReadyState]);

  useEffect(() => {
    if (duplexSocket.partialTranscript) setTranscriptionPreview(duplexSocket.partialTranscript);
  }, [duplexSocket.partialTranscript]);

  useEffect(() => {
    if (!duplexSocket.finalTranscript?.displayText) return;
    setTranscriptionPreview(duplexSocket.finalTranscript.displayText);
    setPendingTranscript(duplexSocket.finalTranscript);
    setEditableTranscript(duplexSocket.finalTranscript.displayText);
    setLastAsrConfidence(duplexSocket.finalTranscript.confidence ?? null);
  }, [duplexSocket.finalTranscript]);

  useEffect(() => {
    if (!duplexSocket.socketError) return;
    setVoiceState('error');
    setVoiceStatus(buildVoiceStatus('error', 'Duplex voice failed', duplexSocket.socketError));
  }, [duplexSocket.socketError]);

  useEffect(() => {
    cleanupRef.current = () => {
      audioQueue.clearQueue();
      vad.stopVad?.();
      realtimeMic.stopStream();
      duplexSocket.closeSocket();
    };
  }, [audioQueue, vad, realtimeMic, duplexSocket]);

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
      case 'agent_thinking': return 'Planning next turn';
      case 'error': return 'Voice error';
      default: return 'Idle';
    }
  }, [voiceState]);

  const transcript = session?.transcript || [];
  const liveTranscript = useMemo(() => transcript.slice(-8), [transcript]);
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
    canUseVoice,
    levelHistory: realtimeMic.levelHistory,
    recordingDurationMs: realtimeMic.durationMs,
    recordingDurationLabel: formatDurationLabel(realtimeMic.durationMs),
    transcriptionPreview: transcriptionPreview || assistantTextPreview,
    assistantAudioUrl: audioQueue.assistantAudioUrl,
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
    handleAudioFileSelect: () => {},
    handleSubmitSelectedAudio: () => {},
    setBackupText: () => {},
    setIsBackupExpanded: () => {},
    onPause,
    onRepeat,
    onEnd,
  };
}
