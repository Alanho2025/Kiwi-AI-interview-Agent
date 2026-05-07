import crypto from 'crypto';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').trim();
const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const countOverlap = (source = [], target = []) => {
  const targetSet = new Set(target);
  return source.filter((item) => targetSet.has(item)).length;
};

const classifySpecificity = (answerText = '') => {
  const tokens = tokenize(answerText);
  const hasNumbers = /\d/.test(answerText);
  const strongVerbs = ['built', 'designed', 'implemented', 'led', 'improved', 'reduced', 'deployed', 'owned', 'measured'];
  const outcomeSignals = ['result', 'impact', 'latency', 'uptime', 'throughput', 'percent'];
  const hasStrongVerb = strongVerbs.some((verb) => tokens.includes(verb));
  const hasOutcomeSignal = outcomeSignals.some((signal) => tokens.includes(signal));
  const hasCompactEvidence = tokens.length >= 10 && hasStrongVerb && (hasNumbers || hasOutcomeSignal);
  if ((tokens.length >= 35 && (hasNumbers || hasStrongVerb)) || hasCompactEvidence) return 'high';
  if (tokens.length >= 18 && (hasNumbers || hasStrongVerb || tokens.length >= 24)) return 'medium';
  if (tokens.length >= 10 && (hasStrongVerb || hasNumbers)) return 'medium';
  return 'low';
};

const detectMisunderstanding = (answerText = '', topic = '') => {
  const normalized = normalizeText(answerText).toLowerCase();
  if (!normalized) return true;
  const confusionPhrases = ['not sure', "don't know", 'do you mean', 'could you repeat', 'sorry', 'unclear'];
  if (confusionPhrases.some((phrase) => normalized.includes(phrase))) return true;
  const topicTokens = tokenize(topic);
  if (!topicTokens.length) return false;
  const answerTokens = tokenize(answerText);
  return answerTokens.length <= 8 && countOverlap(answerTokens, topicTokens) === 0;
};

const detectCandidateQuestion = (answerText = '') => {
  const normalized = normalizeText(answerText).toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('?')) return true;
  const questionWords = ['what ', 'how ', 'can you ', 'do you ', 'could you ', 'why ', 'is there ', 'are there '];
  if (questionWords.some(w => normalized.startsWith(w) || normalized.includes(` ${w}`))) return true;
  return false;
};

const detectFrictionSignals = (answerText = '') => {
  const frictionKeywords = [
    'conflict', 'disagreed', 'opposed', 'failed', 'limited', 'bottleneck', 'deadline',
    'compromise', 'tradeoff', 'trade-off', 'technical debt', 'regret', 'refuse', 'mistake',
    'wrong', 'broke', 'error', 'incident', 'unsuccessful', 'late', 'rejected'
  ];
  const found = frictionKeywords.filter(keyword => answerText.toLowerCase().includes(keyword));
  return {
    frictionDetected: found.length > 0,
    frictionLevel: found.length >= 3 ? 'high' : found.length >= 1 ? 'medium' : 'low',
    frictionKeywords: found
  };
};

const extractMentionedEntities = (answerText = '') => {
  // Simple regex for capitalized phrases that might be project names or companies
  const candidates = answerText.match(/\b[A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]{1,})*\b/g) || [];
  const filters = ['I', 'The', 'And', 'What', 'How', 'You', 'They', 'We', 'Our', 'My', 'When', 'Then', 'To', 'In', 'A', 'An'];
  return [...new Set(candidates)]
    .filter(name => !filters.includes(name))
    .filter(name => name.length > 2);
};

const computeEvidenceGainScore = ({ answerText = '', topic = '', requiredSkills = [] } = {}) => {
  const answerTokens = tokenize(answerText);
  const topicTokens = tokenize(topic);
  const overlap = countOverlap(answerTokens, [...topicTokens, ...requiredSkills.flatMap((item) => tokenize(item))]);
  const specificity = classifySpecificity(answerText);
  const hasNumbers = /\d/.test(answerText);
  const strongVerbs = ['built', 'designed', 'implemented', 'led', 'improved', 'reduced', 'deployed', 'owned', 'measured'];
  const compactEvidenceBonus = answerTokens.length >= 10 && strongVerbs.some((verb) => answerTokens.includes(verb)) && hasNumbers ? 0.08 : 0;
  const base = specificity === 'high' ? 0.85 : specificity === 'medium' ? 0.62 : 0.35;
  return Math.max(0, Math.min(1, Number((base + compactEvidenceBonus + Math.min(0.15, overlap * 0.03)).toFixed(2))));
};

const scoreEngagement = ({ answerText = '', misunderstandingFlag = false } = {}) => {
  if (misunderstandingFlag) return 0.25;
  const tokenCount = tokenize(answerText).length;
  if (tokenCount >= 15 && tokenCount <= 80) return 0.8;
  if (tokenCount >= 8) return 0.62;
  return 0.38;
};

const scoreTurnTaking = ({ answerText = '' } = {}) => {
  const tokenCount = tokenize(answerText).length;
  if (tokenCount >= 12 && tokenCount <= 75) return 0.8;
  if (tokenCount > 75) return 0.52;
  if (tokenCount >= 6) return 0.6;
  return 0.35;
};

const scoreRepair = ({ answerText = '', misunderstandingFlag = false } = {}) => {
  const normalized = normalizeText(answerText).toLowerCase();
  if (!misunderstandingFlag) return 0.7;
  if (normalized.includes('for example') || normalized.includes('do you mean')) return 0.55;
  return 0.3;
};

const scoreAppropriateness = ({ answerText = '' } = {}) => {
  const normalized = normalizeText(answerText).toLowerCase();
  if (!normalized) return 0.3;
  const offhand = ['whatever', 'idk', 'nah'];
  if (offhand.some((item) => normalized.includes(item))) return 0.25;
  return 0.78;
};

