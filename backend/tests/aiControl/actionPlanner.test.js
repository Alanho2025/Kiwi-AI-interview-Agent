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
    expect(plan.actionInput.targetTopic).toBe('backend_project');
  });

  it('rephrases when the evaluator detects misunderstanding', () => {
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
  });

  it('asks an abductive probe when a hidden gap is inferred', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'deployment',
      candidateState: { specificityLevel: 'medium' },
      evaluatorState: { misunderstandingFlag: false, suggestedNextMode: 'advance' },
      abductiveState: { shouldProbe: true, hiddenGap: 'deployment_depth', probeTopic: 'deployment' },
      coverageState: { missingTopics: [], coveredTopics: ['backend_project'], weakAreas: [] },
      matchState: { validationTargets: [] },
      sectionState: { sectionKey: 'technical', isSectionComplete: true, nextSectionKey: 'reflection_close' },
    });
    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION);
  });

  it('prefers deepen before section shift when the answer is still partial', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'api_security',
      candidateState: { specificityLevel: 'medium' },
      evaluatorState: { misunderstandingFlag: false, suggestedNextMode: 'deepen' },
      sectionState: { sectionKey: 'technical', isSectionComplete: true, nextSectionKey: 'reflection_close' },
      coverageState: { missingTopics: [], coveredTopics: ['api_security'], weakAreas: [] },
      matchState: { validationTargets: [] },
    });
    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION);
  });

  it('shifts section when the current section is complete and no stronger follow-up is needed', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'experience',
      currentTopic: 'project',
      candidateState: { specificityLevel: 'high' },
      evaluatorState: { misunderstandingFlag: false, suggestedNextMode: 'advance' },
      sectionState: { sectionKey: 'experience', isSectionComplete: true, nextSectionKey: 'behavioural' },
      coverageState: { missingTopics: [], coveredTopics: ['project', 'ownership', 'experience'], weakAreas: [] },
      matchState: { validationTargets: [] },
    });
    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.SHIFT_SECTION);
  });
});
