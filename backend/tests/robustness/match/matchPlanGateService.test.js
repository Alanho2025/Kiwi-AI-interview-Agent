import { describe, expect, it } from 'vitest';

import {
  assertUsableMatchForInterviewPlan,
  getMatchPlanBlockReason,
  isUsableMatchForInterviewPlan,
} from '../../../src/services/match/matchPlanGateService.js';

describe('match plan gate service', () => {
  it('blocks manual-review match results from interview plan creation', () => {
    const matchAnalysis = {
      decision: { label: 'manual_review', reasonCodes: ['role_fit_review_required'] },
      matchScore: 0,
      roleFitDiagnostics: {
        degradedReasons: ['role_fit_review_required'],
      },
    };

    expect(isUsableMatchForInterviewPlan(matchAnalysis)).toBe(false);
    expect(getMatchPlanBlockReason(matchAnalysis)).toBe('role_fit_review_required');
    expect(() => assertUsableMatchForInterviewPlan(matchAnalysis)).toThrow(/review/i);
  });

  it('allows a reviewed match result with usable role-fit evidence', () => {
    const matchAnalysis = {
      decision: { label: 'strong_match', reasonCodes: [] },
      matchScore: 82,
      roleEvidenceMap: { schemaVersion: 'role_evidence_map_v2', items: [{ roleIntent: 'websocket latency' }] },
    };

    expect(isUsableMatchForInterviewPlan(matchAnalysis)).toBe(true);
    expect(getMatchPlanBlockReason(matchAnalysis)).toBe(null);
    expect(() => assertUsableMatchForInterviewPlan(matchAnalysis)).not.toThrow();
  });
});
