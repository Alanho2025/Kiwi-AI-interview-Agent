import { useAssistantAudioQueue } from './useAssistantAudioQueue.js';
import { MIC_ARM_DELAY_MS } from './voiceSessionConstants.js';
import { buildVoiceStatus } from './voiceSessionHelpers.js';

const hasCurrentTurnFirstAudioChunk = (trace = null) => {
  const snapshot = trace?.toJSON?.();
  const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
  const turnId = snapshot?.turnId || null;

  return events.some((event) => (
    event?.name === 'first_audio_chunk_received'
    && (!turnId || event.turnId === turnId)
  ));
};

const hasCurrentTurnEvent = (trace = null, eventName = '') => {
  const snapshot = trace?.toJSON?.();
  const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
  const turnId = snapshot?.turnId || null;

  return events.some((event) => (
    event?.name === eventName
    && (!turnId || event.turnId === turnId)
  ));
};

export function useAssistantPlaybackController({
  refs,
  isPaused,
  isCompleted,
  isProcessingTurn,
  setReadyState,
  setVoiceState,
  setVoiceStatus,
  clearPendingBargeIn,
  stopLatencyAcknowledgement,
  logVoiceLatencySummary,
  setSendAudio,
}) {
  const {
    autoLoopActiveRef,
    activeVoiceTurnTraceRef,
    activeBackendLatencyRef,
    firstAudioChunkSeenRef,
    voiceLatencyTraceSenderRef,
    startListeningRef,
    isAssistantSpeakingRef,
  } = refs;

  return useAssistantAudioQueue({
    onPlaybackStart: () => {
      console.log('[FRONTEND-TTS-TRACE] Assistant audio playback started.');
      stopLatencyAcknowledgement();
      isAssistantSpeakingRef.current = true;
      setSendAudio?.(false);


      const activeTrace = activeVoiceTurnTraceRef.current;
      if (firstAudioChunkSeenRef.current && hasCurrentTurnFirstAudioChunk(activeTrace)) {
        activeTrace?.mark('assistant_audio_play_start');
        if (!hasCurrentTurnEvent(activeTrace, 'voice_latency_trace_sent')) {
          voiceLatencyTraceSenderRef.current?.(activeTrace?.toJSON?.());
          activeTrace?.mark('voice_latency_trace_sent');
        }
        logVoiceLatencySummary('assistant_playback_start', activeBackendLatencyRef.current);
      } else {
        console.warn('[voice-latency] Skipping assistant playback latency mark because the active trace does not match the current TTS audio chunk.', {
          hasFirstAudioChunk: firstAudioChunkSeenRef.current,
          activeTurnId: activeTrace?.toJSON?.()?.turnId || null,
        });
      }

      setVoiceState('ai_speaking');
      setVoiceStatus(buildVoiceStatus('success', 'KiwiCoach is speaking', 'You can interrupt naturally by speaking.'));
    },
    onPlaybackEnd: () => {
      const activeTrace = activeVoiceTurnTraceRef.current;
      if (firstAudioChunkSeenRef.current && hasCurrentTurnFirstAudioChunk(activeTrace)) {
        activeTrace?.mark('assistant_audio_play_end');
      }
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
}
