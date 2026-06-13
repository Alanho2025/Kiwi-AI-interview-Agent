import { useRef } from 'react';

export function useVoiceSessionRefs() {
  return {
    autoLoopActiveRef: useRef(false),
    voiceSessionTraceRef: useRef(null),
    activeVoiceTurnTraceRef: useRef(null),
    activeBackendLatencyRef: useRef(null),
    voiceTurnSequenceRef: useRef(0),
    vadMetricsRef: useRef(null),
    latestSocketLatencyRef: useRef({}),
    firstAudioChunkSeenRef: useRef(false),
    activeVoiceTurnStartedAtRef: useRef(null),
    latestFirstAudioDelayRef: useRef(null),
    consecutiveSlowTurnsRef: useRef(0),
    latencyAcknowledgementTimerRef: useRef(null),
    lastLatencyAcknowledgementAtRef: useRef(0),
    voiceLatencyTraceSenderRef: useRef(null),
    noSpeechPromptedRef: useRef(false),
    completedCleanupDoneRef: useRef(false),
    startListeningRef: useRef(null),
    cleanupRef: useRef(null),
    isAssistantSpeakingRef: useRef(false),
    pendingBargeInRef: useRef(null),
    pendingSpeechEndTimerRef: useRef(null),
    pendingSpeechEndMetricsRef: useRef(null),
    speechStartSentRef: useRef(false),
  };
}
