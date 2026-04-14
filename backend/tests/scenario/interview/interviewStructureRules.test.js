import { describe, expect, it } from 'vitest';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';

const baseContext = {
  taskType: 'interview_next_turn',
  candidateState: { specificityLevel: 'medium' },
  coverageState: { missingTopics: [] },
  matchState: { validationTargets: [] },
  evaluatorState: { suggestedNextMode: 'deepen', misunderstandingFlag: false, closeCurrentIntent: false },
  dynamicSlotState: {},
  abductiveState: {},
  sectionState: {},
  currentStage: 'technical',
  currentTopic: 'tradeoff_reasoning',
};

describe('interview structure rules', () => {
  it('prefers a fresh pool question on anchor turns', () => {
    const plan = selectNextAction({
      ...baseContext,
      interviewStructure: { mustBeFreshQuestion: true, nextTurnIndex: 4, requiredCategory: 'technical', forceCategory: 'technical' },
    });
    expect(plan.selectedAction).toBe('ASK_POOL_QUESTION');
    expect(plan.actionInput.freshOnly).toBe(true);
    expect(plan.actionInput.category).toBe('technical');
  });

  it('stops extending a topic after two follow-ups', () => {
    const plan = selectNextAction({
      ...baseContext,
      interviewStructure: { mustBeFreshQuestion: false, currentTopicState: { exhausted: true }, forceCategory: 'behavioural' },
      evaluatorState: { suggestedNextMode: 'deepen', misunderstandingFlag: false, closeCurrentIntent: false },
    });
    expect(plan.selectedAction).toBe('ASK_POOL_QUESTION');
    expect(plan.actionInput.freshOnly).toBe(true);
  });
});
