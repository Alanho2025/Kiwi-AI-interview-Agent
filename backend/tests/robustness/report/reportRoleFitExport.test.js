import { describe, expect, it } from 'vitest';

import { formatReportAsText } from '../../../src/controllers/reportController.js';

describe('candidate report text export', () => {
  it('omits role-fit noise and preserves report limitations and transcript risks', () => {
    const text = formatReportAsText({
      sessionId: 'session-role-fit-export',
      latestStatus: 'ready',
      report: {
        schemaVersion: 'v7',
        legacyLimitations: [{ message: 'This older report may include a scored clarification.' }],
        transcriptRisks: [{ message: 'One transcript segment had low confidence.' }],
        roleFit: {
          status: 'ready',
          roleIntentCoverage: {
            total: 1,
            covered: 1,
            partial: 0,
            missing: 0,
            items: [{ label: 'Reliable production delivery', status: 'covered' }],
          },
          evidenceUsageMap: {
            totalUses: 1,
            items: [{ label: 'Evidence for reliable production delivery', useCount: 1 }],
          },
          answerAlignments: [{
            question: 'Tell me about a production delivery improvement.',
            label: 'strong',
            score: 88,
            diagnosis: { mainIssue: 'The answer used clear ownership and a measurable result.' },
            clarificationCoaching: { coachingFeedback: 'The scope was stated clearly.', actionableTip: 'Name the assumptions first.' },
            aiJudgementCoaching: { coachingFeedback: 'The verification step was concrete.', actionableTip: 'Keep ownership explicit.' },
          }],
        },
      },
      qaResult: {},
    });

    expect(text).toContain('REPORT LIMITATION');
    expect(text).toContain('This older report may include a scored clarification.');
    expect(text).toContain('TRANSCRIPT RISKS');
    expect(text).toContain('One transcript segment had low confidence.');
    expect(text).not.toContain('HOW YOUR ANSWERS MATCHED THIS ROLE');
    expect(text).not.toContain('Reliable production delivery');
    expect(text).not.toContain('Role-specific coaching was unavailable');
    expect(text).not.toMatch(/proofPointId|coverageId|evidenceId/);
  });

  it('omits developer diagnostics, cost, evidence dumps, and QA controls', () => {
    const text = formatReportAsText({
      sessionId: 'session-candidate-export',
      latestStatus: 'ready',
      executionCost: { totalCost: 1.2 },
      commercialStressTest: { totalLlmTokens: 4444 },
      report: {
        summary: 'Candidate-safe summary.',
        scores: { overall: 70, cvJdMatch: 75, interviewPerformance: 65 },
        evidenceDiagnostics: { averageStrength: 2 },
        interviewMetrics: { candidateTurnCount: 4 },
        evidenceReferences: [{ evidenceSnippet: 'candidate@example.com' }],
      },
      qaResult: {
        coverageScore: 80,
        qualityFlags: ['private_flag'],
      },
    });

    expect(text).toContain('Candidate-safe summary.');
    expect(text).toContain('Interview Performance: 65.00/100');
    expect(text).not.toMatch(/CV-JD Match|Overall Score/i);
    expect(text).not.toMatch(/COMMERCIAL STRESS TEST|LLM Tokens|EVIDENCE DIAGNOSTICS|INTERVIEW METRICS|QUALITY ASSURANCE/i);
    expect(text).not.toMatch(/candidate@example\\.com|private_flag|4444/);
  });

  it('omits score output for a legacy report without interview performance', () => {
    const text = formatReportAsText({
      latestStatus: 'ready',
      report: { scores: { overall: 70, cvJdMatch: 75, interview: 65, micro: 65 } },
    });

    expect(text).not.toMatch(/SCORES|Interview Performance|CV-JD|Overall Score/i);
  });
});
