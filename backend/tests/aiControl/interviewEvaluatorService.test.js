import { describe, expect, it } from 'vitest';
import { evaluateInterviewTurn } from '../../src/services/aiControl/interviewEvaluatorService.js';

describe('evaluateInterviewTurn', () => {
  it('flags weak and misunderstood answers for rephrasing', () => {
    const evaluation = evaluateInterviewTurn({
      environment: {
        questionContext: { latestQuestionTopic: 'system_design', latestQuestionStage: 'technical_core', previousQuestionTopics: ['system_design', 'system_design'] },
        roleContext: { requiredSkills: ['System Design'] },
        latestAnswer: { text: "Sorry, I'm not sure what you mean.", tokenCount: 7 },
      },
    });
    expect(evaluation.misunderstandingFlag).toBe(true);
    expect(evaluation.suggestedNextMode).toBe('rephrase');
    expect(evaluation.reflectionNeeded).toBe(true);
    expect(evaluation.engagementScore).toBeLessThan(0.4);
  });

  it('recognizes usable evidence-rich answers and interaction scores', () => {
    const evaluation = evaluateInterviewTurn({
      environment: {
        questionContext: { latestQuestionTopic: 'api_security', latestQuestionStage: 'technical_core', previousQuestionTopics: ['backend_project'] },
        roleContext: { requiredSkills: ['API Security'] },
        latestAnswer: { text: 'I designed JWT auth, rate limiting, and audit logging for our API. I measured failed login spikes and reduced unauthorised requests by 35 percent.', tokenCount: 24 },
      },
    });
    expect(evaluation.successStatus).toBe('usable');
    expect(evaluation.evidenceGainScore).toBeGreaterThanOrEqual(0.62);
    expect(evaluation.suggestedNextMode).toBe('advance');
    expect(evaluation.overallInteractionScore).toBeGreaterThan(0.6);
  });
});
