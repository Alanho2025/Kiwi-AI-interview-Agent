import { useCallback, useRef } from 'react';
import { DEFAULT_VAD_CONFIG } from '../../utils/voiceActivityDetectionCore.js';
import { useVoiceActivityDetection } from './useVoiceActivityDetection.js';
import { BARGE_IN_CONFIRMATION_MS, SPEECH_END_CONFIRMATION_MS } from './voiceSessionConstants.js';
import { buildVoiceStatus } from './voiceSessionHelpers.js';

const traceVadTurn = (event, payload = {}) => {
  console.log('[FRONTEND-VAD-TURN-TRACE]', event, {
    at: Date.now(),
    ...payload,
  });
};

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
    console.log('[FRONTEND-VAD-TURN-TRACE] clearPendingSpeechEnd', {
      at: Date.now(),
      hadTimer: Boolean(pendingSpeechEndTimerRef.current),
      pendingMetrics: pendingSpeechEndMetricsRef.current,
    });
    if (pendingSpeechEndTimerRef.current) {
      window.clearTimeout(pendingSpeechEndTimerRef.current);
      pendingSpeechEndTimerRef.current = null;
    }
    pendingSpeechEndMetricsRef.current = null;
  }, [pendingSpeechEndMetricsRef, pendingSpeechEndTimerRef]);

  const sendSpeechStartIfNeeded = useCallback(() => {
    traceVadTurn('sendSpeechStartIfNeeded_start', {
      speechStartAlreadySent: speechStartSentRef.current,
      hasMicMediaStream: Boolean(micMediaStream),
      isAssistantSpeaking: isAssistantSpeakingRef.current,
    });
    if (speechStartSentRef.current) {
      traceVadTurn('sendSpeechStartIfNeeded_skip_already_sent');
      return false;
    }
    speechStartSentRef.current = true;
    setSendAudio?.(false);
    const sent = sendSpeechStart();
    traceVadTurn('sendSpeechStartIfNeeded_result', { sent });
    if (!sent) {
      speechStartSentRef.current = false;
      setSendAudio?.(false);
      traceVadTurn('sendSpeechStartIfNeeded_failed_reset');
    }
    return sent;
  }, [isAssistantSpeakingRef, micMediaStream, sendSpeechStart, setSendAudio, speechStartSentRef]);

  const confirmPendingBargeIn = useCallback(() => {
    const pending = pendingBargeInRef.current;
    traceVadTurn('confirmPendingBargeIn_start', {
      pending,
      isAssistantSpeaking: isAssistantSpeakingRef.current,
    });
    if (!pending || pending.confirmed || !isAssistantSpeakingRef.current) return false;

    pendingBargeInRef.current = { ...pending, confirmed: true };
    sendSpeechStartIfNeeded();
    audioQueue.clearQueue();
    sendBargeIn('user_started_speaking');
    setVoiceState('interrupted');
    setVoiceStatus(buildVoiceStatus('info', 'Interrupting KiwiCoach', 'Your voice interrupted the assistant. Keep speaking.'));
    traceVadTurn('confirmPendingBargeIn_done');
    return true;
  }, [audioQueue, isAssistantSpeakingRef, pendingBargeInRef, sendBargeIn, sendSpeechStartIfNeeded, setVoiceState, setVoiceStatus]);

  const stopListening = useCallback(async (reason = 'speech_end') => {
    traceVadTurn('stopListening_start', {
      reason,
      isFinalizing: isFinalizingSpeechEndRef.current,
      speechStartSent: speechStartSentRef.current,
      vadMetrics: vadMetricsRef.current,
      pendingSpeechEndMetrics: pendingSpeechEndMetricsRef.current,
      hasPendingSpeechEndTimer: Boolean(pendingSpeechEndTimerRef.current),
    });
    if (isFinalizingSpeechEndRef.current) {
      traceVadTurn('stopListening_skip_already_finalizing', { reason });
      return false;
    }
    isFinalizingSpeechEndRef.current = true;

    clearPendingSpeechEnd();
    console.log(`[FRONTEND-STT-TRACE] Stopping listening. Reason: ${reason}`);
    const { turnId } = startVoiceTurnTrace(reason);
    traceVadTurn('stopListening_turn_trace_started', { reason, turnId });
    activeVoiceTurnTraceRef.current?.mark('auto_submit_start', { reason, turnId });
    activeVoiceTurnTraceRef.current?.mark('stt_stop_sent', { reason, turnId });
    traceVadTurn('stopListening_before_vad_stop', { reason, turnId });
    vad.stopVad?.();
    traceVadTurn('stopListening_after_vad_stop_before_speech_end', { reason, turnId });
    console.log('[FRONTEND-STT-TRACE] Sending speech_end to backend.');
    const speechEndSent = sendSpeechEnd(vadMetricsRef.current || null);
    traceVadTurn('stopListening_sendSpeechEnd_result', {
      reason,
      turnId,
      speechEndSent,
      vadMetrics: vadMetricsRef.current || null,
    });
    speechStartSentRef.current = false;
    setSendAudio?.(false);
    setIsProcessingTurn(true);
    setVoiceState('agent_thinking');
    setVoiceStatus(buildVoiceStatus('info', 'Processing your answer', 'KiwiCoach is preparing the next turn. This may take a few seconds.'));
    scheduleLatencyAcknowledgement();
    traceVadTurn('stopListening_done', { reason, turnId, speechEndSent });
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearPendingSpeechEnd, pendingSpeechEndMetricsRef, pendingSpeechEndTimerRef, scheduleLatencyAcknowledgement, sendSpeechEnd, setSendAudio, startVoiceTurnTrace]);

  const handleVadFrame = useCallback((frame = {}) => {
    const pending = pendingBargeInRef.current;
    if (!pending || pending.confirmed || !isAssistantSpeakingRef.current) return;

    const thresholds = frame.metrics?.thresholds || {};
    const speechThreshold = thresholds.speechThreshold || DEFAULT_VAD_CONFIG.speechThreshold;
    const silenceThreshold = thresholds.silenceThreshold || DEFAULT_VAD_CONFIG.silenceThreshold;
    const rms = Number(frame.rms || 0);

    if (rms <= silenceThreshold) {
      traceVadTurn('handleVadFrame_clear_pending_barge_in_due_to_silence', { rms, silenceThreshold, speechThreshold });
      clearPendingBargeIn();
      return;
    }
    if (rms < speechThreshold) return;
    if (frame.at - pending.startedAt >= BARGE_IN_CONFIRMATION_MS) confirmPendingBargeIn();
  }, [clearPendingBargeIn, confirmPendingBargeIn, isAssistantSpeakingRef, pendingBargeInRef]);

  const handleVadSpeechStart = useCallback((metrics = {}) => {
    traceVadTurn('handleVadSpeechStart_start', {
      metrics,
      isAssistantSpeaking: isAssistantSpeakingRef.current,
      speechStartSent: speechStartSentRef.current,
      isFinalizing: isFinalizingSpeechEndRef.current,
    });
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
      traceVadTurn('handleVadSpeechStart_pending_barge_in_created', { pendingBargeIn: pendingBargeInRef.current });
      return;
    }

    console.log('[FRONTEND-STT-TRACE] Arming microphone and sending speech_start.');
    const speechStartSent = sendSpeechStartIfNeeded();
    setVoiceState('user_speaking');
    setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Keep answering naturally. KiwiCoach will stop when you pause.'));
    traceVadTurn('handleVadSpeechStart_done', { speechStartSent, vadMetrics: vadMetricsRef.current });
  }, [
    clearPendingSpeechEnd,
    isAssistantSpeakingRef,
    pendingBargeInRef,
    sendSpeechStartIfNeeded,
    setLastTranscriptRejection,
    setVoiceState,
    setVoiceStatus,
    speechStartSentRef,
    stopLatencyAcknowledgement,
    vadMetricsRef,
    voiceSessionTraceRef,
  ]);

  const handleVadSpeechEnd = useCallback((metrics = {}) => {
    traceVadTurn('handleVadSpeechEnd_start', {
      metrics,
      isFinalizing: isFinalizingSpeechEndRef.current,
      hasPendingSpeechEndTimer: Boolean(pendingSpeechEndTimerRef.current),
      speechStartSent: speechStartSentRef.current,
    });
    clearPendingBargeIn();
    pendingSpeechEndMetricsRef.current = metrics;
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };

    if (isFinalizingSpeechEndRef.current) {
      traceVadTurn('handleVadSpeechEnd_skip_already_finalizing');
      return;
    }

    if (pendingSpeechEndTimerRef.current) {
      console.log('[FRONTEND-STT-TRACE] VAD speech_end already pending. Keeping existing final submit timer.', metrics);
      traceVadTurn('handleVadSpeechEnd_skip_timer_already_pending', { pendingSpeechEndMetrics: pendingSpeechEndMetricsRef.current });
      return;
    }

    console.log('[FRONTEND-STT-TRACE] VAD possible speech_end detected. Waiting before final submit.', metrics);
    setVoiceStatus(buildVoiceStatus('info', 'Still listening', 'Pause detected. Continue speaking if you have more to add.'));

    pendingSpeechEndTimerRef.current = window.setTimeout(async () => {
      traceVadTurn('speechEndTimer_fired', { pendingSpeechEndMetrics: pendingSpeechEndMetricsRef.current });
      pendingSpeechEndTimerRef.current = null;
      const finalMetrics = pendingSpeechEndMetricsRef.current || metrics;
      pendingSpeechEndMetricsRef.current = null;
      vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...finalMetrics };

      console.log('[FRONTEND-STT-TRACE] VAD speech_end confirmed after grace window.');
      traceVadTurn('speechEndTimer_before_stopListening', { finalMetrics, vadMetrics: vadMetricsRef.current });
      await stopListening('vad_speech_end_confirmed');
      traceVadTurn('speechEndTimer_after_stopListening', { finalMetrics });
    }, SPEECH_END_CONFIRMATION_MS);
    traceVadTurn('handleVadSpeechEnd_timer_started', { confirmationMs: SPEECH_END_CONFIRMATION_MS, metrics });
  }, [
    clearPendingBargeIn,
    pendingSpeechEndMetricsRef,
    pendingSpeechEndTimerRef,
    setVoiceStatus,
    speechStartSentRef,
    stopListening,
    vadMetricsRef,
  ]);

  const handleNoSpeechTimeout = useCallback(() => {
    traceVadTurn('handleNoSpeechTimeout', {
      autoLoopActive: autoLoopActiveRef.current,
      noSpeechPrompted: noSpeechPromptedRef.current,
    });
    if (!autoLoopActiveRef.current || noSpeechPromptedRef.current) return;
    noSpeechPromptedRef.current = true;
    setVoiceStatus(buildVoiceStatus('info', 'Take your time', 'Start answering when you are ready.'));
  }, [autoLoopActiveRef, noSpeechPromptedRef, setVoiceStatus]);

  const handleMaxAnswerTimeout = useCallback(async (metrics = {}) => {
    traceVadTurn('handleMaxAnswerTimeout_start', { metrics });
    clearPendingSpeechEnd();
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics, maxAnswerTimeout: true };
    await stopListening('vad_max_answer_timeout');
    traceVadTurn('handleMaxAnswerTimeout_done', { metrics });
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
