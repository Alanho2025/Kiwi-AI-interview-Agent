import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { AGENT_TOOL_NAMES, getToolNameForAction } from '../../../src/constants/agentToolNames.js';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';

describe('interview control robustness', () => {
  it('does not advance when the latest answer is vague and evidence coverage is weak', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'backend_project',
      candidateState: { specificityLevel: 'low' },
      coverageState: { missingTopics: ['system_design'], coveredTopics: [], weakAreas: ['backend_project'] },
      matchState: { validationTargets: ['full-stack experience'] },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_PROBING_QUESTION);
    expect(getToolNameForAction(plan.selectedAction)).toBe(AGENT_TOOL_NAMES.GENERATE_INTERVIEW_QUESTION);
  });

  it('rephrases instead of repeating the same question when misunderstanding is detected', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'system_design',
      candidateState: { specificityLevel: 'medium' },
      evaluatorState: { misunderstandingFlag: true, suggestedNextMode: 'rephrase', currentTopic: 'system_design' },
      coverageState: { missingTopics: ['system_design'], coveredTopics: [], weakAreas: [] },
      matchState: { validationTargets: [] },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.REPHRASE_QUESTION);
    expect(getToolNameForAction(plan.selectedAction)).toBe(AGENT_TOOL_NAMES.GENERATE_INTERVIEW_QUESTION);
  });

  it('prioritises hidden-gap probing before section transition when abductive reasoning finds risk', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'deployment',
      candidateState: { specificityLevel: 'medium' },
      evaluatorState: { misunderstandingFlag: false, suggestedNextMode: 'advance' },
      abductiveState: { shouldProbe: true, hiddenGap: 'deployment_depth', probeTopic: 'deployment' },
      sectionState: { sectionKey: 'technical', isSectionComplete: true, nextSectionKey: 'reflection_close' },
      coverageState: { missingTopics: [], coveredTopics: ['backend_project'], weakAreas: [] },
      matchState: { validationTargets: [] },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION);
  });
});
