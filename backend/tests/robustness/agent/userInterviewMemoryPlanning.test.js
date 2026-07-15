import { describe, expect, it } from 'vitest';

import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import { evaluateInterviewTurn } from '../../../src/services/aiControl/interviewEvaluatorService.js';

const baseContext = ({ planningEnabled }) => ({
  taskType: 'interview_next_turn',
  currentStage: 'technical_core',
  currentTopic: 'system_design',
  candidateState: { specificityLevel: 'medium' },
  coverageState: { coveredTopics: ['system_design'], missingTopics: ['observability'], weakAreas: [] },
  matchState: { validationTargets: [] },
  evaluatorState: { suggestedNextMode: 'advance', evidenceGainScore: 0.75 },
  dynamicSlotState: {},
  abductiveState: { shouldProbe: false },
  sectionState: { isSectionComplete: false },
  interviewStructure: { focusAreaKey: 'combined', currentTopicState: {} },
  agentMemory: {},
  userInterviewMemory: {
    planningEnabled,
    policy: { canAffectScoring: false },
    routineRepeatSuppressions: [{
      competencyKey: 'system_design',
      independentSessionCount: 2,
      canSuppressRoutineRepeat: true,
      recommendedNextDepth: 'advanced',
    }],
  },
});

describe('M3 user interview memory planning boundary', () => {
  it('switches to an uncovered topic when an enabled projection suppresses a same-depth repeat', () => {
    const plan = selectNextAction(baseContext({ planningEnabled: true }));

    expect(plan).toMatchObject({
      selectedAction: 'SWITCH_TOPIC',
      selectionSource: 'user_interview_memory_policy',
      actionInput: {
        targetTopic: 'observability',
        probeType: 'memory_coverage_shift',
        freshOnly: true,
      },
      memoryPolicyDecision: expect.objectContaining({
        canAffectScoring: false,
        reasonCode: 'routine_repeat_suppressed_for_coverage_gap',
      }),
    });
  });

  it('keeps legacy planning when the projection is not promoted', () => {
    const plan = selectNextAction(baseContext({ planningEnabled: false }));

    expect(plan.selectionSource).not.toBe('user_interview_memory_policy');
  });

  it('does not change evaluator scoring when user interview memory is present', () => {
    const environment = {
      latestAnswer: { text: 'I designed the service, measured latency, and reduced failures by 30 percent.' },
      questionContext: { latestQuestionTopic: 'system_design', previousTopics: [] },
      roleContext: { requiredSkills: ['system design'] },
    };
    const baseline = evaluateInterviewTurn({ environment, decisionContext: { currentTopic: 'system_design' } });
    const treatment = evaluateInterviewTurn({
      environment,
      decisionContext: {
        currentTopic: 'system_design',
        userInterviewMemory: baseContext({ planningEnabled: true }).userInterviewMemory,
      },
    });

    const omitIdentity = ({ evaluationId: _evaluationId, createdAt: _createdAt, ...evaluation }) => evaluation;
    expect(omitIdentity(treatment)).toEqual(omitIdentity(baseline));
  });
});
