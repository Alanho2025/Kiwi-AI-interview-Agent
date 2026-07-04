import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendTranscriptTurn: vi.fn(),
  updateLatestTranscriptTurnMetadata: vi.fn(),
  updateSession: vi.fn(),
  runTask: vi.fn(),
  saveBufferToLocalStorage: vi.fn(),
  synthesizeSpeech: vi.fn(),
  getLatestQuestionForSession: vi.fn(),
  saveInterviewAnswerWithDetails: vi.fn(),
  applyElapsedSeconds: vi.fn(),
  enqueueBackgroundJob: vi.fn(),
  persistVoiceDeliveryMetrics: vi.fn(),
  recordAgentTraceEvent: vi.fn(),
  backgroundJobs: [],
}));

vi.mock('../../../src/services/sessionService.js', () => ({
  appendTranscriptTurn: mocks.appendTranscriptTurn,
  updateLatestTranscriptTurnMetadata: mocks.updateLatestTranscriptTurnMetadata,
  updateSession: mocks.updateSession,
}));

vi.mock('../../../src/services/masterAiService.js', () => ({
  runTask: mocks.runTask,
}));

vi.mock('../../../src/services/storageService.js', () => ({
  saveBufferToLocalStorage: mocks.saveBufferToLocalStorage,
}));

vi.mock('../../../src/services/voice/ttsProviderRouter.js', () => ({
  synthesizeSpeech: mocks.synthesizeSpeech,
}));

vi.mock('../../../src/services/session/sessionQuestionService.js', () => ({
  getLatestQuestionForSession: mocks.getLatestQuestionForSession,
}));

vi.mock('../../../src/services/interview/interviewSessionService.js', () => ({
  applyElapsedSeconds: mocks.applyElapsedSeconds,
  saveInterviewAnswerWithDetails: mocks.saveInterviewAnswerWithDetails,
}));

vi.mock('../../../src/jobs/backgroundJobQueue.js', () => ({
  enqueueBackgroundJob: mocks.enqueueBackgroundJob,
}));

vi.mock('../../../src/services/voice/voiceDeliveryAnalyzerService.js', async () => {
  const actual = await vi.importActual('../../../src/services/voice/voiceDeliveryAnalyzerService.js');
  return {
    ...actual,
    persistVoiceDeliveryMetrics: mocks.persistVoiceDeliveryMetrics,
  };
});

vi.mock('../../../src/services/aiControl/agentTraceService.js', () => ({
  buildLatencyBreakdown: vi.fn(() => ({ totalMs: 123 })),
  recordAgentTraceEvent: mocks.recordAgentTraceEvent,
}));

const { processRealtimeVoiceTurn } = await import('../../../src/services/voice/realtimeVoiceTurnService.js');

const flushBackgroundJobs = async () => {
  await Promise.all(mocks.backgroundJobs.splice(0).map((job) => job.catch((error) => error)));
};

const baseSession = () => ({
  id: 'voice-session-1',
  userId: 'user-1',
  status: 'active',
  currentQuestionIndex: 2,
  elapsedSeconds: 10,
  transcript: [
    { role: 'ai', text: 'Tell me about model validation.', metadata: { topic: 'model_validation' } },
  ],
});

const validVad = {
  speechStarted: true,
  speechEnded: true,
  speechDurationMs: 2600,
  silenceDurationMs: 500,
  finalSegmentReceived: true,
};

