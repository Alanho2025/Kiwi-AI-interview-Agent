import { describe, expect, it } from 'vitest';
import {
  createCasePracticeState,
  advanceCasePracticePhase,
  isCasePracticeEligible,
  shouldActivateCasePractice,
} from '../../../src/services/interview/casePracticeStateMachineService.js';

describe('casePracticeStateMachineService & interviewModeGuard (V6 Blueprint)', () => {
  it('enforces eligibility and budget rules correctly', () => {
    // 8-question / 15-minute technical interviews are 100% BLOCKED
    expect(isCasePracticeEligible({ focusArea: 'technical', controlMode: 'question_limited', questionLimit: 8 })).toBe(false);
    expect(isCasePracticeEligible({ focusArea: 'technical', controlMode: 'time_limited', timeLimitMinutes: 15 })).toBe(false);

    // Pure behavioral mode is 100% BLOCKED
    expect(isCasePracticeEligible({ focusArea: 'behavioral', controlMode: 'time_limited', timeLimitMinutes: 30 })).toBe(false);

    // Both Technical and Combined with 30m / 12q+ are ELIGIBLE
    expect(isCasePracticeEligible({ focusArea: 'technical', controlMode: 'question_limited', questionLimit: 12 })).toBe(true);
    expect(isCasePracticeEligible({ focusArea: 'combined', controlMode: 'time_limited', timeLimitMinutes: 30 })).toBe(true);
  });

  it('distinguishes dedicated vs embedded case practice modes', () => {
    const dedicated = shouldActivateCasePractice({
      settings: { practiceType: 'case' },
      eligibility: true,
    });
    expect(dedicated).toEqual({ active: true, mode: 'dedicated' });

    const embedded = shouldActivateCasePractice({
      settings: { enableCasePractice: true },
      eligibility: true,
    });
    expect(embedded).toEqual({ active: true, mode: 'embedded' });

    const blocked = shouldActivateCasePractice({
      settings: { enableCasePractice: true },
      eligibility: false,
    });
    expect(blocked).toEqual({ active: false, mode: null });
  });

  it('advances through 4 assessed turns and transitions WRAP as non-counted terminal', () => {
    let state = createCasePracticeState({ caseId: 'bakery_pos' });
    expect(state.currentPhase).toBe('CLARIFY');
    expect(state.assessedTurnCount).toBe(1);

    // Turn 1 -> Turn 2
    state = advanceCasePracticePhase({ state, isAcceptedAnswer: true });
    expect(state.currentPhase).toBe('STRUCTURE');
    expect(state.assessedTurnCount).toBe(2);

    // Turn 2 -> Turn 3
    state = advanceCasePracticePhase({ state, isAcceptedAnswer: true });
    expect(state.currentPhase).toBe('PROPOSE');
    expect(state.assessedTurnCount).toBe(3);

    // Turn 3 -> Turn 4
    state = advanceCasePracticePhase({ state, isAcceptedAnswer: true });
    expect(state.currentPhase).toBe('TRADE_OFF_STRESS');
    expect(state.assessedTurnCount).toBe(4);

    // Turn 4 -> Terminal WRAP
    state = advanceCasePracticePhase({ state, isAcceptedAnswer: true });
    expect(state.currentPhase).toBe('WRAP');
    expect(state.isTerminalTransition).toBe(true);
    expect(state.countsAsQuestion).toBe(false);
  });

  it('freezes phase advancement during repair or clarification turns', () => {
    let state = createCasePracticeState({ caseId: 'system_design' });
    expect(state.currentPhase).toBe('CLARIFY');

    // Repair turn does NOT advance phase
    state = advanceCasePracticePhase({ state, isAcceptedAnswer: false, isRepairTurn: true });
    expect(state.currentPhase).toBe('CLARIFY');
    expect(state.assessedTurnCount).toBe(1);
  });
});
