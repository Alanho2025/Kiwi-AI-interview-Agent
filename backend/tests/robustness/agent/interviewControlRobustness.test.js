import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { AGENT_TOOL_NAMES, getToolNameForAction } from '../../../src/constants/agentToolNames.js';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import { selectActionWithModel } from '../../../src/services/aiControl/modelActionSelectorService.js';

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
    expect(plan.selectionSource).toBe('rule_fallback');
    expect(plan.candidateActions.map((candidate) => candidate.action)).toContain(AGENT_ACTION_TYPES.ASK_PROBING_QUESTION);
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
    expect(plan.allowModelSelection).toBe(false);
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
    expect(plan.candidateActions.length).toBeGreaterThan(0);
  });

  it('falls back to the rule-selected action when model selection cannot return valid allowed JSON', async () => {
    const fallbackPlan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'React',
      candidateState: { specificityLevel: 'medium' },
      evaluatorState: { misunderstandingFlag: false, suggestedNextMode: 'deepen', evidenceGainScore: 0.62 },
      coverageState: { missingTopics: ['testing'], coveredTopics: [], weakAreas: [] },
      matchState: { validationTargets: [] },
    });

    const plan = await selectActionWithModel({
      decisionContext: { currentTopic: 'React', currentStage: 'technical_core' },
      evaluatorOutput: { evidenceGainScore: 0.62 },
      candidateActions: fallbackPlan.candidateActions,
      fallbackPlan,
      sessionSettings: {},
    });

    expect(plan.selectedAction).toBe(fallbackPlan.selectedAction);
    expect(plan.selectionSource).toBe('rule_fallback');
    expect(plan.modelSelectionError).toBeTruthy();
  });

  it('switches topic instead of rephrasing again when the candidate flags repetition', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'database_tradeoff',
      evaluatorState: {
        misunderstandingFlag: true,
        suggestedNextMode: 'rephrase',
        candidateRepetitionComplaint: true,
      },
      coverageState: { missingTopics: ['game_ai_product_sense'], coveredTopics: ['database_tradeoff'], weakAreas: [] },
      matchState: { validationTargets: [] },
      interviewStructure: { currentTopicState: { repairCount: 1 } },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.SWITCH_TOPIC);
    expect(plan.allowModelSelection).toBe(false);
    expect(plan.actionInput).toMatchObject({
      targetTopic: 'game_ai_product_sense',
      probeType: 'repetition_repair_switch',
      freshOnly: true,
    });
  });

  it('honours evaluator switch mode before falling back to probing or deepening', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'behavioural',
      currentTopic: 'ownership',
      candidateState: { specificityLevel: 'medium' },
      evaluatorState: {
        misunderstandingFlag: false,
        suggestedNextMode: 'switch',
        repetitionRisk: true,
        evidenceGainScore: 0.5,
      },
      coverageState: { missingTopics: [], coveredTopics: ['ownership'], weakAreas: [] },
      matchState: { validationTargets: [] },
      interviewStructure: { focusAreaKey: 'combined' },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.SWITCH_TOPIC);
    expect(plan.actionInput).toMatchObject({ targetTopic: 'next_topic', freshOnly: true });
  });
});
