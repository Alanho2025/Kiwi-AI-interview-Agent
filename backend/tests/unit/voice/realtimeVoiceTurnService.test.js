import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  appendTranscriptTurn,
  updateLatestTranscriptTurnMetadata,
  updateSession,
  runTask,
  synthesizeSpeech,
  getLatestQuestionForSession,
  saveInterviewAnswerWithDetails,
  enqueueBackgroundJob,
  loggerInfo,
} = vi.hoisted(() => ({
  appendTranscriptTurn: vi.fn(),
  updateLatestTranscriptTurnMetadata: vi.fn(),
  updateSession: vi.fn(),
  runTask: vi.fn(),
  synthesizeSpeech: vi.fn(),
  getLatestQuestionForSession: vi.fn(),
  saveInterviewAnswerWithDetails: vi.fn(),
  enqueueBackgroundJob: vi.fn(async (_name, job) => job()),
  loggerInfo: vi.fn(),
}));

vi.mock('../../../src/services/sessionService.js', () => ({
  appendTranscriptTurn,
  updateLatestTranscriptTurnMetadata,
  updateSession,
}));

vi.mock('../../../src/services/masterAiService.js', () => ({
  runTask,
}));

vi.mock('../../../src/services/voice/azureSpeechService.js', () => ({
  synthesizeSpeech,
}));

vi.mock('../../../src/services/session/sessionQuestionService.js', () => ({
  getLatestQuestionForSession,
}));

vi.mock('../../../src/services/interview/interviewSessionService.js', () => ({
  saveInterviewAnswerWithDetails,
}));

vi.mock('../../../src/jobs/backgroundJobQueue.js', () => ({
  enqueueBackgroundJob,
}));

vi.mock('../../../src/services/storageService.js', () => ({
  saveBufferToLocalStorage: vi.fn().mockResolvedValue({ storageKey: 'voice-output/assistant.mp3' }),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: loggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('processRealtimeVoiceTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLatestQuestionForSession.mockResolvedValue({ id: 'question-1' });
    runTask.mockResolvedValue({
      isComplete: false,
      nextQuestionOrder: 2,
      nextQuestion: 'What happened next?',
      interviewerTurn: { text: 'What happened next?' },
    });
    updateSession.mockResolvedValue({
      id: 'session-1',
      transcript: [{ role: 'ai', text: 'What happened next?', questionId: 'question-2' }],
    });
    synthesizeSpeech.mockResolvedValue({
      provider: 'azure-speech',
      contentType: 'audio/mpeg',
      voiceName: 'en-NZ-MollyNeural',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      audioBuffer: Buffer.from('assistant-audio'),
    });
  });

  it('logs a terminal-friendly latency summary in milliseconds', async () => {
    const { processRealtimeVoiceTurn } = await import('../../../src/services/voice/realtimeVoiceTurnService.js');

    await processRealtimeVoiceTurn({
      session: { id: 'session-1' },
      userId: 'user-1',
      transcriptText: 'I reduced API latency by 30 percent.',
      voiceName: 'en-NZ-MollyNeural',
    });

    expect(loggerInfo).toHaveBeenCalledWith(
      'Realtime voice turn latency summary',
      expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
        summary: expect.objectContaining({
          total: expect.stringMatching(/^\d+ ms$/),
          loadLatestQuestion: expect.stringMatching(/^\d+ ms$/),
          saveRealtimeUserTurn: expect.stringMatching(/^\d+ ms$/),
          adaptiveNextQuestion: expect.stringMatching(/^\d+ ms$/),
          updateSessionState: expect.stringMatching(/^\d+ ms$/),
          ttsSynthesis: expect.stringMatching(/^\d+ ms$/),
        }),
      })
    );
  });
});
