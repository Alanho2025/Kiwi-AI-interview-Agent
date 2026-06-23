import { useCallback, useEffect, useMemo } from 'react';
import { createVoiceLatencyTrace } from '../../utils/voiceLatencyTrace.js';
import { DEFAULT_VAD_CONFIG } from '../../utils/voiceActivityDetectionCore.js';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE_NAME,
  DUPLEX_CONNECTED_STATES,
  VAD_WARMUP_IGNORE_MS,
} from './voiceSessionConstants.js';
import { buildVoiceStatus, getLatestAssistantQuestionText } from './voiceSessionHelpers.js';

export function useVoiceSessionLifecycleController({
  enabled,
  session,
  activeSessionId,
  isPaused,
  isCompleted,
  isSupported,
  isAutoLoopActive,
  isMicStreaming,
  isProcessingTurn,
  refs,
  audioQueue,
  latency,
  vad,
  clearPendingBargeIn,
  clearPendingSpeechEnd,
  connectDuplexSocket,
  closeDuplexSocket,
  duplexSocketState,
  speakText,
  stopSession,
  micMediaStream,
  requestPermission,
  sessionAudioRecorder,
  setAssistantTextPreview,
  setEditableTranscript,
  setIsAutoLoopActive,
  setIsVoiceTakingLong,
  setLastAsrConfidence,
  setLastTranscriptRejection,
  setPendingTranscript,
  setReadyState,
  setSendAudio,
  setTranscriptionPreview,
  setVoiceState,
  setVoiceStatus,
  startStream,
  stopStream,
  onStartInterview,
}) {
  const {
    autoLoopActiveRef,
    voiceSessionTraceRef,
    activeVoiceTurnTraceRef,
    firstAudioChunkSeenRef,
    noSpeechPromptedRef,
    startListeningRef,
    isAssistantSpeakingRef,
    speechStartSentRef,
  } = refs;

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
    setVoiceState,
    setVoiceStatus,
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

    setSendAudio?.(false);
    setAssistantTextPreview('');
    firstAudioChunkSeenRef.current = false;
    setVoiceState('ai_speaking');
    setVoiceStatus(buildVoiceStatus('info', 'KiwiCoach is speaking', statusMessage));
    speakText(cleanQuestion);
    return true;
  }, [firstAudioChunkSeenRef, setAssistantTextPreview, setSendAudio, setVoiceState, setVoiceStatus, speakText]);

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
    setVoiceState,
    setVoiceStatus,
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
    setSendAudio?.(false);
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
    setIsAutoLoopActive,
    setReadyState,
    setSendAudio,
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
      await startListening();
      window.setTimeout(async () => {
        if (!autoLoopActiveRef.current) return;

        const spoke = speakQuestionText(firstQuestionText);
        if (!spoke) {
          await startListening();
          return;
        }

        startPassiveMicMonitor().catch((error) => {
          console.error('Failed to start passive mic monitor', error);
        });
      }, 400);
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
    setIsAutoLoopActive,
    setVoiceState,
    setVoiceStatus,
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
  }, [requestPermission, setReadyState, setVoiceState, setVoiceStatus]);

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
    setSendAudio?.(false);
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
    setAssistantTextPreview,
    setEditableTranscript,
    setIsAutoLoopActive,
    setIsVoiceTakingLong,
    setLastAsrConfidence,
    setLastTranscriptRejection,
    setPendingTranscript,
    setReadyState,
    setSendAudio,
    setTranscriptionPreview,
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

  const finalizeLocalRecording = useCallback(
    () => sessionAudioRecorder.finalizeLocalRecording(),
    [sessionAudioRecorder],
  );

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
    setSendAudio?.(false);
    vad.stopVad?.();
    stopSession();
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
    setIsAutoLoopActive,
    setSendAudio,
    setVoiceState,
    setVoiceStatus,
    speechStartSentRef,
    stopSession,
    stopStream,
    vad,
    voiceSessionTraceRef,
  ]);

  return useMemo(() => ({
    finalizeLocalRecording,
    handleRequestPermission,
    handleReplayAssistantAudio,
    handleResetShell,
    handleRetryVoice,
    handleToggleRecording,
    speakQuestionText,
    stopVoiceSession,
  }), [
    finalizeLocalRecording,
    handleReplayAssistantAudio,
    handleRequestPermission,
    handleResetShell,
    handleRetryVoice,
    handleToggleRecording,
    speakQuestionText,
    stopVoiceSession,
  ]);
}
