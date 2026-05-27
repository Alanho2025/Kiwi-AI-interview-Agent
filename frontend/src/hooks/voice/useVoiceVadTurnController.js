import { useCallback, useRef } from 'react';
import { DEFAULT_VAD_CONFIG } from '../../utils/voiceActivityDetectionCore.js';
import { useVoiceActivityDetection } from './useVoiceActivityDetection.js';
import { BARGE_IN_CONFIRMATION_MS, SPEECH_END_CONFIRMATION_MS } from './voiceSessionConstants.js';
import { buildVoiceStatus } from './voiceSessionHelpers.js';

export function useVoiceVadTurnController({
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
  startVoiceTurnTrace,
  scheduleLatencyAcknowledgement,
  stopLatencyAcknowledgement,
}) {
  const {
    autoLoopActiveRef,
    activeVoiceTurnTraceRef,
    vadMetricsRef,
    noSpeechPromptedRef,
    isAssistantSpeakingRef,
    pendingBargeInRef,
    pendingSpeechEndTimerRef,
    pendingSpeechEndMetricsRef,
    speechStartSentRef,
    voiceSessionTraceRef,
  } = refs;

  const isFinalizingSpeechEndRef = useRef(false);

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

  const sendSpeechStartIfNeeded = useCallback(() => {
    if (speechStartSentRef.current) return false;
    speechStartSentRef.current = true;
    setSendAudio?.(false);
    const sent = sendSpeechStart();
    if (!sent) {
      speechStartSentRef.current = false;
      setSendAudio?.(false);
    }
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
  }, [audioQueue, isAssistantSpeakingRef, pendingBargeInRef, sendBargeIn, sendSpeechStartIfNeeded, setVoiceState, setVoiceStatus]);

  const stopListening = useCallback(async (reason = 'speech_end') => {
    if (isFinalizingSpeechEndRef.current) return false;
    isFinalizingSpeechEndRef.current = true;

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
    return true;
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
    isFinalizingSpeechEndRef.current = false;
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
    setLastTranscriptRejection,
    setVoiceState,
    setVoiceStatus,
    stopLatencyAcknowledgement,
    vadMetricsRef,
    voiceSessionTraceRef,
  ]);

  const handleVadSpeechEnd = useCallback((metrics = {}) => {
    clearPendingBargeIn();
    pendingSpeechEndMetricsRef.current = metrics;
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };

    if (isFinalizingSpeechEndRef.current) return;

    if (pendingSpeechEndTimerRef.current) {
      console.log('[FRONTEND-STT-TRACE] VAD speech_end already pending. Keeping existing final submit timer.', metrics);
      return;
    }

    console.log('[FRONTEND-STT-TRACE] VAD possible speech_end detected. Waiting before final submit.', metrics);
    setVoiceStatus(buildVoiceStatus('info', 'Still listening', 'Pause detected. Continue speaking if you have more to add.'));

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
    setVoiceStatus,
    stopListening,
    vadMetricsRef,
  ]);

  const handleNoSpeechTimeout = useCallback(() => {
    if (!autoLoopActiveRef.current || noSpeechPromptedRef.current) return;
    noSpeechPromptedRef.current = true;
    setVoiceStatus(buildVoiceStatus('info', 'Take your time', 'Start answering when you are ready.'));
  }, [autoLoopActiveRef, noSpeechPromptedRef, setVoiceStatus]);

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

  return {
    vad,
    clearPendingBargeIn,
    clearPendingSpeechEnd,
    sendSpeechStartIfNeeded,
    stopListening,
  };
}
