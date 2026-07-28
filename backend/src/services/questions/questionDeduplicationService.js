import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';

const NON_QUESTION_TURN_TYPES = new Set(['system', 'bridge_acknowledgement', 'acknowledgement']);
const NON_COUNTABLE_TURN_TYPES = new Set([
  ...NON_QUESTION_TURN_TYPES,
  'repair_prompt',
  'transcript_confirmation',
  'clarification',
  'question_scope_clarification',
  'repeat_request',
]);

const TOPIC_ALIASES = [
  { key: 'teamwork', pattern: /\b(collaboration|collaborative|teamwork|cross functional|cross-functional)\b/ },
  { key: 'ownership', pattern: /\b(ownership|accountability|accountable)\b/ },
  { key: 'documentation', pattern: /\b(documentation|report writing|report-writing|written reporting)\b/ },
  { key: 'communication', pattern: /\b(communication|stakeholder communication|stakeholder-communication)\b/ },
  { key: 'leadership', pattern: /\b(leadership|influence|influencing|mentoring)\b/ },
  { key: 'database', pattern: /\b(sql|postgres|postgresql|relational database)\b/ },
];

const MEANINGLESS_TOKENS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'did', 'do', 'for', 'from', 'had', 'has', 'have',
  'how', 'i', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'the', 'that', 'this', 'to', 'was',
  'were', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your',
]);

const questionFields = (question = {}) => ({
  ...question,
  ...(question.metadata || {}),
  text: question.text || question.fallbackText || question.spokenDraft || '',
  questionId: question.questionId || question.id || question.sourceId || null,
});

export const buildQuestionFingerprint = (text = '') => String(text || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/behavioural/g, 'behavioral')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const canonicalTopic = (value = '') => {
  const normalized = buildQuestionFingerprint(value).replace(/\bbehavioral\b/g, '').trim();
  const alias = TOPIC_ALIASES.find((item) => item.pattern.test(normalized));
  return alias?.key || normalized.replace(/\s+/g, '_') || 'role_fit';
};

const canonicalValue = (value = '', fallback = 'general') => buildQuestionFingerprint(value)
  .replace(/\bbehavioral\b/g, 'behavioural')
  .replace(/\s+/g, '_') || fallback;

const resolveTurnKind = (question = {}) => {
  const fields = questionFields(question);
  const explicit = normalizeKey(fields.turnKind);
  if (explicit === 'repair') return 'repair';
  if (explicit === 'follow_up') return 'follow_up';
  if (explicit === 'root_question') return 'root_question';
  if (NON_COUNTABLE_TURN_TYPES.has(normalizeKey(fields.turnType))) return 'repair';
  return Number(fields.followUpDepth || 0) > 0 ? 'follow_up' : 'root_question';
};

export const buildAssessmentKey = (question = {}) => {
  const fields = questionFields(question);
  const turnKind = resolveTurnKind(fields);
  if (turnKind === 'repair') {
    return `repair:${canonicalValue(fields.parentQuestionId || fields.rootQuestionId, 'current')}:${canonicalValue(fields.scenario || fields.turnType, 'repair')}`;
  }
  if (turnKind === 'follow_up') {
    const root = canonicalValue(fields.rootQuestionId || fields.rootTopic || fields.topic, 'current');
    const intent = canonicalValue(fields.followUpIntent || fields.questionGoal || fields.questionIntent || fields.questionType || fields.type, 'clarification');
    const target = canonicalValue(fields.evidenceTarget || fields.expectedSignal?.[0] || intent, intent);
    return `follow_up:${root}:${intent}:${target}`;
  }
  const topic = canonicalTopic(fields.rootTopic || fields.topic || fields.competency || fields.questionType || fields.type);
  const family = canonicalValue(fields.questionFamily || fields.category || fields.questionCategory || fields.stage, 'experience');
  return `root:${topic}:${family}`;
};

const isAiTurn = (turn = {}) => ['ai', 'assistant', 'interviewer'].includes(normalizeKey(turn.role));

const isSpokenQuestion = (turn = {}) => {
  const fields = questionFields(turn);
  if (!isAiTurn(turn) || !normalizeText(fields.text)) return false;
  return !NON_QUESTION_TURN_TYPES.has(normalizeKey(fields.turnType));
};

const isCountableQuestion = (turn = {}) => {
  const fields = questionFields(turn);
  if (!isSpokenQuestion(turn) || fields.countsAsQuestion === false) return false;
  if (NON_COUNTABLE_TURN_TYPES.has(normalizeKey(fields.turnType))) return false;
  return fields.countsAsQuestion === true
    || Boolean(fields.questionType || fields.turnKind || fields.stage || fields.topic || /[?？]\s*$/.test(fields.text));
};

