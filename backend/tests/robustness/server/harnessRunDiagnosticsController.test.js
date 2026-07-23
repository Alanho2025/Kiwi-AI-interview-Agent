import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveUserFromRequest: vi.fn(),
  queryOwnedHarnessRunTimelines: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('../../../src/services/authService.js', () => ({
  resolveUserFromRequest: mocks.resolveUserFromRequest,
}));

vi.mock('../../../src/services/harness/harnessRunQueryService.js', () => ({
  queryOwnedHarnessRunTimelines: mocks.queryOwnedHarnessRunTimelines,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: mocks.loggerInfo },
  getRequestLogMeta: (_req, meta) => meta,
}));

import { getHarnessRunDiagnostics } from '../../../src/controllers/interviewDiagnosticsController.js';

describe('M1 harness developer diagnostics controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mocks.resolveUserFromRequest.mockResolvedValue({ id: 'owner-diagnostics-1' });
    mocks.queryOwnedHarnessRunTimelines.mockResolvedValue([{ workflowRunId: 'run-diagnostics-1' }]);
  });

  it('queries only the authenticated owner and logs access', async () => {
    const req = {
      query: { sessionId: 'session-diagnostics-1', limit: '10' },
      requestContext: { requestId: 'request-diagnostics-1' },
    };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await getHarnessRunDiagnostics(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.queryOwnedHarnessRunTimelines).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'owner-diagnostics-1',
      sessionId: 'session-diagnostics-1',
      limit: '10',
    }));
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Harness run diagnostics accessed',
      expect.objectContaining({ ownerUserId: 'owner-diagnostics-1', resultCount: 1 }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { runs: [{ workflowRunId: 'run-diagnostics-1' }] },
    }));
  });

  it('is unavailable in production even for an authenticated user', async () => {
    process.env.NODE_ENV = 'production';
    const next = vi.fn();

    await getHarnessRunDiagnostics({ query: {} }, { json: vi.fn() }, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.queryOwnedHarnessRunTimelines).not.toHaveBeenCalled();
  });
});
