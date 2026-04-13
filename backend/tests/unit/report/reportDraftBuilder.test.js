import { describe, expect, it } from 'vitest';
import { buildReportDraft } from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';

describe('buildReportDraft', () => {
  it('includes interaction, reflection, and coaching sections in the report draft', () => {
    const report = buildReportDraft({
      session: { id: 'session-1', totalQuestions: 4 },
      analysisResult: {
        overallScore: 74,
        confidence: 0.72,
        decision: { label: 'partial_match' },
        explanation: { strengths: ['Strong backend project'], gaps: ['Needs deeper system design'] },
        scoreBreakdown: { macro: 70, micro: 76, requirements: 71 },
      },
      interviewPlan: { interviewFocus: ['system_design'] },
      explanation: { strengths: ['Strong backend project'] },
      evidenceSummary: { totals: { direct_past_experience: 2, indirect_adjacent_experience: 1, hypothetical_understanding: 1, generic_filler: 0 }, averageStrength: 3.1, strongestExamples: ['Built and shipped an API for students'] },
      interviewMetrics: { candidateTurnCount: 4, interviewerQuestionCount: 4, extraAiTurnCount: 0, plannedQuestionCount: 4, interviewCompletedByLimit: true },
      candidateFeedback: { overallTakeaway: 'Promising but should tighten examples.', coachingAdvice: ['Use one concrete project per answer.'], plainEnglishMetrics: ['Your answers were fairly clear.'], answerRewriteExamples: ['Old answer -> stronger answer'] },
      evaluatorRecords: [{ overallInteractionScore: 0.74, engagementScore: 0.8, turnTakingScore: 0.75, repairScore: 0.7, appropriatenessScore: 0.72 }],
      trajectoryRecords: [{ trajectoryId: 't1' }],
      reflectionRecords: [{ lesson: 'Ask for one concrete design decision.' }],
      userCoachingMemory: { latestSummary: 'Tighten scope early for system design questions.' },
    });

    expect(report.sections.map((item) => item.id)).toEqual(expect.arrayContaining(['interaction_feedback', 'reflection_memory', 'coaching_memory']));
    expect(report.scores.averageInteractionScore).toBeGreaterThan(0);
    expect(report.summary).toMatch(/Reflection records: 1/);
  });
});
