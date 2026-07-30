/**
 * Question Evaluation Service (QI-CP5)
 *
 * Provides reproducible evaluation, frozen scenario verification, and evidence
 * taxonomy classification for Voice Question Intelligence under QI-CP5.
 */

export const EVIDENCE_CATEGORIES = Object.freeze({
  IMPLEMENTED: 'implemented',
  LOCALLY_VERIFIED: 'locally_verified',
  LIVE_VERIFIED: 'live_verified',
  HUMAN_BROWSER_VALIDATED: 'human_browser_validated',
  PRODUCTION_VERIFIED: 'production_verified',
  BLOCKED_DEFERRED: 'blocked_deferred',
});

export const VALID_ROLE_FAMILIES = Object.freeze([
  'software',
  'data',
  'ai_solution',
  'ml',
  'non_tech',
]);

export const VALID_LEVELS = Object.freeze(['junior', 'intermediate', 'senior']);

/**
 * Classifies an evidence entry into a single standard evidence category.
 *
 * @param {Object} params
 * @param {boolean} [params.isBlocked=false]
 * @param {boolean} [params.hasProductionProof=false]
 * @param {boolean} [params.hasHumanBrowserProof=false]
 * @param {boolean} [params.hasLiveProviderProof=false]
 * @param {boolean} [params.hasLocalTestsPassing=false]
 * @param {boolean} [params.hasCodeArtifact=false]
 * @returns {string} One of EVIDENCE_CATEGORIES
 */
export function classifyEvidenceCategory({
  isBlocked = false,
  hasProductionProof = false,
  hasHumanBrowserProof = false,
  hasLiveProviderProof = false,
  hasLocalTestsPassing = false,
  hasCodeArtifact = false,
} = {}) {
  if (isBlocked) {
    return EVIDENCE_CATEGORIES.BLOCKED_DEFERRED;
  }
  if (hasProductionProof) {
    return EVIDENCE_CATEGORIES.PRODUCTION_VERIFIED;
  }
  if (hasHumanBrowserProof) {
    return EVIDENCE_CATEGORIES.HUMAN_BROWSER_VALIDATED;
  }
  if (hasLiveProviderProof) {
    return EVIDENCE_CATEGORIES.LIVE_VERIFIED;
  }
  if (hasLocalTestsPassing) {
    return EVIDENCE_CATEGORIES.LOCALLY_VERIFIED;
  }
  if (hasCodeArtifact) {
    return EVIDENCE_CATEGORIES.IMPLEMENTED;
  }
  return EVIDENCE_CATEGORIES.BLOCKED_DEFERRED;
}

/**
 * Evaluates a single Voice Question Intelligence scenario for parity and safety.
 *
 * @param {Object} params
 * @param {string} params.scenarioId
 * @param {string} params.targetLevel
 * @param {string} params.roleFamily
 * @param {Object} [params.questionSelection]
 * @param {Object} [params.scopeClarificationTurn]
 * @param {Object} [params.reportCoaching]
 * @returns {Object} Evaluation verdict
 */
export function evaluateScenarioParity({
  scenarioId,
  targetLevel,
  roleFamily,
  questionSelection = {},
  scopeClarificationTurn = null,
  reportCoaching = null,
}) {
  if (!scenarioId || typeof scenarioId !== 'string') {
    throw new Error('scenarioId must be a non-empty string');
  }

  const normalizedLevel = (targetLevel || '').toLowerCase();
  const normalizedRole = (roleFamily || '').toLowerCase();

  const levelValid = VALID_LEVELS.includes(normalizedLevel);
  const roleValid = VALID_ROLE_FAMILIES.includes(normalizedRole);

  const checks = [];

  // Check 1: Level and Role Family Validity
  checks.push({
    name: 'level_role_validity',
    passed: levelValid && roleValid,
    detail: levelValid && roleValid
      ? `Level '${normalizedLevel}' and role '${normalizedRole}' are valid`
      : `Invalid level '${targetLevel}' or role '${roleFamily}'`,
  });

  // Check 2: Question Selection Structure
  if (questionSelection && typeof questionSelection === 'object' && Object.keys(questionSelection).length > 0) {
    const hasValidSelection = Boolean(questionSelection.catalogQuestionId || questionSelection.questionType);
    checks.push({
      name: 'question_selection_validity',
      passed: hasValidSelection,
      detail: hasValidSelection
        ? 'Question selection has valid catalog identifier or question type'
        : 'Question selection missing catalog identifier or question type',
    });
  }

  // Check 3: Scope clarification non-countability (if scope turn exists)
  if (scopeClarificationTurn) {
    const isNonCountable = scopeClarificationTurn.incrementsQuestionCount === false;
    const isNonScored = scopeClarificationTurn.createsScoredAnswer === false;
    const scopePassed = isNonCountable && isNonScored;

    checks.push({
      name: 'scope_clarification_non_countable',
      passed: scopePassed,
      detail: scopePassed
        ? 'Scope clarification correctly marked non-countable and non-scored'
        : 'Scope clarification violated turn countability contract',
    });
  }

  // Check 4: Report coaching candidate safety (no internal IDs / scoring metadata leakage)
  if (reportCoaching) {
    const textToScan = JSON.stringify(reportCoaching);
    const leaksCatalogId = /catalogQuestionId/i.test(textToScan);
    const leaksInternalScore = /internalRawScore/i.test(textToScan);
    const noLeak = !leaksCatalogId && !leaksInternalScore;

    checks.push({
      name: 'report_coaching_candidate_safety',
      passed: noLeak,
      detail: noLeak
        ? 'Report coaching contains no candidate-unsafe internal metadata'
        : 'Report coaching leaked internal metadata',
    });
  }

  const allPassed = checks.every((c) => c.passed);

  return {
    scenarioId,
    targetLevel: normalizedLevel,
    roleFamily: normalizedRole,
    passed: allPassed,
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Compiles a structured evaluation scorecard across multiple scenario verdicts.
 *
 * @param {Array<Object>} verdicts Array of evaluateScenarioParity outputs
 * @param {Array<Object>} evidenceList Array of raw evidence records
 * @returns {Object} Summary scorecard
 */
export function buildEvaluationScorecard(verdicts = [], evidenceList = []) {
  const totalScenarios = verdicts.length;
  const passedScenarios = verdicts.filter((v) => v.passed).length;
  const failedScenarios = totalScenarios - passedScenarios;

  const evidenceSummary = evidenceList.reduce((acc, item) => {
    const cat = classifyEvidenceCategory(item);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return {
    totalScenarios,
    passedScenarios,
    failedScenarios,
    passRatePercent: totalScenarios > 0 ? Math.round((passedScenarios / totalScenarios) * 100) : 0,
    evidenceSummary,
    generatedAt: new Date().toISOString(),
  };
}
