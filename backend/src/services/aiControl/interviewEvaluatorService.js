import crypto from 'crypto';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { analyzeStarrBreakdown } from './starRubricService.js';
import { ensureArray, normalizeKey, normalizeText, tokenize, unique } from '../../utils/commonHelpers.js';

const countOverlap = (source = [], target = []) => {
  const targetSet = new Set(target);
  return source.filter((item) => targetSet.has(item)).length;
};

const detectSelfCorrection = (answerText = '') => {
  const normalized = normalizeText(answerText).toLowerCase();
  if (!normalized) return false;
  return /\b(no sorry|sorry,? i mean|i mean|actually|let me correct|to be clear|what i mean is)\b/.test(normalized)
    && /\b(i|we|my|our)\b/.test(normalized);
};

const detectIncompleteEvidenceAdmission = (answerText = '') => {
  const normalized = normalizeText(answerText).toLowerCase();
  if (!normalized) return false;
  return /\b(i|we)\b.{0,25}\b(not|haven't|have not|didn't|did not|probably need to|need to)\b.{0,65}\b(explain|show|prove|mention|describe|cover|validate)\b/.test(normalized)
    || /\b(cannot|can't|do not|don't)\b.{0,40}\b(remember|recall)\b.{0,40}\b(specific|decision|result|example|detail)\b/.test(normalized)
    || /\b(without|no)\b.{0,35}\b(specific|clear|concrete)\b.{0,35}\b(result|example|decision|impact|evidence)\b/.test(normalized);
};

const detectVagueLongAnswer = (answerText = '') => {
  const normalized = normalizeText(answerText).toLowerCase();
  const tokens = tokenize(answerText);
  if (tokens.length < 28) return false;
  const vaguePhrases = [
    'helped with', 'involved in', 'joined meetings', 'checked some things', 'learned a lot',
    'useful experience', 'cannot remember', "can't remember", 'not a very specific',
    'some things', 'a bit', 'generally', 'basically', 'kind of', 'sort of',
  ];
  const vagueHits = vaguePhrases.filter((phrase) => normalized.includes(phrase)).length;
  const concreteSignals = ['implemented', 'built', 'designed', 'validated', 'measured', 'reduced', 'improved', 'tested', 'deployed']
    .filter((signal) => tokens.includes(signal)).length;
  const hasMetric = /\d/.test(normalized);
  return vagueHits >= 2 && concreteSignals <= 1 && !hasMetric;
};

const classifySpecificity = (answerText = '') => {
  const tokens = tokenize(answerText);
  const hasNumbers = /\d/.test(answerText);
  const strongVerbs = ['built', 'designed', 'implemented', 'led', 'improved', 'reduced', 'deployed', 'owned', 'measured', 'validated', 'tested'];
  const outcomeSignals = ['result', 'impact', 'latency', 'uptime', 'throughput', 'percent', 'accuracy', 'stable'];
  const hasStrongVerb = strongVerbs.some((verb) => tokens.includes(verb));
  const hasOutcomeSignal = outcomeSignals.some((signal) => tokens.includes(signal));
  const hasCompactEvidence = tokens.length >= 10 && hasStrongVerb && (hasNumbers || hasOutcomeSignal);
  if (detectVagueLongAnswer(answerText)) return 'low';
  if ((tokens.length >= 35 && (hasNumbers || hasStrongVerb)) || hasCompactEvidence) return 'high';
  if (tokens.length >= 18 && (hasNumbers || hasStrongVerb || tokens.length >= 24)) return 'medium';
  if (tokens.length >= 10 && (hasStrongVerb || hasNumbers)) return 'medium';
  return 'low';
};

const detectCandidateDifficultySignal = (answerText = '') => {
  const normalized = normalizeText(answerText).toLowerCase();
  if (!normalized) return false;
  return /\b(question|questions|this|that)\b.{0,45}\b(tough|hard|difficult|confusing|complicated|unclear)\b/.test(normalized)
    || /\b(tough|hard|difficult|confusing|complicated)\b.{0,45}\b(question|questions|answer|explain)\b/.test(normalized)
    || normalized.includes('i am feeling these questions quite tough')
    || normalized.includes("i'm feeling these questions quite tough")
    || normalized.includes('this question is tough')
    || normalized.includes('these questions are tough');
};