const classifyInteractionStatus = ({ overallInteractionScore = 0, misunderstandingFlag = false, turnTakingScore = 0 } = {}) => {
  if (misunderstandingFlag) return 'degraded';
  if (turnTakingScore < 0.45) return 'verbose';
  if (overallInteractionScore >= 0.72) return 'stable';
  return 'thin';
};

const detectRepetitionRisk = ({ previousTopics = [], currentTopic = '' } = {}) => {
  const recentTopics = ensureArray(previousTopics).slice(-2);
  return Boolean(currentTopic) && recentTopics.filter((topic) => topic === currentTopic).length >= 2;
};


const detectGapClosure = ({ answerText = '', topic = '' } = {}) => {
  const tokens = tokenize(answerText);
  const normalized = normalizeText(answerText).toLowerCase();
  const hardestTradeoff = ['trade', 'difficulty', 'challenge', 'problem', 'decision', 'pressure', 'gap'].some((token) => tokens.includes(token));
  const handlingApproach = ['i', 'my', 'we'].some((token) => tokens.includes(token))
    && ['used', 'checked', 'grouped', 'validated', 'compared', 'built', 'implemented', 'handled', 'separated', 'updated'].some((token) => tokens.includes(token));
  const successJudgement = ['result', 'outcome', 'reduced', 'improved', 'worked', 'judge', 'validated', 'reproduced', 'consistent'].some((token) => tokens.includes(token))
    || normalized.includes('how i knew')
    || /\b(first|second)\b/.test(normalized);
  const closeCurrentIntent = Boolean(topic) && hardestTradeoff && handlingApproach && successJudgement;
  return { hardestTradeoff, handlingApproach, successJudgement, closeCurrentIntent };
};

const suggestNextMode = ({ misunderstandingFlag = false, evidenceGainScore = 0, repetitionRisk = false, closeCurrentIntent = false } = {}) => {
  if (misunderstandingFlag) return 'rephrase';
  if (closeCurrentIntent) return 'advance';
  if (repetitionRisk && evidenceGainScore < 0.55) return 'switch';
  if (evidenceGainScore < 0.45) return 'probe';
  if (evidenceGainScore < 0.7) return 'deepen';
  return 'advance';
};

export const evaluateInterviewTurn = ({ environment = {}, decisionContext = null } = {}) => {
  const answerText = environment?.latestAnswer?.text || '';
  const currentTopic = environment?.questionContext?.latestQuestionTopic || decisionContext?.currentTopic || '';
  const requiredSkills = environment?.roleContext?.requiredSkills || [];
  const specificity = classifySpecificity(answerText);
  const misunderstandingFlag = detectMisunderstanding(answerText, currentTopic);
  const hasCandidateQuestion = detectCandidateQuestion(answerText);
  const evidenceGainScore = computeEvidenceGainScore({ answerText, topic: currentTopic, requiredSkills });
  const engagementScore = scoreEngagement({ answerText, misunderstandingFlag });
  const turnTakingScore = scoreTurnTaking({ answerText });
  const repairScore = scoreRepair({ answerText, misunderstandingFlag });
  const appropriatenessScore = scoreAppropriateness({ answerText });
  const overallInteractionScore = Number(((engagementScore + turnTakingScore + repairScore + appropriatenessScore) / 4).toFixed(2));
  const interactionStatus = classifyInteractionStatus({ overallInteractionScore, misunderstandingFlag, turnTakingScore });
  const repetitionRisk = detectRepetitionRisk({ previousTopics: environment?.questionContext?.previousQuestionTopics || [], currentTopic });
  const gapClosure = detectGapClosure({ answerText, topic: currentTopic });
  const suggestedNextMode = suggestNextMode({ misunderstandingFlag, evidenceGainScore, repetitionRisk, closeCurrentIntent: gapClosure.closeCurrentIntent });
  const frictionState = detectFrictionSignals(answerText);
  const mentionedEntities = extractMentionedEntities(answerText);
  const reflectionNeeded = misunderstandingFlag || (evidenceGainScore < 0.45 && repetitionRisk) || overallInteractionScore < 0.5;

  return {
    evaluationId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    currentTopic,
    currentStage: environment?.questionContext?.latestQuestionStage || decisionContext?.currentStage || 'opening',
    specificity,
    evidenceGainScore,
    misunderstandingFlag,
    hasCandidateQuestion,
    frictionState,
    mentionedEntities,
    engagementScore,
    turnTakingScore,
    repairScore,
    appropriatenessScore,
    overallInteractionScore,
    interactionStatus,
    repetitionRisk,
    reflectionNeeded,
    gapClosure,
    closeCurrentIntent: gapClosure.closeCurrentIntent,
    suggestedNextMode,
    successStatus: evidenceGainScore >= 0.55 && !misunderstandingFlag ? 'usable' : 'weak',
    rationale: misunderstandingFlag
      ? 'The latest answer likely did not address the question clearly enough.'
      : evidenceGainScore >= 0.7
        ? 'The latest answer added concrete evidence that can support downstream scoring and reporting.'
        : 'The latest answer added some evidence, but the next turn should still tighten specificity or coverage.',
  };
};

export const persistEvaluatorRecord = async ({ sessionId, evaluation = {} } = {}) => {
  if (!sessionId) return null;
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $push: { evaluatorRecords: evaluation },
      $set: { latestEvaluatorRecord: evaluation },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return evaluation;
};

export const getLatestEvaluatorRecord = async (sessionId) => {
  if (!sessionId) return null;
  const record = await SessionAnalysis.findOne({ sessionId }).lean();
  return record?.latestEvaluatorRecord || null;
};
