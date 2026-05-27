import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMicrophonePermission } from './useMicrophonePermission.js';
import { useRealtimeMicStream } from './voice/useRealtimeMicStream.js';
import { useSessionAudioRecorder } from './voice/useSessionAudioRecorder.js';
import { useVoiceSessionRefs } from './voice/useVoiceSessionRefs.js';
import { useVoiceLatencyController } from './voice/useVoiceLatencyController.js';
import { useAssistantPlaybackController } from './voice/useAssistantPlaybackController.js';
import { useDuplexSocketController } from './voice/useDuplexSocketController.js';
import { useVoiceVadTurnController } from './voice/useVoiceVadTurnController.js';
import { uploadSessionRecording } from '../api/recordingApi.js';
import { createVoiceLatencyTrace } from '../utils/voiceLatencyTrace.js';
import { DEFAULT_VAD_CONFIG } from '../utils/voiceActivityDetectionCore.js';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE_NAME,
  DUPLEX_CONNECTED_STATES,
  NETWORK_PING_INTERVAL_MS,
  RECORDING_VOICE_STATES,
  SLOW_PROCESSING_WARNING_MS,
  VAD_WARMUP_IGNORE_MS,
} from './voice/voiceSessionConstants.js';
import {
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
  const [voiceNetworkQuality, setVoiceNetworkQuality] = useState(null);

  const refs = useVoiceSessionRefs();
  const {
    autoLoopActiveRef,
    voiceSessionTraceRef,
    activeVoiceTurnTraceRef,
    latestSocketLatencyRef,
    firstAudioChunkSeenRef,
    noSpeechPromptedRef,
    completedCleanupDoneRef,
    startListeningRef,
    cleanupRef,
    isAssistantSpeakingRef,
    pendingBargeInRef,
    speechStartSentRef,
  } = refs;

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

  const latency = useVoiceLatencyController({
    activeSessionId,
    refs,
    setVoiceNetworkQuality,
  });

  useEffect(() => {
    latency.updateVoiceNetworkQuality();
  }, [latency]);

  const clearPendingBargeInForPlayback = useCallback(() => {
    pendingBargeInRef.current = null;
  }, [pendingBargeInRef]);

  const audioQueue = useAssistantPlaybackController({
    refs,
    isPaused,
    isCompleted,
    isProcessingTurn,
    setReadyState,
    setVoiceState,
    setVoiceStatus,
    clearPendingBargeIn: clearPendingBargeInForPlayback,
    stopLatencyAcknowledgement: latency.stopLatencyAcknowledgement,
    logVoiceLatencySummary: latency.logVoiceLatencySummary,
  });

  const duplexSocket = useDuplexSocketController({
    refs,
    audioQueue,
    onVoiceSessionUpdate,
    setAssistantTextPreview,
    setEditableTranscript,
    setIsAutoLoopActive,
    setIsProcessingTurn,
    setIsVoiceTakingLong,
    setLastAsrConfidence,
    setLastTranscriptRejection,
    setPendingTranscript,
    setVoiceState,
    setVoiceStatus,
    stopLatencyAcknowledgement: latency.stopLatencyAcknowledgement,
    handleFirstAudioChunk: latency.handleFirstAudioChunk,
    logVoiceLatencySummary: latency.logVoiceLatencySummary,
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

  const vadTurn = useVoiceVadTurnController({
    refs,
    enabled,
    micMediaStream,
    audioQueue,
    sendBargeIn,
    sendSpeechEnd,
    sendSpeechStart,
    setSendAudio,
    setIsProcessingTurn,
    setLastTranscriptRejection,
    setVoiceState,
    setVoiceStatus,
    startVoiceTurnTrace: latency.startVoiceTurnTrace,
    scheduleLatencyAcknowledgement: latency.scheduleLatencyAcknowledgement,
    stopLatencyAcknowledgement: latency.stopLatencyAcknowledgement,
  });

  const { vad, clearPendingBargeIn, clearPendingSpeechEnd, stopListening } = vadTurn;

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

  const stopActiveVoiceLoop = useCallback(async () => {
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    latency.stopLatencyAcknowledgement();
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
    latency,
    sessionAudioRecorder,
    setReadyState,
    speechStartSentRef,
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
      latency.resetVoiceTraceState();
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
    latency,
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
    latency.stopLatencyAcknowledgement();
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
    latency.resetVoiceTraceState();
    setReadyState();
  }, [
    audioQueue,
    autoLoopActiveRef,
    clearPendingBargeIn,
    clearPendingSpeechEnd,
    closeDuplexSocket,
    latency,
    sessionAudioRecorder,
    setReadyState,
    speechStartSentRef,
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

    latency.stopLatencyAcknowledgement();
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
    latency,
    speechStartSentRef,
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
    latency.stopLatencyAcknowledgement();
    setVoiceState('error');
    setVoiceStatus(buildVoiceStatus('error', 'Duplex voice failed', socketError));
  }, [latency, socketError]);

  useEffect(() => {
    latestSocketLatencyRef.current = duplexLatency || {};
    latency.updateVoiceNetworkQuality();
  }, [duplexLatency, latestSocketLatencyRef, latency]);

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
      latency.stopLatencyAcknowledgement();
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
    latency,
    sessionAudioRecorder,
    speechStartSentRef,
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
