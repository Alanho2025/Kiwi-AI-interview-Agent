import { describe, expect, it } from 'vitest';
import {
  orchestrateTurnRollout,
  attachRolloutTraceToDiagnostics,
} from '../../../src/services/questions/questionRolloutOrchestratorHelper.js';
import { ROLLOUT_MODES } from '../../../src/services/questions/questionRolloutModeService.js';

describe('questionRolloutOrchestratorHelper (QI-CP5 Slice 2)', () => {
  const legacyTurnOutput = { questionText: 'Tell me about a complex backend project.', scenario: 'root_cv_evidence' };
  const newDecision = { catalogQuestionId: 'sw_system_design_01', questionText: 'How did you handle database scaling?' };
  const sessionContext = { sessionId: 'sess_999', userId: 'user_888', turnIndex: 2, candidateLevel: 'senior', roleFamily: 'software' };

  describe('orchestrateTurnRollout', () => {
    it('returns legacy output and creates redacted trace in shadow mode', () => {
      const result = orchestrateTurnRollout({
        mode: ROLLOUT_MODES.SHADOW,
        legacyTurnOutput,
        newDecision,
        sessionContext,
      });

      expect(result.candidateVisibleOutput).toEqual(legacyTurnOutput);
      expect(result.isNewDecisionExposed).toBe(false);
      expect(result.rolloutMode).toBe(ROLLOUT_MODES.SHADOW);
      expect(result.redactedTrace.scenarioMetadata.sessionId).toBe('sess_999');
    });

    it('throws error when legacyTurnOutput is missing', () => {
      expect(() => {
        orchestrateTurnRollout({ legacyTurnOutput: null });
      }).toThrow('orchestrateTurnRollout requires legacyTurnOutput');
    });
  });

  describe('attachRolloutTraceToDiagnostics', () => {
    it('appends trace and updates active rollout mode in diagnostics', () => {
      const rolloutResult = orchestrateTurnRollout({
        mode: ROLLOUT_MODES.SHADOW,
        legacyTurnOutput,
        newDecision,
        sessionContext,
      });

      const initialDiagnostics = { sessionId: 'sess_999', rolloutTraces: [] };
      const updatedDiagnostics = attachRolloutTraceToDiagnostics(initialDiagnostics, rolloutResult);

      expect(updatedDiagnostics.rolloutTraces.length).toBe(1);
      expect(updatedDiagnostics.activeRolloutMode).toBe(ROLLOUT_MODES.SHADOW);
      expect(updatedDiagnostics.lastEvaluatedAt).toBeDefined();
    });
  });
});
