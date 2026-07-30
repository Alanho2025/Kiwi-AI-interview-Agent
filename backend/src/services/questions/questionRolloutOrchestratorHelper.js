/**
 * Question Rollout Orchestrator Helper (QI-CP5)
 *
 * Integrates rollout mode evaluation into session turn orchestration.
 */

import {
  DEFAULT_ROLLOUT_MODE,
  ROLLOUT_MODES,
  evaluateRolloutDecision,
} from './questionRolloutModeService.js';

/**
 * Orchestrates a turn rollout decision during an active Voice session turn.
 *
 * @param {Object} params
 * @param {string} [params.mode=DEFAULT_ROLLOUT_MODE] Active rollout mode
 * @param {Object} params.legacyTurnOutput Authoritative legacy question/turn output
 * @param {Object} [params.newDecision=null] Newly computed Question Intelligence decision
 * @param {Object} [params.sessionContext={}] Session metadata (sessionId, userId, turnIndex)
 * @returns {{ candidateVisibleOutput: Object, rolloutMode: string, isNewDecisionExposed: boolean, redactedTrace: Object }}
 */
export function orchestrateTurnRollout({
  mode = DEFAULT_ROLLOUT_MODE,
  legacyTurnOutput,
  newDecision = null,
  sessionContext = {},
}) {
  if (!legacyTurnOutput) {
    throw new Error('orchestrateTurnRollout requires legacyTurnOutput');
  }

  const result = evaluateRolloutDecision({
    mode,
    legacyOutput: legacyTurnOutput,
    newDecision,
    scenarioMetadata: {
      sessionId: sessionContext.sessionId || null,
      userId: sessionContext.userId || null,
      turnIndex: sessionContext.turnIndex || 0,
      candidateLevel: sessionContext.candidateLevel || 'senior',
      roleFamily: sessionContext.roleFamily || 'software',
    },
  });

  return result;
}

/**
 * Appends a redacted rollout trace to session diagnostics object.
 *
 * @param {Object} diagnostics Active session diagnostics object
 * @param {Object} rolloutResult Result from orchestrateTurnRollout
 * @returns {Object} Updated diagnostics object
 */
export function attachRolloutTraceToDiagnostics(diagnostics = {}, rolloutResult = {}) {
  const currentTraces = Array.isArray(diagnostics.rolloutTraces) ? diagnostics.rolloutTraces : [];

  return {
    ...diagnostics,
    rolloutTraces: [
      ...currentTraces,
      rolloutResult.redactedTrace || { timestamp: new Date().toISOString(), mode: ROLLOUT_MODES.SHADOW },
    ],
    activeRolloutMode: rolloutResult.rolloutMode || ROLLOUT_MODES.SHADOW,
    lastEvaluatedAt: new Date().toISOString(),
  };
}
