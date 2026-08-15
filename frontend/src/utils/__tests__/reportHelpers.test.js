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

  it('exports formal framework levels and percentages without client score mapping or legacy dimensions', () => {
    const text = formatReportAsText({
      report: {
        scores: { overall: 72 },
        candidateFeedback: {
          turnBreakdowns: [{
            question: 'How would you approach the case?',
            answer: 'I would clarify the requirements and validate the outcome.',
            frameworkLabel: 'Scenario / Case Reasoning',
            scores: { business: 9, logic: 8, evidence: 7 },
            frameworkBreakdown: {
              normalizedScore: 9.5,
              level: 4,
              scorePercent: 75,
              dimensions: [{
                label: 'Requirements',
                score: 10,
                level: 3,
                scorePercent: 50,
                reason: 'Requirements were clearly identified.',
              }],
            },
          }, {
            question: 'Please introduce yourself.',
            answer: 'I enjoy solving practical problems.',
            frameworkLabel: 'Introduction',
            scores: { business: 8, logic: 7, evidence: 6 },
          }],
        },
      },
    });

    expect(text).toContain('Framework: Scenario / Case Reasoning (Level 4/5, 75/100)');
    expect(text).toContain('Requirements (Level 3/5, 50/100): Requirements were clearly identified.');
    expect(text).toContain('Framework: Introduction (unavailable)');
    expect(text).not.toMatch(/Business|Logic|Evidence/);
    expect(text).not.toMatch(/\/10\b/);
  });

  it('formats duration with its server-published level', () => {
    const text = formatReportAsText({
      report: {
        candidateFeedback: {
          turnBreakdowns: [{
            question: 'How would you approach the case?',
            durationAssessment: { eligible: true, seconds: 92, level: 4, earnedPoints: 8, maxPoints: 10 },
          }],
        },
      },
    });

    expect(text).toContain('Framework: Role-specific reasoning (unavailable)');
    expect(text).toContain('Duration: 92s (Level 4/5)');
    expect(text).not.toContain('8/10');
  });

  it('shows Level unavailable when either server framework metric is missing', () => {
    const text = formatReportAsText({
      report: {
        candidateFeedback: {
          turnBreakdowns: [{
            question: 'Requirements question',
            frameworkLabel: 'Scenario / Case Reasoning',
            frameworkBreakdown: {
              dimensions: [{ label: 'Requirements', level: 4, reason: 'Requirements were identified.' }],
            },
          }, {
            question: 'Approach question',
            frameworkLabel: 'Scenario / Case Reasoning',
            frameworkBreakdown: {
              dimensions: [{ label: 'Approach', scorePercent: 75, reason: 'Approach was described.' }],
            },
          }],
        },
      },
    });

    expect(text).toContain('Requirements (Level unavailable): Requirements were identified.');
    expect(text).toContain('Approach (Level unavailable): Approach was described.');
    expect(text).not.toMatch(/\/10\b/);
  });
});