const toHistoryEntry = (turn = {}) => {
  const fields = questionFields(turn);
  return {
    questionId: fields.questionId,
    text: normalizeText(fields.text),
    assessmentKey: fields.assessmentKey || buildAssessmentKey(fields),
    fingerprint: fields.questionFingerprint || buildQuestionFingerprint(fields.text),
    turnKind: resolveTurnKind(fields),
    turnType: fields.turnType || null,
    countsAsQuestion: isCountableQuestion(turn),
    topic: fields.topic || '',
    followUpDepth: Number(fields.followUpDepth || 0),
    questionCategory: fields.questionCategory || fields.category || '',
    questionType: fields.questionType || fields.type || '',
    stage: fields.stage || '',
  };
};

export const buildQuestionHistory = (transcript = []) => {
  const spokenQuestions = ensureArray(transcript).filter(isSpokenQuestion).map(toHistoryEntry);
  return {
    spokenQuestions,
    countableQuestions: spokenQuestions.filter((item) => item.countsAsQuestion),
    repairQuestions: spokenQuestions.filter((item) => item.turnKind === 'repair'),
    assessmentKeys: new Set(spokenQuestions.map((item) => item.assessmentKey).filter(Boolean)),
    fingerprints: new Set(spokenQuestions.map((item) => item.fingerprint).filter(Boolean)),
  };
};

const meaningfulTokens = (text = '') => buildQuestionFingerprint(text)
  .split(' ')
  .filter((token) => token.length > 1 && !MEANINGLESS_TOKENS.has(token));

const textSimilarity = (source = '', target = '') => {
  const sourceTokens = new Set(meaningfulTokens(source));
  const targetTokens = new Set(meaningfulTokens(target));
  if (sourceTokens.size < 5 || targetTokens.size < 5) return 0;
  const intersection = [...sourceTokens].filter((token) => targetTokens.has(token)).length;
  const containment = intersection / Math.min(sourceTokens.size, targetTokens.size);
  const union = sourceTokens.size + targetTokens.size - intersection;
  const jaccard = union ? intersection / union : 0;
  return Math.max(containment >= 0.85 ? containment : 0, jaccard >= 0.75 ? jaccard : 0);
};

const rejection = ({ reason, assessmentKey, fingerprint, match, similarity = 1 }) => ({
  allowed: false,
  reason,
  assessmentKey,
  fingerprint,
  matchedQuestionId: match?.questionId || null,
  matchedAssessmentKey: match?.assessmentKey || null,
  similarity: Number(similarity.toFixed(3)),
});

export const evaluateQuestionNovelty = ({ candidate = {}, spokenText = '', history = null } = {}) => {
  const resolvedHistory = history || buildQuestionHistory([]);
  const fields = questionFields(candidate);
  const text = spokenText || fields.text;
  const fingerprint = buildQuestionFingerprint(text);
  const assessmentKey = fields.assessmentKey || buildAssessmentKey(fields);
  const exactMatch = resolvedHistory.spokenQuestions.find((item) => fingerprint && item.fingerprint === fingerprint);
  if (exactMatch) return rejection({ reason: 'duplicate_fingerprint', assessmentKey, fingerprint, match: exactMatch });
  const keyMatch = resolvedHistory.spokenQuestions.find((item) => assessmentKey && item.assessmentKey === assessmentKey);
  if (keyMatch) return rejection({ reason: 'duplicate_assessment_key', assessmentKey, fingerprint, match: keyMatch });
  for (const item of resolvedHistory.spokenQuestions) {
    const similarity = textSimilarity(text, item.text);
    if (similarity > 0) return rejection({ reason: 'near_duplicate_text', assessmentKey, fingerprint, match: item, similarity });
  }
  return {
    allowed: true,
    reason: 'novel_question',
    assessmentKey,
    fingerprint,
    matchedQuestionId: null,
    matchedAssessmentKey: null,
    similarity: 0,
  };
};

export const filterNovelQuestionCandidates = ({ candidates = [], history = null } = {}) => {
  const sourceHistory = history || buildQuestionHistory([]);
  const resolvedHistory = {
    ...sourceHistory,
    spokenQuestions: [...sourceHistory.spokenQuestions],
  };
  const accepted = [];
  const rejected = [];
  for (const candidate of ensureArray(candidates)) {
    const result = evaluateQuestionNovelty({ candidate, history: resolvedHistory });
    if (result.allowed) {
      const acceptedCandidate = { ...candidate, assessmentKey: result.assessmentKey, questionFingerprint: result.fingerprint };
      accepted.push(acceptedCandidate);
      const [historyEntry] = buildQuestionHistory([{
        role: 'ai',
        text: acceptedCandidate.text || acceptedCandidate.fallbackText,
        questionId: acceptedCandidate.questionId || acceptedCandidate.id || null,
        metadata: {
          ...acceptedCandidate,
          countsAsQuestion: true,
          turnType: 'interview_question',
        },
      }]).spokenQuestions;
      if (historyEntry) resolvedHistory.spokenQuestions.push(historyEntry);
    } else {
      rejected.push({ questionId: candidate.questionId || candidate.id || null, ...result });
    }
  }
  return { accepted, rejected };
};
