import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
      resolveUserFromRequest,
      loadOwnedSessionOrThrow,
      ensureInterviewInProgress,
      requireSessionId,
      processVoiceReply,
    } = vi.hoisted(() => ({
      resolveUserFromRequest: vi.fn(),
      loadOwnedSessionOrThrow: vi.fn(),
      ensureInterviewInProgress: vi.fn(),
      requireSessionId: vi.fn(),
      processVoiceReply: vi.fn(),
    }));

    vi.mock('../../src/services/authService.js', () => ({
  resolveUserFromRequest,
}));

vi.mock('../../src/services/interview/interviewSessionService.js', () => ({
  loadOwnedSessionOrThrow,
  ensureInterviewInProgress,
  requireSessionId,
  completeInterviewSession: vi.fn(),
  normalizeInterviewAnswer: vi.fn((value) => String(value || '').trim()),
  pauseInterviewSession: vi.fn(),
  resumeInterviewSession: vi.fn(),
  saveInterviewAnswer: vi.fn(),
}));

vi.mock('../../src/services/voice/voiceOrchestrationService.js', () => ({
  processVoiceReply,
}));

vi.mock('../../src/services/sessionService.js', () => ({
  appendTranscriptTurn: vi.fn(),
  createInterviewQuestion: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('../../src/services/masterAiService.js', () => ({
  runTask: vi.fn(),
}));

vi.mock('../../src/services/interview/interviewAuditService.js', () => ({
  createInterviewLifecycleAuditLog: vi.fn(),
}));

vi.mock('../../src/services/interviewStateService.js', () => ({
  getOpeningQuestionText: vi.fn(() => 'Tell me about yourself.'),
  hasAskedOpeningQuestion: vi.fn(() => true),
}));

describe('voice reply integration flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserFromRequest.mockResolvedValue({ id: 'user-1' });
    loadOwnedSessionOrThrow.mockResolvedValue({ id: 'session-1', status: 'in_progress' });
    processVoiceReply.mockResolvedValue({
      updatedSession: { id: 'session-1', transcript: [] },
      agentResult: {
        nextQuestion: 'What did you learn?',
        interviewerTurn: { text: 'What did you learn?' },
        rationale: 'follow-up',
        retrievalSnapshot: null,
        isComplete: false,
      },
      assistantAudio: {
        provider: 'azure-speech',
        contentType: 'audio/mpeg',
        base64: 'YXVkaW8=',
      },
      transcription: {
        text: 'I handled the issue carefully.',
        language: 'en-NZ',
        provider: 'azure-speech',
        confidence: 0.9,
      },
      generatedReport: null,
    });
  });

  it('loads the owned session, checks progress, and returns voice artefacts', async () => {
    const { replyInterviewWithVoice } = await import('../../src/controllers/interviewController.js');
    const req = {
      body: { sessionId: 'session-1', language: 'en-NZ', voiceName: 'en-NZ-MollyNeural', durationMs: 31000 },
      file: { buffer: Buffer.from('wav'), originalname: 'answer.wav', mimetype: 'audio/wav' },
    };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await replyInterviewWithVoice(req, res, next);

    expect(requireSessionId).toHaveBeenCalledWith('session-1');
    expect(loadOwnedSessionOrThrow).toHaveBeenCalledWith({ sessionId: 'session-1', userId: 'user-1' });
    expect(ensureInterviewInProgress).toHaveBeenCalledWith({ id: 'session-1', status: 'in_progress' });
    expect(processVoiceReply).toHaveBeenCalledWith(expect.objectContaining({
      session: { id: 'session-1', status: 'in_progress' },
      userId: 'user-1',
      file: req.file,
      language: 'en-NZ',
      voiceName: 'en-NZ-MollyNeural',
      durationMs: 31000,
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Voice reply processed',
      data: expect.objectContaining({
        nextQuestion: 'What did you learn?',
        transcription: expect.objectContaining({ text: 'I handled the issue carefully.' }),
        assistantAudio: expect.objectContaining({ base64: 'YXVkaW8=' }),
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards validation errors to the error handler and still lets other tests run', async () => {
    const error = new Error('Audio file is required');
    processVoiceReply.mockRejectedValueOnce(error);
    const { replyInterviewWithVoice } = await import('../../src/controllers/interviewController.js');
    const req = { body: { sessionId: 'session-1' }, file: null };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await replyInterviewWithVoice(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
