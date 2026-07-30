import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveUserFromRequest: vi.fn(),
  loadOwnedSessionOrThrow: vi.fn(),
  findOne: vi.fn(),
  getSessionExecutionCost: vi.fn(),
  getInterviewQuestionDiagnostics: vi.fn(),
  queryOwnedHarnessRunTimelines: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('../../../src/services/authService.js', () => ({
  resolveUserFromRequest: mocks.resolveUserFromRequest,
}));
vi.mock('../../../src/services/interview/interviewSessionService.js', () => ({
  loadOwnedSessionOrThrow: mocks.loadOwnedSessionOrThrow,
  requireSessionId: vi.fn(),
}));
vi.mock('../../../src/db/models/sessionReportModel.js', () => ({
  SessionReport: { findOne: mocks.findOne },
}));
vi.mock('../../../src/services/aiUsageTrackingService.js', () => ({
  getSessionExecutionCost: mocks.getSessionExecutionCost,
}));
vi.mock('../../../src/services/questions/interviewQuestionDiagnosticsService.js', () => ({
  getInterviewQuestionDiagnostics: mocks.getInterviewQuestionDiagnostics,
}));
vi.mock('../../../src/services/harness/harnessRunQueryService.js', () => ({
  queryOwnedHarnessRunTimelines: mocks.queryOwnedHarnessRunTimelines,
}));
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: mocks.loggerInfo },
  getRequestLogMeta: (_req, meta) => meta,
}));

const { getReportDiagnostics } = await import('../../../src/controllers/reportDiagnosticsController.js');

describe('report developer diagnostics controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mocks.resolveUserFromRequest.mockResolvedValue({ id: 'owner-1' });
    mocks.loadOwnedSessionOrThrow.mockResolvedValue({
      id: 'session-1',
      transcript: [{
        role: 'user',
        text: 'Contact candidate@example.com',
        metadata: {
          turnType: 'question_scope_clarification_request',
          countsAsQuestion: false,
          countsAsAnswer: false,
          clarificationIntent: 'did_not_understand',
          rootQuestionId: 'question-1',
        },
      }],
    });
    mocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        latestStatus: 'ready',
        report: { internalReason: 'Call +64 21 555 123' },
        qaResult: { qualityFlags: ['flag'] },
      }),
    });
    mocks.getSessionExecutionCost.mockResolvedValue({ totalCost: 1.2, totalLlmTokens: 100 });
    mocks.getInterviewQuestionDiagnostics.mockResolvedValue({
      selectedQuestion: 'question-1',
      matchGapSamples: [{ matchGapId: 'gap-1', selectionReason: 'ranked_within_eligible_slot' }],
    });
    mocks.queryOwnedHarnessRunTimelines.mockResolvedValue([{ workflowRunId: 'run-1' }]);
  });

  it('loads owner-scoped diagnostics separately and masks PII', async () => {
    const req = { params: { sessionId: 'session-1' } };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await getReportDiagnostics(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.loadOwnedSessionOrThrow).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'owner-1',
    });
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.executionCost.totalLlmTokens).toBe(100);
    expect(payload.data.harnessRuns).toEqual([{ workflowRunId: 'run-1' }]);
    expect(payload.data.questionDiagnostics.matchGapSamples[0]).toMatchObject({
      matchGapId: 'gap-1',
      selectionReason: 'ranked_within_eligible_slot',
    });
    expect(payload.data.turnEligibility[0]).toMatchObject({
      countsAsAnswer: false,
      clarificationIntent: 'did_not_understand',
    });
    expect(JSON.stringify(payload)).not.toMatch(/candidate@example\\.com|\\+64 21 555 123/);
    expect(mocks.queryOwnedHarnessRunTimelines).toHaveBeenCalledWith({
      ownerUserId: 'owner-1',
      sessionId: 'session-1',
      limit: 10,
    });
  });

  it('denies diagnostics in production before loading the owner session', async () => {
    process.env.NODE_ENV = 'production';
    const next = vi.fn();

    await getReportDiagnostics({ params: { sessionId: 'session-1' } }, { json: vi.fn() }, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.loadOwnedSessionOrThrow).not.toHaveBeenCalled();
    expect(mocks.queryOwnedHarnessRunTimelines).not.toHaveBeenCalled();
  });
});
