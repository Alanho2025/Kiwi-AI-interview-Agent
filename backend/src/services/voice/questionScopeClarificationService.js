import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { ensureArray, normalizeText, tokenize } from '../../utils/commonHelpers.js';
import { getNextPoolQuestion } from '../interviewStateService.js';
import { buildSafeSpokenQuestion } from '../questions/interviewMicroPlanningService.js';
import { REAL_WORLD_CLARIFICATION_PATTERNS } from '../../config/realWorldInterviewPatterns.js';

const ELIGIBLE_AMBIGUITY_MODES = new Set(['bounded_scenario', 'open_scope_probe']);
const ASSUMPTION_PATTERN = /^(?:for this answer[, ]+)?(?:i(?:'|’)?ll|i will|let me)\s+assume\b/i;
const SKIP_QUESTION_PATTERN = /^(?:please\s+)?(?:skip|pass)(?:\s+(?:this|the))?(?:\s+question)?[.!]?$/i;
const SCOPE_QUESTION_PATTERNS = [
  /\bwould you like me to focus\b/i,
  /\bshould i focus\b/i,
  /\bdo you mean\b/i,
  /\bare you asking (?:about|for)\b/i,
  /\bis this (?:about|focused on)\b/i,
  /\bwhich (?:one|area|part|aspect|direction)\b/i,
  /\bwhat (?:scope|angle|level of detail|part)\b/i,
  /\bwhat exactly (?:should|do) i (?:cover|focus on|address)\b/i,
  /\bnot sure (?:which|whether|if you mean)\b/i,
];

const GENERAL_CLARIFICATION_INTENTS = Object.freeze([
  {
    intentType: 'request_repeat',
    patterns: [
      /\b(?:could|can|would|will) you (?:please )?(?:repeat|say) (?:that|the question)(?: again)?\b/i,
      /\b(?:repeat|say) (?:that|the question) again\b/i,
      /\bwhat was the question\b/i,
    ],
  },
  {
    intentType: 'request_shorter_question',
    patterns: [
      /\b(?:make|say|ask) (?:that|the question|it) (?:more )?(?:simple|simply|simpler|short|shorter|clear|clearly|clearer)\b/i,
      /\bshorter (?:and|or) simpler\b/i,
      /\b(?:break|split) (?:that|the question|it) down\b/i,
      /\bsimplify (?:that|the question|it)\b/i,
    ],
  },
  {
    intentType: 'ask_example_type',
    patterns: [
      /\b(?:could|can|would) you (?:please )?(?:give|provide) (?:me )?(?:an )?example\b/i,
      /\bwhat kind of (?:answer|example)\b/i,
      /\bexample of (?:what|the kind)\b/i,
    ],
  },
  {
    intentType: 'request_rephrase',
    patterns: [
      /\b(?:could|can|would) you (?:please )?rephrase (?:that|the question|it)\b/i,
      /\b(?:put|say) (?:that|the question|it) (?:in|a) (?:another|different) way\b/i,
      /\bunpack (?:that|the question|it)\b/i,
    ],
  },
  {
    intentType: 'ask_question_meaning',
    patterns: [
      /\bwhat (?:are|were) you asking\b/i,
      /\bwhat do you mean(?: by (?:that|the question))?\b/i,
      /\bwhat does (?:that(?: question)?|the question) mean\b/i,
    ],
  },
  {
    intentType: 'did_not_understand',
    patterns: [
      /\b(?:could|can|would) you (?:please )?(?:clarify|explain) (?:that|the question|what you(?:'re| are) asking)?\b/i,
      /\b(?:i )?(?:do not|don't|did not|didn't|cannot|can't|could not|couldn't) (?:really )?(?:understand|follow)\b/i,
      /\bnot sure what you(?:'re| are) asking\b/i,
      /\bunclear what you(?:'re| are) looking for\b/i,
      /\bclarif(?:y|ication).*\bwhat\b.*\bask/i,
    ],
  },
  {
    intentType: 'question_too_long',
    patterns: [
      /\b(?:too|quite|very) (?:long|wordy)\b/i,
      /\bthe question (?:has|had) too many words\b/i,
    ],
  },
  {
    intentType: 'request_slower_delivery',
    patterns: [
      /\b(?:could|can|would) you (?:please )?(?:speak|say (?:that|it)) (?:more )?slowly\b/i,
      /\bslow down\b/i,
      /\byou(?:'re| are) speaking too fast\b/i,
    ],
  },
  {
    intentType: 'ask_focus_or_scope',
    patterns: SCOPE_QUESTION_PATTERNS,
  },
  {
    intentType: 'ask_timeframe',
    patterns: [
      /\bwhat (?:timeframe|time frame|period|year|date range)\b/i,
      /\bhow recent\b/i,
      /\bfrom (?:which|what) (?:period|year|role)\b/i,
      /\bdoes it need to be (?:recent|from my current role)\b/i,
    ],
  },
  {
    intentType: 'confirm_candidate_understanding',
    patterns: [
      /\b(?:are|so are) you asking me to\b/i,
      /\b(?:is|so is) the question asking\b/i,
      /\bhave i understood (?:that|the question) correctly\b/i,
    ],
  },
  {
    intentType: 'question_too_complex',
    patterns: [
      /\b(?:too|very|quite) (?:complex|complicated)\b/i,
      /\bthere (?:are|were) too many parts\b/i,
      /\btoo many things in (?:that|the question)\b/i,
    ],
  },
  {
    intentType: 'question_too_ambiguous',
    patterns: [
      /\b(?:too|very|quite) (?:vague|ambiguous|broad)\b/i,
      /\bi (?:am|'m) not sure how to interpret\b/i,
      /\b(?:could|can|would) you (?:please )?be more specific\b/i,
      /\bplease be more specific\b/i,
    ],
  },
  {
    intentType: 'uncertain_help_request',
    patterns: [
      /\bi (?:am|'m) not sure how to answer\b/i,
      /\bi need (?:some )?help with (?:that|the question)\b/i,
      /\bi do not know where to start\b/i,
    ],
  },
]);

const GENERIC_CONTEXT_FALLBACK = 'Use the interpretation most relevant to your experience, state your assumption briefly, and answer with one concrete example.';
const REPEATED_REQUEST_FALLBACK = 'Choose one relevant example, briefly state the scope you are using, then explain what you did and what happened.';
const GENERIC_EXAMPLE_RESPONSE = 'A brief example from your own experience is fine. Explain the situation, what you personally did, and the result.';

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
  || turn?.id
  || null;

const resolveActiveQuestion = ({ transcript = [], activeQuestion = null } = {}) => {
  const transcriptQuestion = latestCountableQuestion(transcript);
  if (!activeQuestion) return transcriptQuestion;
  if (!transcriptQuestion) return activeQuestion;
  return resolveRootQuestionId(activeQuestion) === resolveRootQuestionId(transcriptQuestion)
    ? transcriptQuestion
    : activeQuestion;
};

const isScopeQuestion = (text = '') => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  const scopePatternMatched = SCOPE_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
  const questionLike = /[?？]\s*$/.test(normalized)
    || /^(?:would|should|do|does|did|are|is|which|what|could|can)\b/i.test(normalized)
    || /\b(?:would you like me to focus|not sure whether|not sure if you mean)\b/i.test(normalized);
  return questionLike && scopePatternMatched;
};

const SUBSTANTIVE_ACTION_PATTERN = /\b(?:i|we)\s+(?:analysed|analyzed|asked|built|checked|chose|clarified|compared|created|delivered|designed|documented|implemented|investigated|led|mapped|measured|narrowed|owned|profiled|reduced|reviewed|tested|treated|validated)\b/i;
const SUBSTANTIVE_RESULT_PATTERN = /\b(?:by\s+\d+|delivered|increased|improved|measured|outcome|reduced|result|saved|shipped|\d+\s*(?:%|percent|hours?|days?|weeks?))\b/i;

const hasSubstantiveAnswerContent = (text = '') => {
  const normalized = normalizeText(text);
  if (tokenize(normalized).length < 10) return false;
  return SUBSTANTIVE_ACTION_PATTERN.test(normalized)
    && (
      SUBSTANTIVE_RESULT_PATTERN.test(normalized)
      || /\b(?:so|then|and)\s+(?:i|we)\b/i.test(normalized)
    );
};

const resolveGeneralClarificationIntent = (text = '') => {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const matchedIntents = GENERAL_CLARIFICATION_INTENTS.filter(({ patterns }) => (
    patterns.some((pattern) => pattern.test(normalized))
  )).filter(({ intentType }) => (
    intentType !== 'ask_focus_or_scope' || isScopeQuestion(normalized)
  ));
  const priority = [
    'did_not_understand',
    'confirm_candidate_understanding',
    'request_slower_delivery',
    'question_too_complex',
    'question_too_ambiguous',
    'question_too_long',
    'request_rephrase',
    'ask_question_meaning',
  ];
  return priority
    .map((intentType) => matchedIntents.find((item) => item.intentType === intentType)?.intentType)
    .find(Boolean)
    || matchedIntents[0]?.intentType
    || null;
};

const candidateSafeQuestionText = (activeQuestion = {}) => {
  const question = normalizeText(activeQuestion?.text);
  if (!question) return 'Can you describe one relevant example from your experience?';
  if (/\bi want to validate (?:one )?possible gap\b|\blimited direct evidence\b|\bmatch gap\b/i.test(question)) {
    return 'Can you describe one relevant example from your experience and what you personally did?';
  }
  return question.length > 220
    ? `${question.slice(0, 217).replace(/\s+\S*$/, '')}?`
    : question;
};

const safePreparedQuestionText = (question = {}) => buildSafeSpokenQuestion({
  question: normalizeText(question?.text || question?.fallbackText),
  fallbackQuestion: normalizeText(question?.fallbackText || question?.text),
  deliveryMode: 'voice',
}).question;

const extractTargetSkillFromQuestion = (activeQuestion = {}) => {
  const metadata = activeQuestion?.metadata || {};
  const topic = normalizeText(metadata.topic || activeQuestion?.topic);
  if (topic && tokenize(topic).length <= 6 && !/\b(?:evidence|gap|coverage|score|risk|rubric|requirement|match_gap)\b/i.test(topic)) {
    return topic;
  }
  const matchedSkill = metadata.matchedSkill || metadata.requirement || metadata.category;
  if (matchedSkill && typeof matchedSkill === 'string' && !/\b(?:evidence|gap|requirement)\b/i.test(matchedSkill)) {
    return matchedSkill;
  }
  const questionText = normalizeText(activeQuestion?.text || metadata.fallbackText);
  const match = questionText.match(/\b(?:for|around|with|in|using|about)\s+([A-Za-z0-9+#.\- ]{2,30}?)(?=\s*(?:\?|\.|,|$|what|how))/i);
  if (match?.[1]) {
    const candidate = match[1].trim();
    if (!/\b(evidence|gap|requirement|experience|role|study|coursework)\b/i.test(candidate)) {
      return candidate;
    }
  }
  return null;
};

const candidateSafeTopic = (activeQuestion = {}) => {
  const skill = extractTargetSkillFromQuestion(activeQuestion);
  if (skill) {
    return `your experience with ${skill}`;
  }
  return 'one relevant example from your experience';
};

const buildGeneralClarificationResponse = ({ intentType, activeQuestion }) => {
  const question = candidateSafeQuestionText(activeQuestion);
  const skill = extractTargetSkillFromQuestion(activeQuestion);
  if (REAL_WORLD_CLARIFICATION_PATTERNS[intentType]) {
    return REAL_WORLD_CLARIFICATION_PATTERNS[intentType](skill);
  }
  if (intentType === 'request_repeat') return `Of course. The question is: ${question}`;
  if (intentType === 'request_slower_delivery') return `Of course. I will say it more slowly: ${question}`;
  if (intentType === 'ask_example_type') return GENERIC_EXAMPLE_RESPONSE;
  if (intentType === 'ask_timeframe') {
    return 'Use the most relevant recent example from your experience, unless the question names a specific timeframe.';
  }
  if (intentType === 'uncertain_help_request') {
    return `No problem. Start with one concrete example. The question is: ${question}`;
  }
  if (['request_shorter_question', 'question_too_long'].includes(intentType)) {
    return 'Sure. What is one relevant example, what did you personally do, and what happened?';
  }
  if (intentType === 'question_too_complex') {
    return 'Let’s take one part at a time. What is one relevant example, and what did you personally do?';
  }
  if (intentType === 'question_too_ambiguous') {
    return 'Use the scope most relevant to your experience. State that scope briefly, then explain what you did and the result.';
  }
  if (intentType === 'ask_question_meaning') {
    if (skill) {
      return `I am asking about your experience with ${skill}. What is one practical example of what you personally did and the result?`;
    }
    return `It is asking for ${candidateSafeTopic(activeQuestion)}, including what you personally did and what happened.`;
  }
  if (intentType === 'request_rephrase') {
    return `Another way to ask it is: What is ${candidateSafeTopic(activeQuestion)}, what did you personally do, and what happened?`;
  }
  return `Let’s simplify it: What is ${candidateSafeTopic(activeQuestion)}, what did you personally do, and what happened?`;
};

const isSubstantiveAssumption = (text = '') => {
  const normalized = normalizeText(text);
  if (!ASSUMPTION_PATTERN.test(normalized)) return false;
  return tokenize(normalized).length >= 12;
};

const countPriorScopeResponses = ({ transcript = [], rootQuestionId = null } = {}) => ensureArray(transcript)
  .filter((turn) => (
    turn?.role === 'ai'
    && (
      turn?.metadata?.turnType === QUESTION_SCOPE_TURN_TYPES.RESPONSE
      || Boolean(turn?.metadata?.scopeResponseReason)
    )
    && resolveRootQuestionId(turn) === rootQuestionId
  ))
  .length;

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
  activeQuestion: activeQuestionOverride = null,
} = {}) => {
  const transcript = ensureArray(session.transcript);
  const activeQuestion = resolveActiveQuestion({
    transcript,
    activeQuestion: activeQuestionOverride,
  });
  const rootQuestionId = resolveRootQuestionId(activeQuestion);
  const generalIntentType = resolveGeneralClarificationIntent(candidateText);
  if (!activeQuestion || !rootQuestionId) {
    return {
      kind: 'clarification_recovery',
      intentType: generalIntentType || 'active_question_unavailable',
      actionType: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      turnType: 'repair_prompt',
      countsAsQuestion: false,
      countsAsAnswer: false,
      rootQuestionId: null,
      parentQuestionId: null,
      scopeResponseReason: 'active_root_question_unavailable',
      responseText: 'I cannot safely recover the active question, so I will not score that response. Please restart this interview turn.',
    };
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

  if (hasSubstantiveAnswerContent(candidateText)) {
    return { kind: 'none', reason: 'substantive_answer_content' };
  }

  const priorResponseCount = countPriorScopeResponses({ transcript, rootQuestionId });
  if (priorResponseCount >= 2 && SKIP_QUESTION_PATTERN.test(normalizeText(candidateText))) {
    const nextQuestion = getNextPoolQuestion(session, { freshOnly: true });
    return {
      ...base,
      kind: 'skip_question_request',
      intentType: 'skip_question',
      actionType: AGENT_ACTION_TYPES.SWITCH_TOPIC,
      requestTurnType: 'question_skip_request',
      turnType: nextQuestion ? 'interview_question' : 'repair_prompt',
      scopeResponseReason: nextQuestion
        ? 'candidate_skipped_after_bounded_help'
        : 'candidate_skip_no_next_question',
      nextQuestion,
      nextRootQuestionId: nextQuestion?.questionId || nextQuestion?.id || null,
      responseText: nextQuestion
        ? `Okay, we’ll skip that one. ${safePreparedQuestionText(nextQuestion)}`
        : 'Okay, I will not score that question. There is no next prepared question available.',
    };
  }

  const scopeQuestion = isScopeQuestion(candidateText);
  const resolvedGeneralIntentType = scopeQuestion && ELIGIBLE_AMBIGUITY_MODES.has(ambiguityMode)
    ? null
    : generalIntentType;
  if (resolvedGeneralIntentType) {
    const generalPriorResponseCount = countPriorScopeResponses({ transcript, rootQuestionId });
    const skipOffered = generalPriorResponseCount >= 2;
    const repeated = generalPriorResponseCount >= 1;
    return {
      ...base,
      kind: skipOffered
        ? 'clarification_skip_offer'
        : repeated
          ? 'repeated_clarification_request'
          : 'clarification_request',
      intentType: resolvedGeneralIntentType,
      actionType: repeated
        ? AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION
        : AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      turnType: 'repair_prompt',
      scopeResponseReason: skipOffered
        ? 'repeated_clarification_skip_offered'
        : repeated
        ? 'repeated_clarification_request_bounded'
        : `candidate_requested_${resolvedGeneralIntentType}`,
      responseText: skipOffered
        ? 'We can skip this question without scoring it. Say “skip this question” to move on, or give one brief example if you want to continue.'
        : repeated
          ? `No problem. ${buildGeneralClarificationResponse({ intentType: resolvedGeneralIntentType, activeQuestion })}`
          : buildGeneralClarificationResponse({ intentType: resolvedGeneralIntentType, activeQuestion }),
    };
  }

  if (!scopeQuestion) {
    return { kind: 'none', reason: 'not_scope_question' };
  }

  if (!ELIGIBLE_AMBIGUITY_MODES.has(ambiguityMode)) {
    return { kind: 'none', reason: 'ambiguity_mode_none' };
  }

  const priorScopeResponseCount = countPriorScopeResponses({ transcript, rootQuestionId });
  if (priorScopeResponseCount >= 2) {
    return {
      ...base,
      kind: 'clarification_skip_offer',
      intentType: 'ask_focus_or_scope',
      actionType: AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION,
      turnType: 'repair_prompt',
      scopeResponseReason: 'repeated_clarification_skip_offered',
      responseText: 'We can skip this question without scoring it. Say “skip this question” to move on, or state one assumption and continue.',
    };
  }

  if (priorScopeResponseCount >= 1) {
    return {
      ...base,
      kind: 'repeated_scope_request',
      intentType: 'ask_focus_or_scope',
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
      intentType: 'ask_focus_or_scope',
      actionType: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      turnType: 'repair_prompt',
      scopeResponseReason: 'prepared_context_unavailable',
      responseText: GENERIC_CONTEXT_FALLBACK,
    };
  }

  return {
    ...base,
    kind: 'scope_request',
    intentType: 'ask_focus_or_scope',
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
  'clarification_request',
  'repeated_clarification_request',
  'clarification_skip_offer',
  'clarification_recovery',
  'skip_question_request',
].includes(observation.kind);

export const buildQuestionScopeTracePayload = (observation = {}) => ({
  selectedAction: observation.actionType || null,
  intentType: observation.intentType || null,
  scopeResponseReason: observation.scopeResponseReason || null,
  clarificationContextVersion: observation.clarificationContextVersion || null,
  rootQuestionRef: observation.rootQuestionId || null,
  countsAsQuestion: false,
  countsAsAnswer: false,
});
