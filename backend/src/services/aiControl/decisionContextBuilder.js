import { getAgentMemory } from './agentMemoryService.js';
import { buildEvidenceBundle } from './evidenceBundleService.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const tokenize = (value = '') => String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const getLastUserAnswer = (transcript = []) => [...transcript].reverse().find((turn) => turn.role === 'user')?.text || '';

const inferSpecificityLevel = (latestAnswer = '') => {
  const tokens = tokenize(latestAnswer);
  const hasNumbers = /\d/.test(String(latestAnswer || ''));
  const hasExampleWords = ['project', 'built', 'used', 'led', 'implemented', 'improved', 'deployed'].some((token) => tokens.includes(token));
  if (tokens.length >= 40 && (hasNumbers || hasExampleWords)) return 'high';
  if (tokens.length >= 20) return 'medium';
  return 'low';
};

const inferCurrentStage = (session = {}) => {
  const questionPool = ensureArray(session?.interviewPlan?.questionPool);
  const transcriptAiTurns = ensureArray(session.transcript).filter((turn) => turn.role === 'ai');
  const currentIndex = Math.max(0, Number(session?.currentQuestionIndex || 1) - 1);
  const fromPlan = questionPool[currentIndex]?.stage || questionPool[currentIndex]?.type;
  return fromPlan || transcriptAiTurns.at(-1)?.metadata?.stage || 'opening';
};

const buildCoverageState = ({ session = {}, evidenceBundle = {} } = {}) => {
  const topicHistory = ensureArray(session.transcript)
    .filter((turn) => turn.role === 'ai')
    .map((turn) => turn.metadata?.topic)
    .filter(Boolean);
  const priorityTopics = ensureArray(evidenceBundle.matchAnalysis?.questionPlanHints?.priorityTopics);
  const missingTopics = priorityTopics.filter((topic) => !topicHistory.includes(topic));
  return {
    coveredTopics: topicHistory,
    missingTopics,
    weakAreas: ensureArray(evidenceBundle.missingEvidence).slice(0, 6),
  };
};

export const buildDecisionContext = async ({ taskType, session = {}, retrievalBundle = null } = {}) => {
  const latestAnswer = getLastUserAnswer(session.transcript || []);
  const evidenceBundle = buildEvidenceBundle({ session, retrievalBundle });
  const agentMemory = await getAgentMemory(session.id);
  const currentStage = inferCurrentStage(session);
  const coverageState = buildCoverageState({ session, evidenceBundle });
  const targetTopic = coverageState.missingTopics[0]
    || evidenceBundle.matchAnalysis?.validationTargets?.[0]
    || evidenceBundle.missingEvidence[0]
    || evidenceBundle.matchAnalysis?.questionPlanHints?.priorityTopics?.[0]
    || 'role_fit';
  const specificityLevel = inferSpecificityLevel(latestAnswer);

  return {
    taskType,
    sessionId: session.id,
    userId: session.userId,
    currentStage,
    currentObjective: taskType === 'generate_report' ? 'build_grounded_report' : `collect evidence for ${targetTopic}`,
    currentTopic: targetTopic,
    candidateState: {
      answerStyle: latestAnswer ? (latestAnswer.split(/\s+/).length < 18 ? 'brief' : 'expanded') : 'none',
      confidenceSignal: latestAnswer ? 'medium' : 'unknown',
      specificityLevel,
      evidenceQuality: specificityLevel === 'high' ? 'strong' : specificityLevel === 'medium' ? 'partial' : 'weak',
    },
    coverageState,
    matchState: {
      matchedStrengths: ensureArray(evidenceBundle.matchAnalysis?.matchedStrengths),
      missingRequiredSkills: ensureArray(evidenceBundle.matchAnalysis?.missingRequiredSkills),
      missingPreferredSkills: ensureArray(evidenceBundle.matchAnalysis?.missingPreferredSkills),
      riskyClaims: ensureArray(evidenceBundle.matchAnalysis?.riskyClaims),
      validationTargets: ensureArray(evidenceBundle.matchAnalysis?.validationTargets),
    },
    retrievalState: {
      latestQuery: retrievalBundle?.query || '',
      latestSources: ensureArray(retrievalBundle?.items).map((item) => item.sourceType),
      sourceQuality: retrievalBundle?.sourceQuality || (retrievalBundle?.items?.length ? 'available' : 'limited'),
      retrievalObjective: retrievalBundle?.objective || null,
      correctiveRetryUsed: Boolean(retrievalBundle?.correctiveRetryUsed),
    },
    agentMemory,
    constraints: {
      maxQuestionLength: 'short',
      keepTalkTimeHigh: true,
      avoidRedundantTopics: true,
    },
    evidenceBundle,
    latestAnswer,
  };
};
