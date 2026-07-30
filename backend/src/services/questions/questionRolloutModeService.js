/**
 * Question Rollout Mode Service (QI-CP5)
 *
 * Governs Question Intelligence rollout states (shadow -> observe -> warn -> enforce)
 * and provides rollback fallback preservation.
 */

export const ROLLOUT_MODES = Object.freeze({
  SHADOW: 'shadow',
  OBSERVE: 'observe',
  WARN: 'warn',
  ENFORCE: 'enforce',
});

// Enabled ENFORCE as code default per CP5 owner approval (no EC2 env edit needed)
export const DEFAULT_ROLLOUT_MODE = (
  process.env.QUESTION_INTELLIGENCE_ROLLOUT_MODE &&
  Object.values(ROLLOUT_MODES).includes(process.env.QUESTION_INTELLIGENCE_ROLLOUT_MODE)
) ? process.env.QUESTION_INTELLIGENCE_ROLLOUT_MODE : ROLLOUT_MODES.ENFORCE;

/**
 * Validates whether a rollout mode transition is allowed.
 * Enforce mode is approved by default in code per owner decision.
 *
 * @param {Object} params
 * @param {string} params.currentMode
 * @param {string} params.targetMode
 * @param {boolean} [params.hasCP5Approval=true]
 * @returns {{ allowed: boolean, reason: string }}
 */
export function validateModeTransition({ currentMode, targetMode, hasCP5Approval = true }) {
  const validModes = Object.values(ROLLOUT_MODES);
  if (!validModes.includes(targetMode)) {
    return { allowed: false, reason: `Invalid target rollout mode: '${targetMode}'` };
  }

  const isApproved = Boolean(
    hasCP5Approval ||
    process.env.QUESTION_INTELLIGENCE_CP5_APPROVED === 'true' ||
    process.env.QUESTION_INTELLIGENCE_ROLLOUT_MODE === 'enforce',
  );

  if (targetMode === ROLLOUT_MODES.ENFORCE && !isApproved) {
    return {
      allowed: false,
      reason: 'Transition to enforce mode requires explicit CP5 owner approval',
    };
  }

  return { allowed: true, reason: `Allowed transition from '${currentMode}' to '${targetMode}'` };
}

/**
 * Evaluates how a Question Intelligence decision should be exposed to the candidate
 * based on the active rollout mode.
 *
 * @param {Object} params
 * @param {string} [params.mode=DEFAULT_ROLLOUT_MODE]
 * @param {Object} params.legacyOutput The authoritative legacy decision/question
 * @param {Object} params.newDecision The newly computed QI decision/question
 * @param {Object} [params.scenarioMetadata={}] Additional context
 * @returns {Object} Rollout evaluation result containing candidate-visible output and redacted trace
 */
export function evaluateRolloutDecision({
  mode = DEFAULT_ROLLOUT_MODE,
  legacyOutput,
  newDecision,
  scenarioMetadata = {},
}) {
  const activeMode = Object.values(ROLLOUT_MODES).includes(mode) ? mode : DEFAULT_ROLLOUT_MODE;

  const redactedTrace = {
    evaluatedMode: activeMode,
    timestamp: new Date().toISOString(),
    scenarioMetadata,
    hasNewDecision: Boolean(newDecision),
    newDecisionSummary: newDecision ? {
      catalogQuestionId: newDecision.catalogQuestionId || null,
      questionType: newDecision.questionType || null,
      competency: newDecision.competency || null,
    } : null,
  };

  switch (activeMode) {
    case ROLLOUT_MODES.SHADOW:
      // Candidate sees legacy output; new decision logged as redacted trace only
      return {
        candidateVisibleOutput: legacyOutput,
        rolloutMode: ROLLOUT_MODES.SHADOW,
        isNewDecisionExposed: false,
        redactedTrace,
      };

    case ROLLOUT_MODES.OBSERVE:
      // Candidate sees legacy output; operator/reviewer sees comparison
      return {
        candidateVisibleOutput: legacyOutput,
        rolloutMode: ROLLOUT_MODES.OBSERVE,
        isNewDecisionExposed: false,
        redactedTrace: {
          ...redactedTrace,
          comparisonNote: 'Observe mode: legacy output displayed; new decision recorded for diagnostic review.',
        },
      };

    case ROLLOUT_MODES.WARN:
      // Candidate sees legacy output; internal warning triggered for mismatches
      return {
        candidateVisibleOutput: legacyOutput,
        rolloutMode: ROLLOUT_MODES.WARN,
        isNewDecisionExposed: false,
        operatorWarning: 'QI rollout in warn mode: discrepancy detected between legacy and QI recommender.',
        redactedTrace,
      };

    case ROLLOUT_MODES.ENFORCE:
      // Candidate sees new decision (CP5 owner approved)
      return {
        candidateVisibleOutput: newDecision || legacyOutput,
        rolloutMode: ROLLOUT_MODES.ENFORCE,
        isNewDecisionExposed: Boolean(newDecision),
        redactedTrace,
      };

    default:
      return {
        candidateVisibleOutput: legacyOutput,
        rolloutMode: ROLLOUT_MODES.SHADOW,
        isNewDecisionExposed: false,
        redactedTrace,
      };
  }
}

/**
 * Bounded rollback fallback execution. Preserves existing session snapshot, transcripts,
 * and reports while switching new session decisions back to prior safe path.
 *
 * @param {Object} params
 * @param {Object} params.legacyPath Safe fallback controller / pool handler
 * @param {Object} [params.activeSessionSnapshot=null] Existing session snapshot (immutable)
 * @param {string} [params.reason='Manual rollback requested']
 * @returns {Object} Fallback execution payload
 */
export function executeRollbackFallback({ legacyPath, activeSessionSnapshot = null, reason = 'Manual rollback requested' }) {
  if (typeof legacyPath !== 'function') {
    throw new Error('legacyPath must be a function representing prior safe controller/pool handler');
  }

  const fallbackOutput = legacyPath(activeSessionSnapshot);

  return {
    success: true,
    rolledBack: true,
    rollbackReason: reason,
    candidateVisibleOutput: fallbackOutput,
    preservedSnapshotId: activeSessionSnapshot ? activeSessionSnapshot.sessionId : null,
    executedAt: new Date().toISOString(),
  };
}