const detectMisunderstanding = (answerText = '', topic = '') => {
  const normalized = normalizeText(answerText).toLowerCase();
  if (!normalized) return true;
  if (detectSelfCorrection(answerText)) return false;
  const confusionPhrases = ['not sure', "don't know", 'do you mean', 'could you repeat', 'unclear'];
  if (confusionPhrases.some((phrase) => normalized.includes(phrase))) return true;
  if (/\bsorry\b/.test(normalized) && /\b(not sure|repeat|unclear|what you mean|do you mean)\b/.test(normalized)) return true;
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

const TOOL_MENTION_PATTERNS = [
  { label: 'Python', pattern: /\bpython\b/i },
  { label: 'Tableau', pattern: /\btableau\b/i },
  { label: 'Spark', pattern: /\bspark\b/i },
  { label: 'Power BI', pattern: /\bpower\s*bi\b/i },
  { label: 'Microsoft Dynamics 365', pattern: /\bdynamics(?:\s*365)?\b/i },
  { label: 'CRM', pattern: /\bcrm\b/i },
  { label: 'Excel', pattern: /\bexcel\b/i },
  { label: 'SQL', pattern: /\bsql\b/i },
  { label: 'JavaScript', pattern: /\bjavascript\b/i },
  { label: 'TypeScript', pattern: /\btypescript\b/i },
  { label: 'React', pattern: /\breact\b/i },
  { label: 'Node.js', pattern: /\bnode(?:\.js)?\b/i },
  { label: 'PostgreSQL', pattern: /\bpostgres(?:ql)?\b/i },
  { label: 'MongoDB', pattern: /\bmongodb\b/i },
];

const TARGET_TOKEN_STOPWORDS = new Set(['microsoft', 'tool', 'tools', 'system', 'systems', 'experience', 'skill', 'skills']);

const normalizeNegations = (text = '') => normalizeText(text)
  .toLowerCase()
  .replace(/\bdon['’]?t\b/g, 'do not')
  .replace(/\bdoesn['’]?t\b/g, 'does not')
  .replace(/\bdidn['’]?t\b/g, 'did not')
  .replace(/\bhaven['’]?t\b/g, 'have not')
  .replace(/\bhasn['’]?t\b/g, 'has not')
  .replace(/\bhadn['’]?t\b/g, 'had not')
  .replace(/\bcan['’]?t\b/g, 'can not');

const meaningfulTargetTokens = (target = '') => tokenize(target)
  .filter((token) => token.length > 1 && !TARGET_TOKEN_STOPWORDS.has(token));

const targetMentionPattern = (target = '') => {
  const tokens = meaningfulTargetTokens(target);
  if (!tokens.length) return null;
  return new RegExp(`\\b(?:${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
};

const answerDeniesTarget = ({ normalizedAnswer = '', target = '' } = {}) => {
  const pattern = targetMentionPattern(target);
  if (!pattern || !pattern.test(normalizedAnswer)) return false;
  const targetSource = pattern.source;

  if (/\b(?:do|does|did|have|has|had|can)\s+not\s+(?:really\s+)?(?:explain|describe|cover|mention|detail)\b/i.test(normalizedAnswer)) {
    return false;
  }

  const denialBeforeTarget = new RegExp(
    `\\b(?:do|does|did|have|has|had|can)\\s+not\\b.{0,45}${targetSource}`,
    'i',
  );
  const noTargetEvidence = new RegExp(`\\b(?:no|without)\\b.{0,45}${targetSource}`, 'i');
  const targetBeforeDenial = new RegExp(
    `${targetSource}.{0,45}\\b(?:do|does|did|have|has|had|can)\\s+not\\b.{0,30}\\b(?:use|used|work|worked|know|have|need)\\b`,
    'i',
  );
  return denialBeforeTarget.test(normalizedAnswer)
    || noTargetEvidence.test(normalizedAnswer)
    || targetBeforeDenial.test(normalizedAnswer);
};

const targetMatchesLabel = (target = '', label = '') => {
  const targetKey = normalizeKey(target);
  const labelKey = normalizeKey(label);
  return Boolean(targetKey && labelKey && (targetKey.includes(labelKey) || labelKey.includes(targetKey)));
};

const extractAlternativeTools = ({ answerText = '', deniedTargets = [] } = {}) => TOOL_MENTION_PATTERNS
  .filter((tool) => tool.pattern.test(answerText))
  .map((tool) => tool.label)
  .filter((label) => !deniedTargets.some((target) => targetMatchesLabel(target, label)));

const detectSkillDenial = ({ answerText = '', currentTopic = '', validationTargets = [] } = {}) => {
  const normalizedAnswer = normalizeNegations(answerText);
  if (!normalizedAnswer) {
    return { deniedTargets: [], alternativeTools: [], deniedCurrentTopic: false };
  }
  const candidateTargets = unique([currentTopic, ...ensureArray(validationTargets)].filter(Boolean));
  const deniedTargets = candidateTargets.filter((target) => answerDeniesTarget({ normalizedAnswer, target }));
  
  // General denial regex matching (e.g. "haven't worked with Kafka", "no experience with Docker")
  const generalDenialMatch = normalizedAnswer.match(/\b(?:have not|haven't|never|did not|didn't|don't|do not)\s+(?:worked with|used|built|implemented|experience with|done|had)\s+([a-z0-9_.\s-]+)\b/i)
    || normalizedAnswer.match(/\bno\s+(?:experience|background|knowledge)\s+(?:with|in)\s+([a-z0-9_.\s-]+)\b/i);

  if (generalDenialMatch && generalDenialMatch[1]) {
    const extractedTech = generalDenialMatch[1].trim().split(/\s+/)[0];
    if (extractedTech && !deniedTargets.includes(extractedTech)) {
      deniedTargets.push(extractedTech);
    }
  }

  return {
    deniedTargets,
    alternativeTools: unique(extractAlternativeTools({ answerText, deniedTargets })),
    deniedCurrentTopic: Boolean(currentTopic && deniedTargets.some((target) => targetMatchesLabel(currentTopic, target))),
  };
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
  const strongVerbs = ['built', 'designed', 'implemented', 'led', 'improved', 'reduced', 'deployed', 'owned', 'measured', 'validated', 'tested'];
  const compactEvidenceBonus = answerTokens.length >= 10 && strongVerbs.some((verb) => answerTokens.includes(verb)) && hasNumbers ? 0.08 : 0;
  const base = specificity === 'high' ? 0.78 : specificity === 'medium' ? 0.56 : 0.34;
  const penalty = (detectIncompleteEvidenceAdmission(answerText) ? 0.18 : 0)
    + (detectVagueLongAnswer(answerText) ? 0.24 : 0);
  return Math.max(0, Math.min(1, Number((base + compactEvidenceBonus + Math.min(0.12, overlap * 0.025) - penalty).toFixed(2))));
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
  candidateDifficultySignal = false,
  selfCorrectionDetected = false,
  incompleteEvidenceAdmission = false,
  vagueLongAnswer = false,
  skillDenial = null,
} = {}) => ({
  evidenceGainScore,
  specificity,
  missingEvidence: ensureArray(answerUnderstanding?.missingEvidence),
  roleRelevance,
  semanticOpportunity: normalizeText(answerUnderstanding?.semanticOpportunity),
  followUpValue: candidateDifficultySignal || incompleteEvidenceAdmission || vagueLongAnswer
    ? 'high'
    : answerUnderstanding?.followUpValue || (evidenceGainScore >= 0.45 && evidenceGainScore < 0.7 ? 'high' : evidenceGainScore >= 0.7 ? 'medium' : 'medium'),
  emotionalOrFrictionSignal: candidateDifficultySignal ? 'candidate_found_question_tough' : ensureArray(frictionState.frictionKeywords)[0] || '',
  coveragePressure,
  candidateRepetitionComplaint,
  candidateDifficultySignal,
  selfCorrectionDetected,
  incompleteEvidenceAdmission,
  vagueLongAnswer,
  skillDenial,
  starScores: starBreakdown?.scores || {},
  starMainMissingElement: starBreakdown?.mainMissingElement || '',
});

const detectGapClosure = ({ answerText = '', topic = '' } = {}) => {
  if (detectIncompleteEvidenceAdmission(answerText) || detectVagueLongAnswer(answerText)) {
    return { hardestTradeoff: false, handlingApproach: false, successJudgement: false, closeCurrentIntent: false };
  }
  const tokens = tokenize(answerText);
  const normalized = normalizeText(answerText).toLowerCase();
  const hardestTradeoff = ['trade', 'tradeoff', 'difficulty', 'challenge', 'problem', 'decision', 'pressure', 'gap'].some((token) => tokens.includes(token));
  const handlingApproach = ['i', 'my', 'we'].some((token) => tokens.includes(token))
    && ['used', 'checked', 'grouped', 'validated', 'compared', 'built', 'implemented', 'handled', 'separated', 'updated'].some((token) => tokens.includes(token));
  const successJudgement = ['result', 'outcome', 'reduced', 'improved', 'worked', 'judge', 'validated', 'reproduced', 'consistent'].some((token) => tokens.includes(token))
    || normalized.includes('how i knew')
    || /\b(first|second)\b/.test(normalized);
  const closeCurrentIntent = Boolean(topic) && hardestTradeoff && handlingApproach && successJudgement;
  return { hardestTradeoff, handlingApproach, successJudgement, closeCurrentIntent };
};

const suggestNextMode = ({ misunderstandingFlag = false, evidenceGainScore = 0, repetitionRisk = false, closeCurrentIntent = false, candidateDifficultySignal = false, incompleteEvidenceAdmission = false, vagueLongAnswer = false } = {}) => {
  if (candidateDifficultySignal) return 'rephrase';
  if (misunderstandingFlag) return 'rephrase';
  if (vagueLongAnswer) return 'probe';
  if (incompleteEvidenceAdmission) return evidenceGainScore >= 0.42 ? 'deepen' : 'probe';
  if (closeCurrentIntent) return 'advance';
  if (repetitionRisk && evidenceGainScore < 0.55) return 'switch';
  if (evidenceGainScore < 0.45) return 'probe';
  if (evidenceGainScore < 0.7) return 'deepen';
  return 'advance';
};

const mergeSuggestedNextMode = ({ baseMode, answerUnderstanding = null, misunderstandingFlag = false, candidateDifficultySignal = false } = {}) => {
  if (candidateDifficultySignal) return 'rephrase';
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
  const candidateDifficultySignal = detectCandidateDifficultySignal(answerText);
  const selfCorrectionDetected = detectSelfCorrection(answerText);
  const incompleteEvidenceAdmission = detectIncompleteEvidenceAdmission(answerText);
  const vagueLongAnswer = detectVagueLongAnswer(answerText);
  const skillDenial = detectSkillDenial({
    answerText,
    currentTopic,
    validationTargets: environment?.roleContext?.validationTargets || [],
  });
  const misunderstandingFlag = detectMisunderstanding(answerText, currentTopic)
    || candidateDifficultySignal
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
  const baseSuggestedNextMode = suggestNextMode({ misunderstandingFlag, evidenceGainScore, repetitionRisk, closeCurrentIntent: gapClosure.closeCurrentIntent, candidateDifficultySignal, incompleteEvidenceAdmission, vagueLongAnswer });
  const suggestedNextMode = mergeSuggestedNextMode({ baseMode: baseSuggestedNextMode, answerUnderstanding, misunderstandingFlag, candidateDifficultySignal });
  const rawFrictionState = detectFrictionSignals(answerText);
  const frictionKeywords = [...new Set([
    ...(rawFrictionState.frictionKeywords || []),
    ...(answerUnderstanding?.frictionSignals || []),
    ...(candidateDifficultySignal ? ['candidate_found_question_tough'] : []),
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
  const reflectionNeeded = misunderstandingFlag || (evidenceGainScore < 0.45 && repetitionRisk) || overallInteractionScore < 0.5 || candidateDifficultySignal;
  const roleRelevance = inferRoleRelevance({ answerText, currentTopic, requiredSkills, answerUnderstanding });
  const coveragePressure = inferCoveragePressure({ coverageState: decisionContext?.coverageState || {}, repetitionRisk });
  const starBreakdown = analyzeStarrBreakdown(answerText);
  const plannerSignals = buildPlannerSignals({
    evidenceGainScore,
    specificity,
    answerUnderstanding,
    frictionState,
    roleRelevance,
    coveragePressure,
    starBreakdown,
    candidateRepetitionComplaint,
    candidateDifficultySignal,
    selfCorrectionDetected,
    incompleteEvidenceAdmission,
    vagueLongAnswer,
    skillDenial,
  });

  const candidateDenial = Boolean(skillDenial?.deniedCurrentTopic || skillDenial?.deniedTargets?.length);
  let evidenceStatus = 'INSUFFICIENT_EVIDENCE';
  if (candidateDenial) {
    evidenceStatus = 'EXPLICIT_NO_EXPERIENCE';
  } else if (vagueLongAnswer || incompleteEvidenceAdmission) {
    evidenceStatus = 'INSUFFICIENT_EVIDENCE';
  } else if (evidenceGainScore >= 0.7) {
    evidenceStatus = 'EXACT_MATCH';
  } else if (evidenceGainScore >= 0.45) {
    evidenceStatus = 'PARTIAL_TRANSFER';
  }

  return {
    evaluationId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    currentTopic,
    currentStage: environment?.questionContext?.latestQuestionStage || decisionContext?.currentStage || 'opening',
    specificity,
    evidenceGainScore,
    misunderstandingFlag,
    candidateRepetitionComplaint,
    candidateDifficultySignal,
    selfCorrectionDetected,
    incompleteEvidenceAdmission,
    vagueLongAnswer,
    skillDenial,
    candidateDenial,
    evidenceStatus,
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
    closeCurrentIntent: candidateDifficultySignal || incompleteEvidenceAdmission || vagueLongAnswer ? false : gapClosure.closeCurrentIntent,
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
    rationale: candidateDifficultySignal
      ? 'The candidate signalled that the question felt tough, so the next turn should reduce cognitive load and rephrase or scaffold.'
      : incompleteEvidenceAdmission
        ? 'The candidate gave useful evidence but explicitly admitted that key evidence is still missing, so the next turn should deepen rather than advance.'
        : vagueLongAnswer
          ? 'The candidate spoke at length but gave weak concrete evidence, so the next turn should probe for a specific example.'
          : misunderstandingFlag
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
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return evaluation;
};

export const getLatestEvaluatorRecord = async (sessionId) => {
  if (!sessionId) return null;
  const record = await SessionAnalysis.findOne({ sessionId }).lean();
  return record?.latestEvaluatorRecord || null;
};
