import { normalizeFocusAreaKey } from '../../config/interviewBlueprints.js';

export const CASE_PRACTICE_PHASES = Object.freeze({
  TURN_1: { phase: 'CLARIFY', countsAsQuestion: true, isTerminal: false },
  TURN_2: { phase: 'STRUCTURE', countsAsQuestion: true, isTerminal: false },
  TURN_3: { phase: 'PROPOSE', countsAsQuestion: true, isTerminal: false },
  TURN_4: { phase: 'TRADE_OFF_STRESS', countsAsQuestion: true, isTerminal: false },
  TERMINAL: { phase: 'WRAP', countsAsQuestion: false, isTerminal: true },
});

export const isCasePracticeEligible = ({
  focusArea = '',
  controlMode = 'question_limited',
  timeLimitMinutes = 15,
  questionLimit = 8,
} = {}) => {
  const normalizedFocus = normalizeFocusAreaKey(focusArea);

  // Pure 'behavioral' mode is 100% BLOCKED
  if (normalizedFocus === 'behavioral') return false;

  // Time-limited requires >= 30m; Question-limited requires >= 12q
  const hasSufficientBudget = controlMode === 'time_limited'
    ? Number(timeLimitMinutes) >= 30
    : Number(questionLimit) >= 12;

  if (!hasSufficientBudget) return false;

  return normalizedFocus === 'technical' || normalizedFocus === 'combined';
};

export const shouldActivateCasePractice = ({
  settings = {},
  interviewPlan = {},
  eligibility = false,
} = {}) => {
  if (!eligibility) return { active: false, mode: null };

  if (settings?.practiceType === 'case') {
    return { active: true, mode: 'dedicated' };
  }

  if (
    settings?.enableCasePractice === true ||
    interviewPlan?.sections?.some((s) => s.type === 'case_practice')
  ) {
    return { active: true, mode: 'embedded' };
  }

  return { active: false, mode: null };
};

export const createCasePracticeState = ({ caseId = 'default_case' } = {}) => ({
  caseId,
  currentPhase: 'CLARIFY',
  assessedTurnCount: 1,
  maxTurns: 4,
  elapsedSeconds: 0,
  isTerminalTransition: false,
  countsAsQuestion: true,
});

export const advanceCasePracticePhase = ({
  state = {},
  isAcceptedAnswer = true,
  isRepairTurn = false,
} = {}) => {
  const current = state || createCasePracticeState();

  // Repair, rephrase, transcript clarification, and scaffold turns DO NOT advance phase
  if (isRepairTurn || !isAcceptedAnswer) {
    return { ...current };
  }

  const turnIndex = current.assessedTurnCount || 1;

  if (turnIndex === 1) {
    return {
      ...current,
      currentPhase: 'STRUCTURE',
      assessedTurnCount: 2,
      countsAsQuestion: true,
      isTerminalTransition: false,
    };
  }

  if (turnIndex === 2) {
    return {
      ...current,
      currentPhase: 'PROPOSE',
      assessedTurnCount: 3,
      countsAsQuestion: true,
      isTerminalTransition: false,
    };
  }

  if (turnIndex === 3) {
    return {
      ...current,
      currentPhase: 'TRADE_OFF_STRESS',
      assessedTurnCount: 4,
      countsAsQuestion: true,
      isTerminalTransition: false,
    };
  }

  // Terminal transition: WRAP
  return {
    ...current,
    currentPhase: 'WRAP',
    assessedTurnCount: 4,
    countsAsQuestion: false,
    isTerminalTransition: true,
  };
};

export default createCasePracticeState;
