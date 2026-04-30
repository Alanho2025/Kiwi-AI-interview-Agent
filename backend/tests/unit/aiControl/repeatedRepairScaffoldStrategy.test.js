import { describe, expect, it } from 'vitest';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';

describe('repeated repair scaffold strategy', () => {
  it('uses a scaffold question when the candidate asks for rephrasing twice', () => {
    const plan = selectNextAction({
      currentTopic: 'javascript',
      evaluatorState: {
        currentTopic: 'javascript',
        suggestedNextMode: 'rephrase',
        misunderstandingFlag: true,
        repairCount: 2,
      },
      interviewStructure: { currentTopicState: { repairCount: 2 } },
      candidateState: {},
      coverageState: {},
      matchState: {},
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION);
    expect(plan.actionInput.probeType).toBe('scaffold');
    expect(plan.rationale).toMatch(/reduce cognitive load|scaffold/i);
  });

  it('uses a scaffold question after repeated low-evidence probing on the same topic', () => {
    const plan = selectNextAction({
      currentTopic: 'owned_decision',
      candidateState: { specificityLevel: 'low' },
      evaluatorState: { suggestedNextMode: 'probe', lowEvidenceRepeated: true },
      interviewStructure: { currentTopicState: { followUpCount: 2 } },
      coverageState: {},
      matchState: {},
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION);
    expect(plan.actionInput.scaffoldStep).toBe('one_concrete_project');
  });
});
