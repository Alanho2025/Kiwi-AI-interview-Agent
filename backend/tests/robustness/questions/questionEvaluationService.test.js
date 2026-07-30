import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_CATEGORIES,
  classifyEvidenceCategory,
  evaluateScenarioParity,
  buildEvaluationScorecard,
} from '../../../src/services/questions/questionEvaluationService.js';

describe('questionEvaluationService (QI-CP5)', () => {
  describe('classifyEvidenceCategory', () => {
    it('returns blocked_deferred when isBlocked is true', () => {
      const category = classifyEvidenceCategory({ isBlocked: true });
      expect(category).toBe(EVIDENCE_CATEGORIES.BLOCKED_DEFERRED);
    });

    it('returns production_verified when hasProductionProof is true', () => {
      const category = classifyEvidenceCategory({ hasProductionProof: true });
      expect(category).toBe(EVIDENCE_CATEGORIES.PRODUCTION_VERIFIED);
    });

    it('returns human_browser_validated when hasHumanBrowserProof is true', () => {
      const category = classifyEvidenceCategory({ hasHumanBrowserProof: true });
      expect(category).toBe(EVIDENCE_CATEGORIES.HUMAN_BROWSER_VALIDATED);
    });

    it('returns live_verified when hasLiveProviderProof is true', () => {
      const category = classifyEvidenceCategory({ hasLiveProviderProof: true });
      expect(category).toBe(EVIDENCE_CATEGORIES.LIVE_VERIFIED);
    });

    it('returns locally_verified when hasLocalTestsPassing is true', () => {
      const category = classifyEvidenceCategory({ hasLocalTestsPassing: true });
      expect(category).toBe(EVIDENCE_CATEGORIES.LOCALLY_VERIFIED);
    });

    it('returns implemented when hasCodeArtifact is true', () => {
      const category = classifyEvidenceCategory({ hasCodeArtifact: true });
      expect(category).toBe(EVIDENCE_CATEGORIES.IMPLEMENTED);
    });

    it('defaults to blocked_deferred when no evidence parameters are true', () => {
      const category = classifyEvidenceCategory({});
      expect(category).toBe(EVIDENCE_CATEGORIES.BLOCKED_DEFERRED);
    });
  });

  describe('evaluateScenarioParity', () => {
    it('evaluates a valid senior software scenario as passing', () => {
      const result = evaluateScenarioParity({
        scenarioId: 'scen_001_senior_sw',
        targetLevel: 'senior',
        roleFamily: 'software',
        scopeClarificationTurn: {
          incrementsQuestionCount: false,
          createsScoredAnswer: false,
        },
        reportCoaching: {
          summary: 'Candidate framed systemic trade-offs well.',
          clarificationScoreBand: 'strong',
        },
      });

      expect(result.scenarioId).toBe('scen_001_senior_sw');
      expect(result.passed).toBe(true);
      expect(result.checks.length).toBe(3);
    });

    it('fails parity check when scope clarification increments question count', () => {
      const result = evaluateScenarioParity({
        scenarioId: 'scen_002_invalid_scope',
        targetLevel: 'junior',
        roleFamily: 'data',
        scopeClarificationTurn: {
          incrementsQuestionCount: true,
          createsScoredAnswer: false,
        },
      });

      expect(result.passed).toBe(false);
      const scopeCheck = result.checks.find((c) => c.name === 'scope_clarification_non_countable');
      expect(scopeCheck.passed).toBe(false);
    });

    it('fails candidate safety check when report coaching leaks catalog question ID', () => {
      const result = evaluateScenarioParity({
        scenarioId: 'scen_003_metadata_leak',
        targetLevel: 'intermediate',
        roleFamily: 'ai_solution',
        reportCoaching: {
          catalogQuestionId: 'ai_assisted_delivery_01',
          feedback: 'Unsafe internal metadata included.',
        },
      });

      expect(result.passed).toBe(false);
      const safetyCheck = result.checks.find((c) => c.name === 'report_coaching_candidate_safety');
      expect(safetyCheck.passed).toBe(false);
    });

    it('throws error when scenarioId is missing', () => {
      expect(() => {
        evaluateScenarioParity({ targetLevel: 'senior', roleFamily: 'software' });
      }).toThrow('scenarioId must be a non-empty string');
    });
  });

  describe('buildEvaluationScorecard', () => {
    it('compiles correct totals, pass rates, and evidence summaries', () => {
      const verdicts = [
        { scenarioId: 's1', passed: true },
        { scenarioId: 's2', passed: true },
        { scenarioId: 's3', passed: false },
      ];
      const evidenceList = [
        { hasLocalTestsPassing: true },
        { hasHumanBrowserProof: true },
        { isBlocked: true },
      ];

      const scorecard = buildEvaluationScorecard(verdicts, evidenceList);

      expect(scorecard.totalScenarios).toBe(3);
      expect(scorecard.passedScenarios).toBe(2);
      expect(scorecard.failedScenarios).toBe(1);
      expect(scorecard.passRatePercent).toBe(67);
      expect(scorecard.evidenceSummary[EVIDENCE_CATEGORIES.LOCALLY_VERIFIED]).toBe(1);
      expect(scorecard.evidenceSummary[EVIDENCE_CATEGORIES.HUMAN_BROWSER_VALIDATED]).toBe(1);
      expect(scorecard.evidenceSummary[EVIDENCE_CATEGORIES.BLOCKED_DEFERRED]).toBe(1);
    });
  });
});
