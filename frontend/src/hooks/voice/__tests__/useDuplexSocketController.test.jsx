import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDuplexVoiceSocket } from '../useDuplexVoiceSocket.js';
import { useDuplexSocketController } from '../useDuplexSocketController.js';

vi.mock('../useDuplexVoiceSocket.js', () => ({
  useDuplexVoiceSocket: vi.fn(() => ({ socketState: 'ready' })),
}));

const ref = (current = null) => ({ current });

describe('useDuplexSocketController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('leaves processing state and asks for a retry when backend rejects an unbound turn', () => {
    const setters = {
      setIsProcessingTurn: vi.fn(),
      setIsVoiceTakingLong: vi.fn(),
      setLastTranscriptRejection: vi.fn(),
      setPendingTranscript: vi.fn(),
      setEditableTranscript: vi.fn(),
      setLastAsrConfidence: vi.fn(),
      setVoiceState: vi.fn(),
      setVoiceStatus: vi.fn(),
    };
    const speechStartSentRef = ref(true);

    renderHook(() => useDuplexSocketController({
      refs: {
        autoLoopActiveRef: ref(true),
        activeVoiceTurnTraceRef: ref(null),
        activeBackendLatencyRef: ref(null),
        speechStartSentRef,
        voiceSessionTraceRef: ref(null),
      },
      audioQueue: { enqueueAudioChunk: vi.fn() },
      onVoiceSessionUpdate: vi.fn(),
      setAssistantTextPreview: vi.fn(),
      setIsAutoLoopActive: vi.fn(),
      stopLatencyAcknowledgement: vi.fn(),
      handleFirstAudioChunk: vi.fn(),
      logVoiceLatencySummary: vi.fn(),
      ...setters,
    }));

    const options = vi.mocked(useDuplexVoiceSocket).mock.calls[0][0];
    options.onTurnRejected({
      code: 'VOICE_TURN_NOT_ACTIVE',
      clientTurnId: 'voice-turn-1-1',
      retryable: true,
    });

    expect(setters.setIsProcessingTurn).toHaveBeenCalledWith(false);
    expect(setters.setIsVoiceTakingLong).toHaveBeenCalledWith(false);
    expect(speechStartSentRef.current).toBe(false);
    expect(setters.setVoiceState).toHaveBeenCalledWith('repair_prompt');
    expect(setters.setVoiceStatus).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning',
      title: 'Voice turn was not received',
    }));
  });
});
