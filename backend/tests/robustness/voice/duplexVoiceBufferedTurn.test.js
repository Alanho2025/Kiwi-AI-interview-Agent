import { beforeEach, describe, expect, it, vi } from 'vitest';

const { realtimeState, processFinalTranscriptMock } = vi.hoisted(() => ({
  realtimeState: {
    config: null,
    session: null,
    stopFail: false,
    stopHang: false,
  },
  processFinalTranscriptMock: vi.fn(),
}));

vi.mock('../../../src/services/voice/realtimeSpeechSessionService.js', () => ({
  createRealtimeSpeechSession: vi.fn((config) => {
    realtimeState.config = config;
    realtimeState.session = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(async () => {
        if (realtimeState.stopFail) throw new Error('stt final timeout');
        if (realtimeState.stopHang) return new Promise(() => {});
      }),
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
  it('returns a retryable rejection when speech_end has no active client turn', async () => {
    const sent = [];
    const duplexSession = createDuplexVoiceAgentSession({
      socket: {},
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: { id: 'session-1', userId: 'user-1' },
      userId: 'user-1',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      sendJson: (payload) => sent.push(payload),
    });

    await duplexSession.handleJsonMessage({ type: 'speech_end', clientTurnId: 'voice-turn-1-1' });

    expect(sent).toContainEqual(expect.objectContaining({
      type: 'turn_rejected',
      code: 'VOICE_TURN_NOT_ACTIVE',
      clientTurnId: 'voice-turn-1-1',
      retryable: true,
    }));
    expect(processFinalTranscriptMock).not.toHaveBeenCalled();
  });

  it('abandons a mismatched active capture so the next retry can start cleanly', async () => {
    const sent = [];
    const duplexSession = createDuplexVoiceAgentSession({
      socket: {},
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: { id: 'session-1', userId: 'user-1' },
      userId: 'user-1',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      sendJson: (payload) => sent.push(payload),
    });

    await duplexSession.handleJsonMessage({ type: 'speech_start', clientTurnId: 'voice-turn-1-1' });
    await duplexSession.handleJsonMessage({ type: 'speech_end', clientTurnId: 'voice-turn-1-2' });
    await duplexSession.handleJsonMessage({ type: 'speech_start', clientTurnId: 'voice-turn-1-3' });

    expect(sent).toContainEqual(expect.objectContaining({
      type: 'turn_rejected',
      code: 'VOICE_TURN_ID_MISMATCH',
      clientTurnId: 'voice-turn-1-2',
    }));
    expect(sent).toContainEqual(expect.objectContaining({
      type: 'listening_started',
      clientTurnId: 'voice-turn-1-3',
    }));
    expect(processFinalTranscriptMock).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    realtimeState.config = null;
    realtimeState.session = null;
    realtimeState.stopFail = false;
    realtimeState.stopHang = false;
    delete process.env.VOICE_STT_TURN_STOP_TIMEOUT_MS;
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

  it('writes realtime audio chunks during active capture instead of waiting for speech_end', async () => {
    const sent = [];
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const duplexSession = createDuplexVoiceAgentSession({
      socket: {},
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: { id: 'session-1' },
      userId: 'user-1',
      logger,
      sendJson: (payload) => sent.push(payload),
    });

    const chunk = Buffer.alloc(3200);
    await duplexSession.handleJsonMessage({ type: 'speech_start' });
    await duplexSession.handleBinaryAudio(chunk);

    expect(realtimeState.session.writeAudio).toHaveBeenCalledTimes(1);
    expect(realtimeState.session.writeAudio).toHaveBeenCalledWith(chunk);
    expect(processFinalTranscriptMock).not.toHaveBeenCalled();

    realtimeState.config.onPartialTranscript({ text: 'I built an interview agent', provider: 'azure' });
    await duplexSession.handleJsonMessage({ type: 'speech_end', vad: { speechDurationMs: 1600 } });

    expect(processFinalTranscriptMock).toHaveBeenCalledWith(expect.objectContaining({
      transcriptText: 'I built an interview agent',
      vad: expect.objectContaining({
        audioChunksWritten: 1,
        audioMsWritten: 100,
        sttSource: 'partial_fallback',
      }),
    }));
    expect(logger.info).toHaveBeenCalledWith('Duplex realtime audio chunk written', expect.objectContaining({
      bytes: 3200,
      estimatedDurationMs: 100,
      encoding: 'pcm_s16le',
    }));
  });

  it('finalizes an active long answer before session_stop closes the STT stream', async () => {
    const sent = [];
    const duplexSession = createDuplexVoiceAgentSession({
      socket: {},
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: { id: 'session-1' },
      userId: 'user-1',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      sendJson: (payload) => sent.push(payload),
    });

    await duplexSession.handleJsonMessage({ type: 'speech_start' });
    realtimeState.config.onFinalTranscript({ displayText: 'First STAR point', confidence: 0.88 });
    realtimeState.config.onFinalTranscript({ displayText: 'second STAR point', confidence: 0.82 });

    await duplexSession.handleJsonMessage({ type: 'session_stop', vad: { speechDurationMs: 91000 } });

    expect(processFinalTranscriptMock).toHaveBeenCalledTimes(1);
    expect(processFinalTranscriptMock).toHaveBeenCalledWith(expect.objectContaining({
      transcriptText: 'First STAR point second STAR point',
      asrConfidence: expect.closeTo(0.85, 5),
      vad: expect.objectContaining({
        speechDurationMs: 91000,
        stopReason: 'session_stop',
        sttSegmentCount: 2,
        sttSource: 'final_segments',
      }),
    }));
    expect(sent.some((payload) => payload.type === 'session_stopped')).toBe(true);
  });

  it('still hands the turn to transcript repair when STT stop fails before a final segment', async () => {
    const sent = [];
    realtimeState.stopFail = true;
    const duplexSession = createDuplexVoiceAgentSession({
      socket: {},
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: { id: 'session-1' },
      userId: 'user-1',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      sendJson: (payload) => sent.push(payload),
    });

    await duplexSession.handleJsonMessage({ type: 'speech_start' });
    await duplexSession.handleJsonMessage({ type: 'speech_end', vad: { speechDurationMs: 4200 } });

    expect(processFinalTranscriptMock).toHaveBeenCalledTimes(1);
    expect(processFinalTranscriptMock).toHaveBeenCalledWith(expect.objectContaining({
      transcriptText: '',
      asrConfidence: null,
      vad: expect.objectContaining({
        speechDurationMs: 4200,
        sttSegmentCount: 0,
        sttStopError: 'stt final timeout',
      }),
    }));
  });

  it('does not let a hung STT stop block turn repair', async () => {
    const sent = [];
    realtimeState.stopHang = true;
    process.env.VOICE_STT_TURN_STOP_TIMEOUT_MS = '5';
    const duplexSession = createDuplexVoiceAgentSession({
      socket: {},
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: { id: 'session-1' },
      userId: 'user-1',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      sendJson: (payload) => sent.push(payload),
    });

    await duplexSession.handleJsonMessage({ type: 'speech_start' });
    await duplexSession.handleJsonMessage({ type: 'speech_end', vad: { speechDurationMs: 5100 } });

    expect(processFinalTranscriptMock).toHaveBeenCalledTimes(1);
    expect(processFinalTranscriptMock).toHaveBeenCalledWith(expect.objectContaining({
      transcriptText: '',
      asrConfidence: null,
      vad: expect.objectContaining({
        speechDurationMs: 5100,
        sttSegmentCount: 0,
        sttStopError: 'Timed out waiting 5ms for realtime STT stop/finalize.',
      }),
    }));
  });

  it('uses the latest partial transcript when ElevenLabs VAD has not committed a final segment yet', async () => {
    const sent = [];
    const duplexSession = createDuplexVoiceAgentSession({
      socket: {},
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: { id: 'session-1' },
      userId: 'user-1',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      sendJson: (payload) => sent.push(payload),
    });

    await duplexSession.handleJsonMessage({ type: 'speech_start' });
    realtimeState.config.onPartialTranscript({
      text: 'I improved the support workflow by automating reports and checking results with stakeholders',
      provider: 'elevenlabs_realtime',
    });
    await duplexSession.handleJsonMessage({ type: 'speech_end', vad: { speechDurationMs: 6500 } });

    expect(processFinalTranscriptMock).toHaveBeenCalledTimes(1);
    expect(processFinalTranscriptMock).toHaveBeenCalledWith(expect.objectContaining({
      transcriptText: 'I improved the support workflow by automating reports and checking results with stakeholders',
      vad: expect.objectContaining({
        speechDurationMs: 6500,
        sttSegmentCount: 1,
        sttSource: 'partial_fallback',
        usedPartialFallback: true,
      }),
    }));
    expect(sent.some((payload) => payload.type === 'stt_partial')).toBe(true);
  });
});
