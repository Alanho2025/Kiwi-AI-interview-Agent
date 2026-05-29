import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processRealtimeVoiceTurn: vi.fn(),
  streamAssistantSpeech: vi.fn(),
  assessRealtimeVoiceTranscript: vi.fn(),
  generateVoiceMicroAcknowledgement: vi.fn(),
  prepareWarmContext: vi.fn(),
}));

vi.mock('../../../src/services/voice/realtimeVoiceTurnService.js', () => ({
  processRealtimeVoiceTurn: mocks.processRealtimeVoiceTurn,
}));

vi.mock('../../../src/services/voice/ttsStreamQueue.js', () => ({
  streamAssistantSpeech: mocks.streamAssistantSpeech,
}));

vi.mock('../../../src/services/voice/speechConfidenceGate.js', () => ({
  assessRealtimeVoiceTranscript: mocks.assessRealtimeVoiceTranscript,
}));

vi.mock('../../../src/services/voice/voiceAcknowledgementService.js', () => ({
  generateVoiceMicroAcknowledgement: mocks.generateVoiceMicroAcknowledgement,
}));

vi.mock('../../../src/services/voice/voiceTurnWarmContextService.js', () => ({
  default: {
    prepareWarmContext: mocks.prepareWarmContext,
  },
}));

const { createDuplexTurnCoordinator } = await import('../../../src/services/voice/duplexTurnCoordinator.js');

const createBargeInController = () => {
  const activeTokens = new Set();
  let nextToken = 1;
  return {
    startAssistantSpeech: vi.fn(() => {
      const token = `speech-${nextToken}`;
      nextToken += 1;
      activeTokens.add(token);
      return token;
    }),
    finishAssistantSpeech: vi.fn((token) => activeTokens.delete(token)),
    isTokenActive: vi.fn((token) => activeTokens.has(token)),
  };
};

const createCoordinator = ({ sendJson = vi.fn(), logger = null } = {}) => {
  const bargeInController = createBargeInController();
  const coordinator = createDuplexTurnCoordinator({
    session: {
      id: 'session-1',
      status: 'in_progress',
      currentQuestionIndex: 2,
      transcript: [],
      interviewPlan: {
        questionPool: [{ id: 'question-3', text: 'Next planned question' }],
        questions: [{ id: 'question-3', text: 'Next planned question' }],
      },
    },
    userId: 'user-1',
    voiceName: 'en-NZ-MollyNeural',
    language: 'en-NZ',
    asrSource: 'azure',
    sendJson,
    bargeInController,
    logger: logger || { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    clientTurnId: 'voice-turn-1-2',
  });
  return { coordinator, bargeInController, sendJson };
};

const validAssessment = {
  ok: true,
  decision: 'accept',
  reason: 'VALID_TRANSCRIPT',
  message: null,
  confidenceGate: { status: 'medium', shouldConfirm: false, shouldRecordAgain: false },
  metrics: { words: 20, characters: 120, speechDurationMs: 9000, sttSegmentCount: 2 },
};

describe('duplex turn delayed bridge sequencing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    process.env.VOICE_BRIDGE_DELAY_MS = '1200';
    mocks.assessRealtimeVoiceTranscript.mockReturnValue(validAssessment);
    mocks.generateVoiceMicroAcknowledgement.mockResolvedValue('That helps me understand the planning phase.');
    mocks.streamAssistantSpeech.mockResolvedValue(undefined);
    mocks.prepareWarmContext.mockResolvedValue('warm-cache-key');
  });

  it('starts realtime turn processing before the delayed bridge can speak', async () => {
    const { coordinator } = createCoordinator();
    let releaseTurn;
    const turnPromise = new Promise((resolve) => {
      releaseTurn = resolve;
    });

    mocks.processRealtimeVoiceTurn.mockImplementation(async ({ onSentence }) => {
      await turnPromise;
      await onSentence('What was the result?', 0);
      return {
        updatedSession: { id: 'session-1', status: 'in_progress', transcript: [] },
        transcription: { text: 'I explained the planning trade-off.' },
        agentResult: { isComplete: false, nextQuestionOrder: 3 },
        latency: { totalMs: 1000 },
      };
    });

    const processPromise = coordinator.processFinalTranscript({
      transcriptText: 'I explained the planning trade-off to the team before we built the first version.',
      asrConfidence: 0.85,
      vad: { speechDurationMs: 9000, sttSegmentCount: 2 },
    });

    await Promise.resolve();
    expect(mocks.processRealtimeVoiceTurn).toHaveBeenCalledTimes(1);
    expect(mocks.generateVoiceMicroAcknowledgement).not.toHaveBeenCalled();
    expect(mocks.streamAssistantSpeech).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1200);
    expect(mocks.generateVoiceMicroAcknowledgement).toHaveBeenCalledTimes(1);

    releaseTurn();
    await processPromise;

    expect(mocks.streamAssistantSpeech).toHaveBeenNthCalledWith(1, expect.objectContaining({
      text: 'That helps me understand the planning phase.',
      usageContext: expect.objectContaining({ source: 'duplex_bridge_acknowledgement' }),
    }));
    expect(mocks.streamAssistantSpeech).toHaveBeenNthCalledWith(2, expect.objectContaining({
      text: 'What was the result?',
      usageContext: expect.objectContaining({ source: 'duplex_interview_sentence' }),
    }));
  });

  it('cancels the bridge when the real sentence is ready before the delay', async () => {
    const { coordinator } = createCoordinator();
    mocks.processRealtimeVoiceTurn.mockImplementation(async ({ onSentence }) => {
      await onSentence('What was the result?', 0);
      return {
        updatedSession: { id: 'session-1', status: 'in_progress', transcript: [] },
        transcription: { text: 'I explained the planning trade-off.' },
        agentResult: { isComplete: false, nextQuestionOrder: 3 },
        latency: { totalMs: 800 },
      };
    });

    await coordinator.processFinalTranscript({
      transcriptText: 'I explained the planning trade-off to the team before we built the first version.',
      asrConfidence: 0.85,
      vad: { speechDurationMs: 9000, sttSegmentCount: 2 },
    });
    await vi.advanceTimersByTimeAsync(1200);

    expect(mocks.generateVoiceMicroAcknowledgement).not.toHaveBeenCalled();
    expect(mocks.streamAssistantSpeech).toHaveBeenCalledTimes(1);
    expect(mocks.streamAssistantSpeech).toHaveBeenCalledWith(expect.objectContaining({
      text: 'What was the result?',
      usageContext: expect.objectContaining({ source: 'duplex_interview_sentence' }),
    }));
  });
});
