import { describe, expect, it } from 'vitest';
import { buildTrajectoryStep } from '../../src/services/aiControl/trajectoryService.js';

describe('buildTrajectoryStep', () => {
  it('creates a structured short-term memory step for the interview actor', () => {
    const step = buildTrajectoryStep({
      session: { id: 'session-1' },
      environment: { questionContext: { latestQuestionText: 'Tell me about your API design.' }, latestAnswer: { text: 'I built REST APIs.' } },
      decisionContext: { currentStage: 'technical_core', currentTopic: 'api_design', coverageState: { missingTopics: ['system_design'] }, matchState: { validationTargets: ['ownership'] } },
      selectedAction: 'ASK_PROBING_QUESTION',
      actionInput: { targetTopic: 'api_design' },
      actorOutput: { nextQuestion: 'What did you personally own?', stage: 'technical_probe', topic: 'api_design', reactTrace: { thoughtSummary: 'Need stronger ownership evidence.', actionName: 'ASK_PROBING_QUESTION', observationSummary: 'Answer was brief.' } },
      evaluatorOutput: { successStatus: 'weak', evidenceGainScore: 0.4 },
    });

    expect(step.section).toBe('technical_probe');
    expect(step.targetTopic).toBe('api_design');
    expect(step.evaluator.evidenceGainScore).toBe(0.4);
    expect(step.thoughtSummary).toContain('ownership');
  });
});