describe('mocked realtime voice turn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backgroundJobs = [];
    mocks.getLatestQuestionForSession.mockResolvedValue({ id: 'question-1', text: 'Tell me about model validation.' });
    mocks.appendTranscriptTurn.mockResolvedValue(null);
    mocks.saveInterviewAnswerWithDetails.mockResolvedValue(null);
    mocks.applyElapsedSeconds.mockReturnValue({ elapsedSeconds: 12 });
    mocks.updateSession.mockResolvedValue({
      ...baseSession(),
      transcript: [
        ...baseSession().transcript,
        { role: 'user', text: 'I compared several splits and validated the result.' },
        { role: 'ai', text: 'How did you validate that split?', questionId: 'question-2' },
      ],
    });
    mocks.enqueueBackgroundJob.mockImplementation((_name, job) => {
      const promise = Promise.resolve().then(() => job?.());
      mocks.backgroundJobs.push(promise);
      return promise;
    });
    mocks.saveBufferToLocalStorage.mockResolvedValue({ storageKey: 'voice-output/test.mp3' });
    mocks.synthesizeSpeech.mockResolvedValue({
      provider: 'mock-tts',
      voiceName: 'test-voice',
      contentType: 'audio/mpeg',
      outputFormat: 'mock-format',
      audioBuffer: Buffer.from('mock audio'),
    });
  });

  it('saves accepted realtime transcript, calls agent runtime, and returns assistant audio in non-streaming mode', async () => {
    mocks.runTask.mockResolvedValue({
      displayText: 'How did you validate that 70 30 worked better than the other splits?',
      nextQuestion: 'How did you validate that 70 30 worked better than the other splits?',
      nextQuestionOrder: 3,
      isComplete: false,
    });

    const result = await processRealtimeVoiceTurn({
      session: baseSession(),
      userId: 'user-1',
      transcriptText: 'I compared 70 30, 60 40, and 80 20, then selected 70 30 because the result was more stable.',
      transcriptProvenance: {
        rawText: 'I compared seventy thirty and selected seventy thirty.',
        normalizedText: 'I compared 70 30 and selected 70 30.',
        corrections: [{ pattern: 'seventy thirty', replacement: '70 30' }],
        segments: [{ rawText: 'I compared seventy thirty.', normalizedText: 'I compared 70 30.', confidence: 0.9 }],
      },
      asrConfidence: 0.9,
      vad: validVad,
      inputMode: 'realtime_voice',
    });
    await flushBackgroundJobs();

    expect(mocks.appendTranscriptTurn).toHaveBeenCalledWith('voice-session-1', expect.objectContaining({
      role: 'user',
      text: expect.stringContaining('70 30'),
      metadata: expect.objectContaining({
        inputMode: 'realtime_voice',
        turnType: 'user_answer',
        rawTranscriptText: 'I compared seventy thirty and selected seventy thirty.',
        normalizedTranscriptText: 'I compared 70 30 and selected 70 30.',
        answeredQuestionId: 'question-1',
        transcriptCorrections: [expect.objectContaining({ replacement: '70 30' })],
      }),
    }));
    expect(mocks.saveInterviewAnswerWithDetails).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'voice-session-1',
      questionId: 'question-1',
      responseMode: 'voice',
    }));
    expect(mocks.runTask).toHaveBeenCalledWith(expect.objectContaining({
      taskType: 'interview_next_turn',
      sessionId: 'voice-session-1',
      payload: expect.objectContaining({ currentQuestionId: 'question-1' }),
    }));
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('validate'),
      usageContext: expect.objectContaining({ source: 'realtime_voice_turn' }),
    }));
    expect(result.assistantAudio).toMatchObject({ provider: 'mock-tts', contentType: 'audio/mpeg' });
    expect(result.assistantAudio.base64).toEqual(Buffer.from('mock audio').toString('base64'));
  });

  it('uses streaming callback and archives full assistant audio in background', async () => {
    const onSentence = vi.fn();
    mocks.runTask.mockImplementation(async ({ onSentence: stream }) => {
      await stream('How did you validate that split?', 0);
      return {
        displayText: 'How did you validate that split?',
        nextQuestion: 'How did you validate that split?',
        nextQuestionOrder: 3,
        isComplete: false,
      };
    });

    const result = await processRealtimeVoiceTurn({
      session: baseSession(),
      userId: 'user-1',
      transcriptText: 'I compared the split options and checked the validation result against the project objective.',
      asrConfidence: 0.9,
      vad: validVad,
      onSentence,
    });
    await flushBackgroundJobs();

    expect(onSentence).toHaveBeenCalledWith('How did you validate that split?', 0);
    expect(result.assistantAudio).toBeNull();
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith(expect.objectContaining({
      text: 'How did you validate that split?',
      usageContext: expect.objectContaining({ source: 'realtime_background_archive' }),
    }));
    expect(mocks.updateLatestTranscriptTurnMetadata).toHaveBeenCalledWith(
      'voice-session-1',
      'ai',
      expect.objectContaining({ voice: expect.objectContaining({ storageKey: 'voice-output/test.mp3' }) }),
    );
  });

  it('rejects low confidence realtime transcript before saving or running the agent', async () => {
    await expect(processRealtimeVoiceTurn({
      session: baseSession(),
      userId: 'user-1',
      transcriptText: 'I used model validation for the project',
      asrConfidence: 0.2,
      vad: validVad,
    })).rejects.toThrow();
    await flushBackgroundJobs();

    expect(mocks.appendTranscriptTurn).not.toHaveBeenCalled();
    expect(mocks.saveInterviewAnswerWithDetails).not.toHaveBeenCalled();
    expect(mocks.runTask).not.toHaveBeenCalled();
  });

  it('returns completed session report readiness generated in the same realtime turn', async () => {
    const tryGenerateReportForCompletedSession = vi.fn().mockResolvedValue({
      stored: { latestStatus: 'ready', report: { summary: 'Ready' } },
    });
    mocks.runTask.mockResolvedValue({
      displayText: '',
      nextQuestion: null,
      isComplete: true,
      completedBecause: 'question_limit_reached',
    });
    mocks.updateSession.mockResolvedValue({
      ...baseSession(),
      status: 'completed',
      hasReport: false,
      reportStatus: null,
    });

    const result = await processRealtimeVoiceTurn({
      session: baseSession(),
      userId: 'user-1',
      transcriptText: 'I validated the final result with integration tests and compared it against the project acceptance criteria.',
      asrConfidence: 0.9,
      vad: validVad,
      tryGenerateReportForCompletedSession,
    });

    expect(tryGenerateReportForCompletedSession).toHaveBeenCalledWith(null, 'voice-session-1');
    expect(result.updatedSession.hasReport).toBe(true);
    expect(result.updatedSession.reportStatus).toBe('ready');
  });
});
