import { useCallback, useMemo, useRef } from 'react';
import { createVoiceLatencyTrace } from '../../utils/voiceLatencyTrace.js';
import { buildVoiceLatencyDebugSummary, buildVoiceLatencyTargetSummary } from '../../utils/voiceLatencySummary.js';
import { DEFAULT_VAD_CONFIG } from '../../utils/voiceActivityDetectionCore.js';
import { assessVoiceNetworkQuality } from '../../utils/voiceRuntimeNetwork.js';
import { cancelLatencyAcknowledgement, playLatencyAcknowledgement } from '../../utils/voiceLatencyAcknowledgement.js';
import {
  LATENCY_ACK_COOLDOWN_MS,
  LATENCY_ACK_DELAY_MS,
  SLOW_FIRST_AUDIO_MS,
  VAD_WARMUP_IGNORE_MS,
} from './voiceSessionConstants.js';

const BLOCKED_ACK_REASONS = new Set([
  'session_start',
  'session_complete',
  'transcript_confirmation',
  'transcript_rejected',
  'repair_prompt',
  'clear_follow_up',
]);

const CLEAR_NEXT_ACTIONS = new Set([
  'ASK_NEXT_PLANNED_QUESTION',
  'ASK_INTRO_QUESTION',
  'ASK_CLOSING_QUESTION',
]);

const shouldPlayInterviewerBridge = ({
  firstAudioSeen,
  autoLoopActive,
  recentlyPlayed,
  turnReason,
  answerWordCount,
  expectedNextAction,
}) => {
  if (!autoLoopActive) return false;
  if (firstAudioSeen) return false;
  if (recentlyPlayed) return false;
  if (answerWordCount > 0 && answerWordCount < 8) return false;
  if (BLOCKED_ACK_REASONS.has(turnReason)) return false;
  if (CLEAR_NEXT_ACTIONS.has(expectedNextAction)) return false;
  return true;
};

export function useVoiceLatencyController({
  activeSessionId,
  refs,
  setVoiceNetworkQuality,
}) {
  const {
    autoLoopActiveRef,
    activeVoiceTurnTraceRef,
    activeBackendLatencyRef,
    voiceTurnSequenceRef,
    latestSocketLatencyRef,
    firstAudioChunkSeenRef,
    activeVoiceTurnStartedAtRef,
    latestFirstAudioDelayRef,
    consecutiveSlowTurnsRef,
    latencyAcknowledgementTimerRef,
    lastLatencyAcknowledgementAtRef,
  } = refs;
  const latencyAcknowledgementUsedPhrasesRef = useRef(new Set());

  const logVoiceLatencySummary = useCallback((phase = 'turn', backendLatency = null) => {
    const trace = activeVoiceTurnTraceRef.current?.toJSON?.();
    if (!trace && !backendLatency) return;

    const targetSummary = buildVoiceLatencyTargetSummary({ trace, backendLatency, phase });
    const debugSummary = buildVoiceLatencyDebugSummary({ trace, backendLatency, phase });

    console.info('[voice-latency] target', targetSummary);
    console.debug('[voice-latency:debug]', debugSummary);
    if (typeof console.table === 'function') console.table(targetSummary);
  }, [activeVoiceTurnTraceRef]);

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
  }, [consecutiveSlowTurnsRef, latestFirstAudioDelayRef, latestSocketLatencyRef, setVoiceNetworkQuality]);

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

  const clearLatencyAcknowledgementTimer = useCallback(() => {
    if (!latencyAcknowledgementTimerRef.current) return;
    window.clearTimeout(latencyAcknowledgementTimerRef.current);
    latencyAcknowledgementTimerRef.current = null;
  }, [latencyAcknowledgementTimerRef]);

  const stopLatencyAcknowledgement = useCallback(() => {
    clearLatencyAcknowledgementTimer();
    cancelLatencyAcknowledgement();
  }, [clearLatencyAcknowledgementTimer]);

  const scheduleLatencyAcknowledgement = useCallback((context = {}) => {
    clearLatencyAcknowledgementTimer();

    latencyAcknowledgementTimerRef.current = window.setTimeout(() => {
      const now = Date.now();
      const recentlyPlayed = now - lastLatencyAcknowledgementAtRef.current < LATENCY_ACK_COOLDOWN_MS;

      const shouldPlay = shouldPlayInterviewerBridge({
        firstAudioSeen: firstAudioChunkSeenRef.current,
        autoLoopActive: autoLoopActiveRef.current,
        recentlyPlayed,
        turnReason: context.reason,
        answerWordCount: context.answerWordCount || 0,
        expectedNextAction: context.expectedNextAction || null,
      });

      if (!shouldPlay) return;

      const phrase = playLatencyAcknowledgement({
        usedPhrases: [...latencyAcknowledgementUsedPhrasesRef.current],
        expectedNextAction: context.expectedNextAction || null,
        currentSection: context.currentSection || null,
        questionType: context.questionType || null,
        onStart: () => {
          activeVoiceTurnTraceRef.current?.mark('latency_acknowledgement_play_start', {
            source: 'deterministic_browser_bridge',
          });
        },
      });

      if (phrase) {
        latencyAcknowledgementUsedPhrasesRef.current.add(phrase);
        lastLatencyAcknowledgementAtRef.current = now;
      }
    }, LATENCY_ACK_DELAY_MS);
  }, [
    activeVoiceTurnTraceRef,
    autoLoopActiveRef,
    clearLatencyAcknowledgementTimer,
    firstAudioChunkSeenRef,
    lastLatencyAcknowledgementAtRef,
    latencyAcknowledgementTimerRef,
  ]);

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

  return useMemo(() => ({
    logVoiceLatencySummary,
    startVoiceTurnTrace,
    updateVoiceNetworkQuality,
    clearLatencyAcknowledgementTimer,
    stopLatencyAcknowledgement,
    scheduleLatencyAcknowledgement,
    handleFirstAudioChunk,
    resetVoiceTraceState,
  }), [
    clearLatencyAcknowledgementTimer,
    handleFirstAudioChunk,
    logVoiceLatencySummary,
    resetVoiceTraceState,
    scheduleLatencyAcknowledgement,
    startVoiceTurnTrace,
    stopLatencyAcknowledgement,
    updateVoiceNetworkQuality,
  ]);
}
