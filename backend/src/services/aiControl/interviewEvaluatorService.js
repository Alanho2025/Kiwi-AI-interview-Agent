import crypto from 'crypto';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { analyzeStarBreakdown } from './starRubricService.js';

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

const detectRepetitionComplaint = (answerText = '') => {
  const normalized = normalizeText(answerText).toLowerCase();
  return /\b(answered|answer|asked|ask)\b.*\b(before|again|already|repeat|same)\b/.test(normalized)
    || /\bwhy\b.*\b(ask|asking)\b.*\bagain\b/.test(normalized)
    || /\bi (have )?answered this\b/.test(normalized);
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

const inferRoleRelevance = ({ answerText = '', currentTopic = '', requiredSkills = [], answerUnderstanding = null } = {}) => {
  const tokens = tokenize(answerText);
  const topicTokens = tokenize(currentTopic);
  const skillTokens = ensureArray(requiredSkills).flatMap((item) => tokenize(item));
  const overlap = countOverlap(tokens, [...topicTokens, ...skillTokens]);
  if (overlap >= 3 || ensureArray(answerUnderstanding?.technologies).length >= 2) return 'high';
  if (overlap >= 1 || ensureArray(answerUnderstanding?.technologies).length) return 'medium';
  return 'low';
};

const inferCoveragePressure = ({ coverageState = {}, repetitionRisk = false } = {}) => {
  const missingCount = ensureArray(coverageState.missingTopics).length;
  if (missingCount >= 3 || repetitionRisk) return 'high';
  if (missingCount >= 1) return 'medium';
  return 'low';
};

const buildPlannerSignals = ({
  evidenceGainScore,
  specificity,
  answerUnderstanding = null,
  frictionState = {},
  roleRelevance,
  coveragePressure,
  starBreakdown = null,
  candidateRepetitionComplaint = false,
} = {}) => ({
  evidenceGainScore,
  specificity,
  missingEvidence: ensureArray(answerUnderstanding?.missingEvidence),
  roleRelevance,
  semanticOpportunity: normalizeText(answerUnderstanding?.semanticOpportunity),
  followUpValue: answerUnderstanding?.followUpValue || (evidenceGainScore >= 0.45 && evidenceGainScore < 0.7 ? 'high' : evidenceGainScore >= 0.7 ? 'medium' : 'medium'),
  emotionalOrFrictionSignal: ensureArray(frictionState.frictionKeywords)[0] || '',
  coveragePressure,
  candidateRepetitionComplaint,
  starScores: starBreakdown?.scores || {},
  starMainMissingElement: starBreakdown?.mainMissingElement || '',
});


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

const mergeSuggestedNextMode = ({ baseMode, answerUnderstanding = null, misunderstandingFlag = false } = {}) => {
  if (misunderstandingFlag) return 'rephrase';
  const understandingMode = answerUnderstanding?.suggestedFollowUp?.mode;
  const confidence = Number(answerUnderstanding?.confidence || 0);
  if (confidence < 0.58 || !understandingMode) return baseMode;
  if (understandingMode === 'rephrase') return 'rephrase';
  if (understandingMode === 'probe' && baseMode !== 'rephrase') return 'probe';
  if (
    understandingMode === 'deepen'
    && (
      ['advance', 'deepen'].includes(baseMode)
      || (answerUnderstanding?.technologies?.length && answerUnderstanding?.ownershipSignals?.length)
    )
  ) return 'deepen';
  return baseMode;
};

export const evaluateInterviewTurn = ({ environment = {}, decisionContext = null } = {}) => {
  const answerText = environment?.latestAnswer?.text || '';
  const currentTopic = environment?.questionContext?.latestQuestionTopic || decisionContext?.currentTopic || '';
  const requiredSkills = environment?.roleContext?.requiredSkills || [];
  const answerUnderstanding = environment?.latestAnswerUnderstanding || null;
  const specificity = classifySpecificity(answerText);
  const candidateRepetitionComplaint = detectRepetitionComplaint(answerText);
  const misunderstandingFlag = detectMisunderstanding(answerText, currentTopic)
    || answerUnderstanding?.suggestedFollowUp?.mode === 'rephrase';
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
  const baseSuggestedNextMode = suggestNextMode({ misunderstandingFlag, evidenceGainScore, repetitionRisk, closeCurrentIntent: gapClosure.closeCurrentIntent });
  const suggestedNextMode = mergeSuggestedNextMode({ baseMode: baseSuggestedNextMode, answerUnderstanding, misunderstandingFlag });
  const rawFrictionState = detectFrictionSignals(answerText);
  const frictionKeywords = [...new Set([
    ...(rawFrictionState.frictionKeywords || []),
    ...(answerUnderstanding?.frictionSignals || []),
  ])];
  const frictionState = {
    frictionDetected: rawFrictionState.frictionDetected || frictionKeywords.length > 0,
    frictionLevel: frictionKeywords.length >= 3 ? 'high' : frictionKeywords.length >= 1 ? 'medium' : 'low',
    frictionKeywords,
  };
  const mentionedEntities = [...new Set([
    ...extractMentionedEntities(answerText),
    ...(answerUnderstanding?.mentionedEntities || []),
  ])];
  const reflectionNeeded = misunderstandingFlag || (evidenceGainScore < 0.45 && repetitionRisk) || overallInteractionScore < 0.5;
  const roleRelevance = inferRoleRelevance({ answerText, currentTopic, requiredSkills, answerUnderstanding });
  const coveragePressure = inferCoveragePressure({ coverageState: decisionContext?.coverageState || {}, repetitionRisk });
  const starBreakdown = analyzeStarBreakdown(answerText);
  const plannerSignals = buildPlannerSignals({
    evidenceGainScore,
    specificity,
    answerUnderstanding,
    frictionState,
    roleRelevance,
    coveragePressure,
    starBreakdown,
    candidateRepetitionComplaint,
  });

  return {
    evaluationId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    currentTopic,
    currentStage: environment?.questionContext?.latestQuestionStage || decisionContext?.currentStage || 'opening',
    specificity,
    evidenceGainScore,
    misunderstandingFlag,
    candidateRepetitionComplaint,
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
    starBreakdown,
    plannerSignals,
    suggestedNextMode,
    successStatus: evidenceGainScore >= 0.55 && !misunderstandingFlag ? 'usable' : 'weak',
    fastAnswerUnderstanding: answerUnderstanding,
    answerUnderstandingSummary: answerUnderstanding
      ? {
          intent: answerUnderstanding.intent,
          suggestedFollowUp: answerUnderstanding.suggestedFollowUp,
          technologies: answerUnderstanding.technologies || [],
          missingEvidence: answerUnderstanding.missingEvidence || [],
          confidence: answerUnderstanding.confidence,
        }
      : null,
    rationale: misunderstandingFlag
      ? 'The latest answer likely did not address the question clearly enough.'
      : suggestedNextMode !== baseSuggestedNextMode && answerUnderstanding?.suggestedFollowUp?.questionGoal
        ? `Fast answer understanding found concrete facts to preserve: ${answerUnderstanding.suggestedFollowUp.questionGoal}.`
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
