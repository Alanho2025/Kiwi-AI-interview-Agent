import { describe, expect, it } from 'vitest';

import {
  buildFallbackAnswerRewriteTips,
  buildFallbackImprovementPriorities,
} from '../reportView/coaching.js';
import { buildDataInsights, buildTakeaway } from '../reportView/insights.js';

const report = {
  scores: { overall: 50, evidenceStrength: 1, directEvidenceTurns: 0, hypotheticalTurns: 1 },
  sections: [],
  candidateFeedback: {
    turnBreakdowns: [{
      questionTopic: 'patient assessment',
      answer: 'I would review the information and decide what to do.',
      rubricType: 'role_specific',
      evidenceMode: 'scenario_reasoning',
    }],
  },
};

describe('cross-role report view fallbacks', () => {
  it('does not inject IT stories or demand past projects for scenario answers', () => {
    const priorities = buildFallbackImprovementPriorities({
      report,
      interviewMetrics: {},
      evidenceDiagnostics: { totals: {} },
    });
    const rewrites = buildFallbackAnswerRewriteTips({ report, evidenceDiagnostics: { totals: {} } });
    const text = JSON.stringify({ priorities, rewrites });

    expect(text).not.toMatch(/React Native|mobile feature|debugging story|API integration|regression testing|real project/i);
    expect(text).toMatch(/requirements|judgement|risk|validation|outcome/i);
    expect(rewrites[0].weak).toBe('I would review the information and decide what to do.');
    expect(rewrites[0].better).toContain('patient assessment');
  });

  it('keeps scenario insights framework-based instead of past-experience based', () => {
    const takeaway = buildTakeaway({ report, qa: { passed: true }, evidenceDiagnostics: { totals: {} } });
    const insights = buildDataInsights({ report, qa: { passed: true }, interviewMetrics: {}, evidenceDiagnostics: { totals: { generic_filler: 4 } } });
    const text = JSON.stringify({ takeaway, insights });

    expect(text).not.toMatch(/project evidence|STAR-style|direct past experience|real examples/i);
    expect(text).toMatch(/role-specific|framework|reasoning|evidence/i);
  });
});
