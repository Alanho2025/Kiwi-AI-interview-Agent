import { describe, expect, it } from 'vitest';
import { AGENT_ACTION_TYPES } from '../../src/constants/agentActionTypes.js';
import { selectNextAction } from '../../src/services/aiControl/actionPlanner.js';

describe('selectNextAction', () => {
  it('chooses probing when the latest answer is too vague', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'backend_project',
      candidateState: { specificityLevel: 'low' },
      coverageState: { missingTopics: ['system_design'], coveredTopics: [], weakAreas: [] },
      matchState: { validationTargets: ['full-stack experience'] },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_PROBING_QUESTION);
    expect(plan.actionInput.targetTopic).toBe('system_design');
  });

  it('switches to uncovered topics when specificity is acceptable and there are no validation targets', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'backend_project',
      candidateState: { specificityLevel: 'medium' },
      coverageState: { missingTopics: ['api_security'], coveredTopics: ['self_intro'], weakAreas: [] },
      matchState: { validationTargets: [] },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.SWITCH_TOPIC);
    expect(plan.actionInput.targetTopic).toBe('api_security');
  });
});
