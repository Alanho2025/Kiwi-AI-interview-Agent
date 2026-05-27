import { useAssistantAudioQueue } from './useAssistantAudioQueue.js';
import { MIC_ARM_DELAY_MS } from './voiceSessionConstants.js';
import { buildVoiceStatus } from './voiceSessionHelpers.js';

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
}) {
  const {
    autoLoopActiveRef,
    activeVoiceTurnTraceRef,
    activeBackendLatencyRef,
    startListeningRef,
    isAssistantSpeakingRef,
  } = refs;

  return useAssistantAudioQueue({
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
}
