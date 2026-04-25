import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
      appendTranscriptTurn,
      updateLatestTranscriptTurnMetadata,
      updateSession,
      runTask,
      saveBufferToLocalStorage,
      transcribeShortAudio,
      synthesizeSpeech,
      getLatestQuestionForSession,
      saveInterviewAnswerWithDetails,
    } = vi.hoisted(() => ({
      appendTranscriptTurn: vi.fn(),
      updateLatestTranscriptTurnMetadata: vi.fn(),
      updateSession: vi.fn(),
      runTask: vi.fn(),
      saveBufferToLocalStorage: vi.fn(),
      transcribeShortAudio: vi.fn(),
      synthesizeSpeech: vi.fn(),
      getLatestQuestionForSession: vi.fn(),
      saveInterviewAnswerWithDetails: vi.fn(),
    }));

    vi.mock('../../../src/services/sessionService.js', () => ({
  appendTranscriptTurn,
  updateLatestTranscriptTurnMetadata,
  updateSession,
}));

vi.mock('../../../src/services/masterAiService.js', () => ({
  runTask,
}));

vi.mock('../../../src/services/storageService.js', () => ({
  saveBufferToLocalStorage,
}));

vi.mock('../../../src/services/voice/azureSpeechService.js', () => ({
  transcribeShortAudio,
  synthesizeSpeech,
}));

vi.mock('../../../src/services/session/sessionQuestionService.js', () => ({
  getLatestQuestionForSession,
}));

vi.mock('../../../src/services/interview/interviewSessionService.js', () => ({
  saveInterviewAnswerWithDetails,
}));

const buildInput = (overrides = {}) => ({
  req: { id: 'req-1' },
  session: { id: 'session-1' },
  userId: 'user-1',
  file: {
    buffer: Buffer.from('wav-bytes'),
    mimetype: 'audio/wav',
    originalname: 'answer.wav',
  },
  language: 'en-NZ',
  voiceName: 'en-NZ-MollyNeural',
  durationMs: 42000,
  tryGenerateReportForCompletedSession: vi.fn().mockResolvedValue({ stored: { latestStatus: 'ready' } }),
  ...overrides,
});

describe('processVoiceReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLatestQuestionForSession.mockResolvedValue({ id: 'question-1' });
    saveBufferToLocalStorage
      .mockResolvedValueOnce({ storageKey: 'voice-input/answer.wav' })
      .mockResolvedValueOnce({ storageKey: 'voice-output/assistant.mp3' });
    transcribeShortAudio.mockResolvedValue({
      text: 'I solved the issue using STAR method.',
      language: 'en-NZ',
      provider: 'azure-speech',
      confidence: 0.91,
      raw: { RecognitionStatus: 'Success' },
    });
    runTask.mockResolvedValue({
      isComplete: false,
      nextQuestionOrder: 2,
      nextQuestion: 'What was the result?',
      interviewerTurn: { text: 'What was the result?' },
    });
    updateSession
      .mockResolvedValueOnce({
        id: 'session-1',
        transcript: [{ role: 'ai', text: 'What was the result?', questionId: 'question-2' }],
      })
      .mockResolvedValueOnce({
        id: 'session-1',
        transcript: [{ role: 'ai', text: 'What was the result?', questionId: 'question-2' }],
      });
    synthesizeSpeech.mockResolvedValue({
      provider: 'azure-speech',
      contentType: 'audio/mpeg',
      voiceName: 'en-NZ-MollyNeural',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      audioBuffer: Buffer.from('assistant-audio'),
    });
  });

  it('throws a clear bad request when no audio file is provided', async () => {
    const { processVoiceReply } = await import('../../../src/services/voice/voiceOrchestrationService.js');

    await expect(processVoiceReply(buildInput({ file: null }))).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Audio file is required',
    });
  });

  it('does not submit empty STT output into the interview engine', async () => {
    transcribeShortAudio.mockResolvedValueOnce({
      text: '   ',
      provider: 'azure-speech',
      language: 'en-NZ',
      confidence: 0.1,
      raw: {},
    });
    const { processVoiceReply } = await import('../../../src/services/voice/voiceOrchestrationService.js');

    await expect(processVoiceReply(buildInput())).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Speech could not be transcribed',
    });

    expect(runTask).not.toHaveBeenCalled();
  });

  it('transcribes voice, saves the answer, generates the next turn, and returns assistant audio', async () => {
    const { processVoiceReply } = await import('../../../src/services/voice/voiceOrchestrationService.js');
    const result = await processVoiceReply(buildInput());

    const [sessionId, userTurn] = appendTranscriptTurn.mock.calls[0];
    expect(sessionId).toBe('session-1');
    expect(userTurn).toEqual(expect.objectContaining({
      role: 'user',
      text: 'I solved the issue using STAR method.',
      metadata: expect.objectContaining({
        inputMode: 'voice',
        audioDurationSeconds: 42,
        asrConfidence: 0.91,
      }),
    }));
    expect(saveInterviewAnswerWithDetails).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      questionId: 'question-1',
      responseMode: 'voice',
    }));
    expect(runTask).toHaveBeenCalledWith({
      taskType: 'interview_next_turn',
      sessionId: 'session-1',
      payload: { answer: 'I solved the issue using STAR method.' },
    });
    expect(result.assistantAudio.base64).toBe(Buffer.from('assistant-audio').toString('base64'));
  });

  it('keeps the text next question when TTS fails instead of failing the whole voice turn', async () => {
    synthesizeSpeech.mockRejectedValueOnce(new Error('TTS outage'));
    const { processVoiceReply } = await import('../../../src/services/voice/voiceOrchestrationService.js');

    const result = await processVoiceReply(buildInput());

    expect(result.agentResult.nextQuestion).toBe('What was the result?');
    expect(result.assistantAudio).toBeNull();
    expect(updateLatestTranscriptTurnMetadata).toHaveBeenCalledWith('session-1', 'ai', {
      voice: {
        synthesisFailed: true,
        reason: 'TTS outage',
      },
    });
  });

  it('generates a report after a completed voice interview', async () => {
    runTask.mockResolvedValueOnce({
      isComplete: true,
      nextQuestionOrder: 7,
      nextQuestion: '',
      interviewerTurn: { text: '' },
      completedBecause: 'planned_questions_finished',
    });
    updateSession.mockResolvedValueOnce({ id: 'session-1', status: 'completed', transcript: [] });
    const input = buildInput();
    const { processVoiceReply } = await import('../../../src/services/voice/voiceOrchestrationService.js');

    const result = await processVoiceReply(input);

    expect(updateSession).toHaveBeenCalledWith('session-1', 'user-1', expect.objectContaining({
      status: 'completed',
      lastResumedAt: null,
    }));
    expect(input.tryGenerateReportForCompletedSession).toHaveBeenCalledWith(input.req, 'session-1');
    expect(result.generatedReport.stored.latestStatus).toBe('ready');
  });
});
