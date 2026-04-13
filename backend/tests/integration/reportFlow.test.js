import { describe, expect, it } from 'vitest';
import { buildReportDraft } from '../../src/services/agents/reportGenerator/reportDraftBuilder.js';
import { runReportQaAgent } from '../../src/services/agents/reportQaAgent.js';

describe('report flow', () => {
  it('builds a grounded report and passes QA when key sections and metrics exist', async () => {
    const report = buildReportDraft({
      session: { id: 'session-1', totalQuestions: 3 },
      analysisResult: {
        overallScore: 78,
        confidence: 0.76,
        decision: { label: 'partial_match' },
        explanation: { strengths: ['Good backend delivery'], gaps: ['Need stronger cloud evidence'] },
        scoreBreakdown: { macro: 75, micro: 80, requirements: 72 },
      },
      interviewPlan: { interviewFocus: ['backend_project', 'cloud_depth'] },
      explanation: { strengths: ['Good backend delivery'] },
      evidenceSummary: { totals: { direct_past_experience: 3, indirect_adjacent_experience: 0, hypothetical_understanding: 0, generic_filler: 0 }, averageStrength: 3.4, strongestExamples: ['Built and deployed a production API'] },
      interviewMetrics: { candidateTurnCount: 3, interviewerQuestionCount: 3, extraAiTurnCount: 0, plannedQuestionCount: 3, interviewCompletedByLimit: true },
      candidateFeedback: { overallTakeaway: 'Good baseline. Push for stronger cloud proof.', coachingAdvice: ['Use one AWS example with measurable impact.'], plainEnglishMetrics: ['Your answers were clear and mostly direct.'], answerRewriteExamples: ['Weak answer -> stronger answer'] },
      evaluatorRecords: [{ overallInteractionScore: 0.8, engagementScore: 0.81, turnTakingScore: 0.78, repairScore: 0.79, appropriatenessScore: 0.82 }],
      trajectoryRecords: [{ trajectoryId: 't1' }, { trajectoryId: 't2' }],
      reflectionRecords: [{ lesson: 'Keep using one real example before switching topics.' }],
      userCoachingMemory: { latestSummary: 'The candidate improves when the question scope is narrow.' },
    });

    const qa = await runReportQaAgent({
      report,
      analysisResult: { decision: { label: 'partial_match' }, explanation: { strengths: ['Good backend delivery'] } },
      retrievalBundle: { items: [{ chunkId: 'c1', sourceType: 'question_bank' }] },
    });

    expect(report.sections.map((item) => item.id)).toEqual(expect.arrayContaining(['interaction_feedback', 'reflection_memory', 'coaching_memory']));
    expect(qa.passed).toBe(true);
  });
});
