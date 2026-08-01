import { describe, expect, it } from 'vitest';
import { formatReportAsText } from '../reportHelpers.js';

describe('report export text formatting', () => {
  it('renders candidate recommendations while omitting developer QA details', () => {
    const text = formatReportAsText({
      sessionId: 'session-report-export',
      latestStatus: 'needs_review',
      report: {
        schemaVersion: 'v3',
        candidateName: 'Aroha Candidate',
        jobTitle: 'Frontend Developer',
        summary: 'Evidence is useful but incomplete.',
        scores: {
          overall: 72,
          cvJdMatch: 91,
          macro: 72,
          evidenceStrength: null,
        },
        recommendations: [
          { title: 'Add measurable outcomes', description: 'Use result evidence.' },
        ],
      },
      qaResult: {
        coverageScore: 61,
        hallucinationRisk: 'medium',
        notes: [{ label: 'Needs stronger evidence', content: 'Report should stay cautious.' }],
        qualityFlags: ['insufficient_evidence'],
      },
    });

    expect(text).toContain('Candidate: Aroha Candidate');
    expect(text).toContain('Target Role: Frontend Developer');
    expect(text).toContain('Interview Performance: 72.00/100');
    expect(text).not.toContain('Overall Score:');
    expect(text).not.toContain('CV-JD Match:');
    expect(text).toContain('Add measurable outcomes');
    expect(text).toContain('Report Status: needs_review');
    expect(text).not.toContain('Coverage Score: 61/100');
    expect(text).not.toContain('insufficient_evidence');
    expect(text).not.toContain('[object Object]');
    expect(text).not.toContain('NaN');
  });

  it('omits role-fit noise and includes candidate-facing limitations', () => {
    const text = formatReportAsText({
      sessionId: 'session-role-fit-export',
      report: {
        legacyLimitations: [{ message: 'This older report may include a scored clarification.' }],
        transcriptRisks: [{ message: 'One transcript segment had low confidence.' }],
        roleFit: {
          status: 'ready',
          roleIntentCoverage: {
            total: 1,
            covered: 1,
            items: [{ label: 'Reliable production delivery', status: 'covered' }],
          },
          answerAlignments: [{
            question: 'Tell me about a delivery improvement.',
            label: 'strong',
            score: 88,
            diagnosis: { mainIssue: 'Clear ownership and result.' },
            clarificationCoaching: { coachingFeedback: 'You stated a clear assumption.', actionableTip: 'Name the scope.' },
            aiJudgementCoaching: { coachingFeedback: 'You explained your verification.', actionableTip: 'Keep the check concrete.' },
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
    expect(text).not.toContain('SCORES');
    expect(text).not.toContain('CV-JD Match:');
    expect(text).not.toMatch(/proofPointId|coverageId|evidenceId/);
  });

  it('does not turn legacy score fields or a blank overall value into interview performance', () => {
    const text = formatReportAsText({
      report: {
        scores: { overall: ' ', cvJdMatch: 88, macro: 70, micro: 73, requirements: 80 },
        scoreExplanations: {
          overall: { explanation: 'Historic blended score explanation.' },
        },
      },
    });

    expect(text).not.toContain('SCORES');
    expect(text).not.toContain('SCORE EXPLANATIONS');
    expect(text).not.toContain('Historic blended score explanation.');
    expect(text).not.toContain('CV-JD Match:');
  });
});
