import { describe, expect, it } from 'vitest';
import { generateCandidateFeedback } from '../../../src/services/reportCoachingService.js';

describe('Phase 2 - F-37 & F-39: Report Authenticity & Export Serialization Edge Cases', () => {
  it('handles Chinese candidate names and Maori unicode characters safely in fallback feedback', async () => {
    const session = {
      candidateName: '張偉 (Tāngata)',
      targetRole: 'Senior Data Engineer',
    };
    const analysisResult = {
      candidateName: '張偉 (Tāngata)',
      jobTitle: 'Senior Data Engineer',
      overallScore: 88,
    };
    const deterministicFeedback = {
      overallTakeaway: '張偉 Candidate performed strongly across data pipeline questions.',
      scoreBand: 'Strong Match',
      communicationProfile: { summary: 'Clear communication style', fillerWords: 'None' },
      plainEnglishMetrics: [
        { id: 'm1', label: 'Technical Depth', value: 85, displayValue: '85%', interpretation: 'High technical proficiency' },
      ],
      strengthHighlights: [
        { title: 'Data Pipeline Mastery', explanation: 'Demonstrated experience with PostgreSQL & Kafka.' },
      ],
      turnBreakdowns: [
        { question: 'What is your experience with Kafka?', answer: 'I built real-time streaming pipelines.', feedback: 'Good answer.' },
      ],
    };

    const feedback = await generateCandidateFeedback({
      session,
      analysisResult,
      interviewPlan: {},
      evidenceSummary: { averageStrength: 2.8, totals: { direct_past_experience: 1 } },
      interviewMetrics: {},
      strongestExamples: [],
      deterministicFeedback,
    });

    expect(feedback.generationSource).toBe('fallback');
    expect(feedback.overallTakeaway).toContain('張偉 Candidate');
    expect(feedback.plainEnglishMetrics[0].value).toBe(85);
    expect(feedback.plainEnglishMetrics[0].displayValue).toBe('85%');
  });

  it('normalizes missing or NaN scores into safe fallback numbers without throwing errors', async () => {
    const deterministicFeedback = {
      overallTakeaway: 'Fallback takeaway',
      plainEnglishMetrics: [
        { id: 'm1', label: 'Score Metric', value: null, displayValue: null, interpretation: 'Default' },
      ],
      turnBreakdowns: [
        { question: 'Q1', answer: 'A1', feedback: 'F1', scores: { business: null, logic: undefined, evidence: NaN } },
      ],
    };

    const feedback = await generateCandidateFeedback({
      session: {},
      analysisResult: {},
      interviewPlan: {},
      evidenceSummary: {},
      deterministicFeedback,
    });

    expect(feedback.plainEnglishMetrics[0].value).toBe(0);
    expect(feedback.turnBreakdowns[0].scores.business).toBe(0);
    expect(feedback.turnBreakdowns[0].scores.logic).toBe(0);
    expect(feedback.turnBreakdowns[0].scores.evidence).toBe(0);
  });
});
