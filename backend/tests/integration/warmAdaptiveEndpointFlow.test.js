import { beforeEach, describe, expect, it, vi } from 'vitest';

const warmAdaptiveSession = vi.fn();
const loadOwnedSessionOrThrow = vi.fn();
const ensureInterviewInProgress = vi.fn();
const requireSessionId = vi.fn();
const resolveUserFromRequest = vi.fn();

vi.mock('../../src/services/masterAiService.js', () => ({
  runTask: vi.fn(),
  warmAdaptiveSession,
}));

vi.mock('../../src/services/interview/interviewSessionService.js', () => ({
  completeInterviewSession: vi.fn(),
  ensureInterviewInProgress,
  loadOwnedSessionOrThrow,
  normalizeInterviewAnswer: vi.fn((value) => String(value || '').trim()),
  pauseInterviewSession: vi.fn(),
  requireSessionId,
  resumeInterviewSession: vi.fn(),
  saveInterviewAnswer: vi.fn(),
}));

vi.mock('../../src/services/authService.js', () => ({
  resolveUserFromRequest,
}));

vi.mock('../../src/services/sessionService.js', () => ({
  appendTranscriptTurn: vi.fn(),
  createInterviewQuestion: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('../../src/services/interview/interviewAuditService.js', () => ({
  createInterviewLifecycleAuditLog: vi.fn(),
}));

vi.mock('../../src/services/voice/voiceOrchestrationService.js', () => ({
  processVoiceReply: vi.fn(),
}));

vi.mock('../../src/services/voice/realtimeVoiceTurnService.js', () => ({
  processRealtimeVoiceTurn: vi.fn(),
}));

vi.mock('../../src/services/voice/azureSpeechService.js', () => ({
  synthesizeSpeech: vi.fn(),
}));

vi.mock('../../src/utils/sessionTurnLock.js', () => ({
  withSessionTurnLock: vi.fn(async (sessionId, fn) => fn()),
}));

describe('warm adaptive interview endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionId.mockImplementation((sessionId) => {
      if (!sessionId) throw new Error('Missing sessionId');
    });
    resolveUserFromRequest.mockResolvedValue({ id: 'u1' });
    loadOwnedSessionOrThrow.mockResolvedValue({ id: 's1', status: 'in_progress' });
    ensureInterviewInProgress.mockImplementation(() => {});
    warmAdaptiveSession.mockResolvedValue({ warmed: true, sessionId: 's1' });
  });

  it('warms a valid in-progress session and returns latency metadata', async () => {
    const { warmAdaptiveInterview } = await import('../../src/controllers/interviewController.js');
    const req = { body: { sessionId: 's1' } };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await warmAdaptiveInterview(req, res, next);

    expect(requireSessionId).toHaveBeenCalledWith('s1');
    expect(loadOwnedSessionOrThrow).toHaveBeenCalledWith({ sessionId: 's1', userId: 'u1' });
    expect(ensureInterviewInProgress).toHaveBeenCalled();
    expect(warmAdaptiveSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1' }));
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Adaptive session warmed',
      data: expect.objectContaining({
        warmed: true,
        latency: expect.objectContaining({ name: 'warm_adaptive_session' }),
      }),
    }));
  });

  it('passes warm-up failures to error middleware without sending success', async () => {
    warmAdaptiveSession.mockRejectedValueOnce(new Error('warm failed'));
    const { warmAdaptiveInterview } = await import('../../src/controllers/interviewController.js');
    const req = { body: { sessionId: 's1' } };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await warmAdaptiveInterview(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'warm failed' }));
  });
});
