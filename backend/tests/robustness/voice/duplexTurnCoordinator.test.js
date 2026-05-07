import { describe, expect, it, vi } from 'vitest';

const { processRealtimeVoiceTurnMock, streamAssistantSpeechMock } = vi.hoisted(() => ({
  processRealtimeVoiceTurnMock: vi.fn(),
  streamAssistantSpeechMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/services/voice/realtimeVoiceTurnService.js', () => ({
  processRealtimeVoiceTurn: processRealtimeVoiceTurnMock,
}));

vi.mock('../../../src/services/voice/ttsStreamQueue.js', () => ({
  streamAssistantSpeech: streamAssistantSpeechMock,
}));

const { createDuplexTurnCoordinator } = await import('../../../src/services/voice/duplexTurnCoordinator.js');

describe('duplex turn coordinator transcript repair', () => {
  it('asks for a spoken repeat instead of scoring low-confidence transcripts', async () => {
    const sent = [];
    const bargeInController = {
      startAssistantSpeech: vi.fn(() => 'speech-token'),
      finishAssistantSpeech: vi.fn(),
      isTokenActive: vi.fn(() => true),
    };
    const coordinator = createDuplexTurnCoordinator({
      session: { id: 'session-1' },
      userId: 'user-1',
      voiceName: 'en-NZ-MollyNeural',
      language: 'en-NZ',
      sendJson: (payload) => sent.push(payload),
      bargeInController,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    const result = await coordinator.processFinalTranscript({
      transcriptText: 'I used React Query with PostgreSQL and checked the result through integration tests.',
      asrConfidence: 0.2,
      vad: { speechDurationMs: 9000 },
    });

    expect(result.transcriptRejected).toBe(true);
    expect(processRealtimeVoiceTurnMock).not.toHaveBeenCalled();
    expect(streamAssistantSpeechMock).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('Please repeat'),
    }));
    expect(sent).toContainEqual(expect.objectContaining({
      type: 'transcript_rejected',
      reason: 'LOW_CONFIDENCE_TRANSCRIPT',
    }));
  });
});
