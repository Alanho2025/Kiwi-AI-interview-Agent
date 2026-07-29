import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { ensureArray, normalizeText, tokenize } from '../../utils/commonHelpers.js';

const ELIGIBLE_AMBIGUITY_MODES = new Set(['bounded_scenario', 'open_scope_probe']);
const ASSUMPTION_PATTERN = /^(?:for this answer[, ]+)?(?:i(?:'|’)?ll|i will|let me)\s+assume\b/i;
const SCOPE_QUESTION_PATTERNS = [
  /\bwould you like me to focus\b/i,
  /\bshould i focus\b/i,
  /\bdo you mean\b/i,
  /\bare you asking (?:about|for)\b/i,
  /\bis this (?:about|focused on)\b/i,
  /\bwhich (?:one|area|part|aspect|direction)\b/i,
  /\bwhat (?:scope|angle|level of detail|part)\b/i,
  /\bnot sure (?:which|whether|if you mean)\b/i,
];

const GENERIC_CONTEXT_FALLBACK = 'Use the interpretation most relevant to your experience, state your assumption briefly, and answer with one concrete example.';
const REPEATED_REQUEST_FALLBACK = 'Choose one relevant example, briefly state the scope you are using, then explain what you did and what happened.';

export const QUESTION_SCOPE_TURN_TYPES = Object.freeze({
  REQUEST: 'question_scope_clarification_request',
  RESPONSE: 'question_scope_clarification',
});

const latestCountableQuestion = (transcript = []) => [...ensureArray(transcript)]
  .reverse()
  .find((turn) => (
    ['ai', 'assistant', 'interviewer'].includes(String(turn?.role || '').toLowerCase())
    && turn?.metadata?.countsAsQuestion !== false
    && String(turn?.metadata?.turnType || 'interview_question') === 'interview_question'
  )) || null;

const resolveRootQuestionId = (turn = {}) => turn?.metadata?.rootQuestionId
  || turn?.questionId
  || turn?.metadata?.questionId
  || turn?.metadata?.preparedQuestionId
  || null;

const isScopeQuestion = (text = '') => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  const scopePatternMatched = SCOPE_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
  const questionLike = /[?？]\s*$/.test(normalized)
    || /^(?:would|should|do|does|did|are|is|which|what|could|can)\b/i.test(normalized)
    || /\b(?:would you like me to focus|not sure whether|not sure if you mean)\b/i.test(normalized);
  return questionLike && scopePatternMatched;
};

const isSubstantiveAssumption = (text = '') => {
  const normalized = normalizeText(text);
  if (!ASSUMPTION_PATTERN.test(normalized)) return false;
  return tokenize(normalized).length >= 12;
};

const hasPriorScopeResponse = ({ transcript = [], rootQuestionId = null } = {}) => ensureArray(transcript)
  .some((turn) => (
    turn?.role === 'ai'
    && (
      turn?.metadata?.turnType === QUESTION_SCOPE_TURN_TYPES.RESPONSE
      || Boolean(turn?.metadata?.scopeResponseReason)
    )
    && resolveRootQuestionId(turn) === rootQuestionId
  ));

const resolvePreparedContext = (metadata = {}) => {
  const responseText = normalizeText(metadata.clarificationContext?.responseText);
  const version = normalizeText(metadata.clarificationContextVersion);
  if (!responseText || !version) return null;
  return { responseText, version };
};

const buildBaseObservation = ({ activeQuestion, rootQuestionId }) => ({
  rootQuestionId,
  parentQuestionId: rootQuestionId,
  preparedQuestionId: activeQuestion?.metadata?.preparedQuestionId || null,
  catalogQuestionId: activeQuestion?.metadata?.catalogQuestionId || null,
  ambiguityMode: activeQuestion?.metadata?.ambiguityMode || 'none',
  stage: activeQuestion?.metadata?.stage || null,
  topic: activeQuestion?.metadata?.topic || null,
  questionCategory: activeQuestion?.metadata?.questionCategory || null,
  countsAsQuestion: false,
  countsAsAnswer: false,
});

export const resolveQuestionScopeObservation = ({
  session = {},
  candidateText = '',
} = {}) => {
  const transcript = ensureArray(session.transcript);
  const activeQuestion = latestCountableQuestion(transcript);
  const rootQuestionId = resolveRootQuestionId(activeQuestion);
  if (!activeQuestion || !rootQuestionId) {
    return { kind: 'none', reason: 'active_root_question_unavailable' };
  }

  const base = buildBaseObservation({ activeQuestion, rootQuestionId });
  const ambiguityMode = base.ambiguityMode;

  if (isSubstantiveAssumption(candidateText) && ELIGIBLE_AMBIGUITY_MODES.has(ambiguityMode)) {
    return {
      ...base,
      kind: 'explicit_assumption',
      scopeFraming: 'explicit_assumption',
      countsAsAnswer: true,
    };
  }

  if (!isScopeQuestion(candidateText)) {
    return { kind: 'none', reason: 'not_scope_question' };
  }

  if (!ELIGIBLE_AMBIGUITY_MODES.has(ambiguityMode)) {
    return { kind: 'none', reason: 'ambiguity_mode_none' };
  }

  if (hasPriorScopeResponse({ transcript, rootQuestionId })) {
    return {
      ...base,
      kind: 'repeated_scope_request',
      actionType: AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION,
      turnType: 'repair_prompt',
      scopeResponseReason: 'repeated_scope_request_bounded',
      responseText: REPEATED_REQUEST_FALLBACK,
    };
  }

  const preparedContext = resolvePreparedContext(activeQuestion.metadata || {});
  if (!preparedContext) {
    return {
      ...base,
      kind: 'scope_request_degraded',
      actionType: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      turnType: 'repair_prompt',
      scopeResponseReason: 'prepared_context_unavailable',
      responseText: GENERIC_CONTEXT_FALLBACK,
    };
  }

  return {
    ...base,
    kind: 'scope_request',
    actionType: AGENT_ACTION_TYPES.ANSWER_QUESTION_SCOPE,
    turnType: QUESTION_SCOPE_TURN_TYPES.RESPONSE,
    scopeResponseReason: 'candidate_requested_focus',
    clarificationContextVersion: preparedContext.version,
    responseText: preparedContext.responseText,
  };
};

export const isActionableQuestionScopeObservation = (observation = {}) => [
  'scope_request',
  'scope_request_degraded',
  'repeated_scope_request',
].includes(observation.kind);

export const buildQuestionScopeTracePayload = (observation = {}) => ({
  selectedAction: observation.actionType || null,
  scopeResponseReason: observation.scopeResponseReason || null,
  clarificationContextVersion: observation.clarificationContextVersion || null,
  rootQuestionRef: observation.rootQuestionId || null,
  countsAsQuestion: false,
  countsAsAnswer: false,
});
