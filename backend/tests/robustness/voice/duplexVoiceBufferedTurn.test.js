import { beforeEach, describe, expect, it, vi } from 'vitest';

const { realtimeState, processFinalTranscriptMock } = vi.hoisted(() => ({
  realtimeState: {
    config: null,
    session: null,
  },
  processFinalTranscriptMock: vi.fn(),
}));

vi.mock('../../../src/services/voice/realtimeSpeechSessionService.js', () => ({
  createRealtimeSpeechSession: vi.fn((config) => {
    realtimeState.config = config;
    realtimeState.session = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      writeAudio: vi.fn(),
    };
    return realtimeState.session;
  }),
}));

vi.mock('../../../src/services/voice/duplexTurnCoordinator.js', () => ({
  createDuplexTurnCoordinator: vi.fn(() => ({
    processFinalTranscript: processFinalTranscriptMock,
  })),
}));

vi.mock('../../../src/services/voice/ttsStreamQueue.js', () => ({
  streamAssistantSpeech: vi.fn().mockResolvedValue(undefined),
}));

const { createDuplexVoiceAgentSession } = await import('../../../src/services/voice/duplexVoiceAgentService.js');

describe('duplex voice buffered turn handling', () => {
  beforeEach(() => {
    realtimeState.config = null;
    realtimeState.session = null;
    processFinalTranscriptMock.mockReset();
    processFinalTranscriptMock.mockResolvedValue({ updatedSession: { id: 'session-1' } });
  });

  it('buffers Azure final transcript segments and advances only after explicit speech_end', async () => {
    const sent = [];
    const duplexSession = createDuplexVoiceAgentSession({
      socket: {},
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: { id: 'session-1' },
      userId: 'user-1',
      logger: { info: vi.fn(), error: vi.fn() },
      sendJson: (payload) => sent.push(payload),
    });

    await duplexSession.handleJsonMessage({ type: 'speech_start' });

    await realtimeState.config.onFinalTranscript({ displayText: 'I used Python', confidence: 0.9 });
    await realtimeState.config.onFinalTranscript({ displayText: 'and Azure in my project.', confidence: 0.8 });

    expect(processFinalTranscriptMock).not.toHaveBeenCalled();

    await duplexSession.handleJsonMessage({ type: 'speech_end', vad: { speechDurationMs: 8200 } });

    expect(processFinalTranscriptMock).toHaveBeenCalledTimes(1);
    expect(processFinalTranscriptMock).toHaveBeenCalledWith(expect.objectContaining({
      transcriptText: 'I used Python and Azure in my project.',
      asrConfidence: expect.closeTo(0.85, 5),
      vad: expect.objectContaining({ speechDurationMs: 8200, sttSegmentCount: 2, sttSource: 'final_segments' }),
    }));
    expect(sent.some((payload) => payload.type === 'stt_final')).toBe(true);
  });
});
