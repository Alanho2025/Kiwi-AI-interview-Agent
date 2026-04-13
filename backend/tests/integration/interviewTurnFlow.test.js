import { describe, expect, it } from 'vitest';
import { AGENT_ACTION_TYPES } from '../../src/constants/agentActionTypes.js';
import { buildInterviewEnvironment } from '../../src/services/aiControl/interviewEnvironmentService.js';
import { evaluateInterviewTurn } from '../../src/services/aiControl/interviewEvaluatorService.js';
import { runInterviewerAgent } from '../../src/services/agents/interviewerAgent.js';
import { buildTrajectoryStep } from '../../src/services/aiControl/trajectoryService.js';
import { buildReflectionRecord, shouldWriteReflection } from '../../src/services/aiControl/reflectionWriterService.js';

describe('interview turn flow', () => {
  it('runs environment -> evaluator -> actor -> trajectory -> reflection for a misunderstood answer', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      totalQuestions: 5,
      currentQuestionIndex: 2,
      transcript: [
        { role: 'ai', text: 'How do you approach system design?', metadata: { stage: 'technical_core', topic: 'system_design' } },
        { role: 'user', text: 'Sorry, do you mean backend architecture or just APIs?', metadata: {} },
      ],
      analysisResult: { parsedCvProfile: { skills: ['Node.js'] }, parsedJdProfile: { requiredSkills: ['System Design'] }, matchingDetails: { validationTargets: ['system_design'] } },
      interviewPlan: { questionPool: [] },
    };

    const environment = buildInterviewEnvironment({ session, retrievalBundle: null, latestEvaluation: null });
    const evaluator = evaluateInterviewTurn({ environment, decisionContext: { currentTopic: 'system_design', currentStage: 'technical_core' } });
    expect(evaluator.misunderstandingFlag).toBe(true);

    const decisionContext = {
      environment,
      evaluatorState: evaluator,
      currentTopic: 'system_design',
      currentStage: 'technical_core',
      coverageState: { missingTopics: ['system_design'] },
      matchState: { validationTargets: ['system_design'] },
      sectionState: { sectionKey: 'technical', nextSectionKey: 'behavioural' },
      abductiveState: { shouldProbe: false },
    };

    const actor = await runInterviewerAgent({ session, actionType: AGENT_ACTION_TYPES.REPHRASE_QUESTION, decisionContext, targetTopic: 'system_design' });
    const trajectory = buildTrajectoryStep({ session, environment, decisionContext, selectedAction: AGENT_ACTION_TYPES.REPHRASE_QUESTION, actionInput: { targetTopic: 'system_design' }, actorOutput: actor, evaluatorOutput: evaluator });

    expect(actor.nextQuestion).toMatch(/Let me rephrase/i);
    expect(trajectory.chosenAction).toBe(AGENT_ACTION_TYPES.REPHRASE_QUESTION);

    const reflectionNeeded = shouldWriteReflection({ evaluatorState: evaluator, decisionContext, trajectoryStep: trajectory });
    expect(reflectionNeeded).toBe(true);

    const reflection = buildReflectionRecord({ sessionId: session.id, userId: session.userId, evaluatorState: evaluator, decisionContext, trajectoryStep: trajectory });
    expect(reflection.lesson).toMatch(/concrete example/i);
  });
});
