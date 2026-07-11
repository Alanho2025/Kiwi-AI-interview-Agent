import { describe, expect, it, vi } from 'vitest';

import { runReportQaRepairLoop } from '../../../src/services/report/reportQaRepairOrchestratorService.js';

describe('Role-Fit report QA repair boundary', () => {
  it('does not let wording repair clear deterministic Role-Fit failures', async () => {
    const reportQa = vi.fn();
    const result = await runReportQaRepairLoop({
      report: { sessionId: 'session-role-fit-repair' },
      qaResult: {
        passed: false,
        qualityFlags: ['alignment_claim_not_grounded', 'must_cover_intent_unreported'],
        consistencyChecks: [],
      },
      session: { id: 'session-role-fit-repair', analysisResult: {} },
      agentRegistry: { reportQa },
    });

    expect(result.repairHistory).toEqual([]);
    expect(result.qaResult.qualityFlags).toEqual([
      'alignment_claim_not_grounded',
      'must_cover_intent_unreported',
    ]);
    expect(reportQa).not.toHaveBeenCalled();
  });
});
