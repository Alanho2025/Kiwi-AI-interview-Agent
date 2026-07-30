import { describe, expect, it } from 'vitest';
import {
  ROLLOUT_MODES,
  validateModeTransition,
  evaluateRolloutDecision,
  executeRollbackFallback,
} from '../../../src/services/questions/questionRolloutModeService.js';

describe('questionRolloutModeService (QI-CP5)', () => {
  describe('validateModeTransition', () => {
    it('disallows transition to enforce mode without CP5 approval', () => {
      const result = validateModeTransition({
        currentMode: ROLLOUT_MODES.SHADOW,
        targetMode: ROLLOUT_MODES.ENFORCE,
        hasCP5Approval: false,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('requires explicit CP5 owner approval');
    });

    it('allows transition to enforce mode with CP5 approval', () => {
      const result = validateModeTransition({
        currentMode: ROLLOUT_MODES.WARN,
        targetMode: ROLLOUT_MODES.ENFORCE,
        hasCP5Approval: true,
      });

      expect(result.allowed).toBe(true);
    });

    it('allows transition between non-enforce modes without approval', () => {
      const result = validateModeTransition({
        currentMode: ROLLOUT_MODES.SHADOW,
        targetMode: ROLLOUT_MODES.OBSERVE,
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('evaluateRolloutDecision', () => {
    const legacyOutput = { text: 'What is your experience with React?' };
    const newDecision = { catalogQuestionId: 'q_react_01', questionType: 'behavioral', text: 'How do you structure React state?' };

    it('returns legacy output and stores redacted trace in shadow mode', () => {
      const result = evaluateRolloutDecision({
        mode: ROLLOUT_MODES.SHADOW,
        legacyOutput,
        newDecision,
      });

      expect(result.candidateVisibleOutput).toEqual(legacyOutput);
      expect(result.isNewDecisionExposed).toBe(false);
      expect(result.redactedTrace.evaluatedMode).toBe(ROLLOUT_MODES.SHADOW);
      expect(result.redactedTrace.hasNewDecision).toBe(true);
    });

    it('returns legacy output with operator warning in warn mode', () => {
      const result = evaluateRolloutDecision({
        mode: ROLLOUT_MODES.WARN,
        legacyOutput,
        newDecision,
      });

      expect(result.candidateVisibleOutput).toEqual(legacyOutput);
      expect(result.isNewDecisionExposed).toBe(false);
      expect(result.operatorWarning).toContain('discrepancy detected');
    });

    it('exposes new decision in enforce mode', () => {
      const result = evaluateRolloutDecision({
        mode: ROLLOUT_MODES.ENFORCE,
        legacyOutput,
        newDecision,
      });

      expect(result.candidateVisibleOutput).toEqual(newDecision);
      expect(result.isNewDecisionExposed).toBe(true);
    });
  });

  describe('executeRollbackFallback', () => {
    it('executes fallback handler and preserves active session snapshot', () => {
      const mockLegacyPath = (snapshot) => ({
        text: `Fallback question for session ${snapshot?.sessionId}`,
      });
      const snapshot = { sessionId: 'sess_12345' };

      const result = executeRollbackFallback({
        legacyPath: mockLegacyPath,
        activeSessionSnapshot: snapshot,
        reason: 'Detected latency threshold violation',
      });

      expect(result.success).toBe(true);
      expect(result.rolledBack).toBe(true);
      expect(result.preservedSnapshotId).toBe('sess_12345');
      expect(result.candidateVisibleOutput.text).toBe('Fallback question for session sess_12345');
    });

    it('throws error if legacyPath is not a function', () => {
      expect(() => {
        executeRollbackFallback({ legacyPath: null });
      }).toThrow('legacyPath must be a function');
    });
  });
});
