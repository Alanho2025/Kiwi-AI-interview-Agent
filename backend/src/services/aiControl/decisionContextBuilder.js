import { getAgentMemory } from './agentMemoryService.js';
import { buildEvidenceBundle } from './evidenceBundleService.js';
import { buildInterviewEnvironment } from './interviewEnvironmentService.js';
import { getLatestEvaluatorRecord } from './interviewEvaluatorService.js';
import { deriveDynamicSlots, getDynamicSlotState } from './dynamicSlotService.js';
import { deriveAbductiveState } from './abductiveReasoningService.js';
import { buildSectionState, inferInterviewSection } from './sectionPlannerService.js';
import { getSessionReflectionMemory } from './reflectionWriterService.js';
import { getUserCoachingMemory } from './userCoachingMemoryService.js';
import { buildInterviewTurnPolicy } from '../interview/interviewTurnPolicy.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').trim();
const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const getLastUserAnswer = (transcript = []) => [...ensureArray(transcript)].reverse().find((turn) => turn.role === 'user')?.text || '';

const inferSpecificityLevel = (answerText = '', latestEvaluation = null) => {
  if (latestEvaluation?.specificity) return latestEvaluation.specificity;
  const tokens = tokenize(answerText);
  const hasNumbers = /\d/.test(answerText);
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

export const buildDecisionContext = async ({ taskType, session = {}, retrievalBundle = null, latestEvaluation = null } = {}) => {
  const latestAnswer = getLastUserAnswer(session.transcript || []);
  const evidenceBundle = buildEvidenceBundle({ session, retrievalBundle });
  const [agentMemory, resolvedLatestEvaluation, storedDynamicSlotState, sessionReflectionMemory, userCoachingMemory] = await Promise.all([
    getAgentMemory(session.id),
    latestEvaluation || getLatestEvaluatorRecord(session.id),
    getDynamicSlotState(session.id),
    getSessionReflectionMemory(session.id),
    getUserCoachingMemory(session.userId),
  ]);

  const environment = buildInterviewEnvironment({ session, retrievalBundle, latestEvaluation: resolvedLatestEvaluation });
  const currentStage = inferCurrentStage(session);
  const coverageState = buildCoverageState({ session, evidenceBundle });
  const candidateSpecificity = inferSpecificityLevel(latestAnswer, resolvedLatestEvaluation);
  const dynamicSlotState = deriveDynamicSlots({
    latestAnswer,
    coverageState,
    existingState: storedDynamicSlotState,
  });
  const shouldPreferEvaluationTopic = Boolean(
    resolvedLatestEvaluation?.currentTopic
    && resolvedLatestEvaluation?.suggestedNextMode
    && resolvedLatestEvaluation?.suggestedNextMode !== 'shift_section',
  );
  const currentTopic = (shouldPreferEvaluationTopic ? resolvedLatestEvaluation?.currentTopic : null)
    || environment.questionContext.latestQuestionTopic
    || resolvedLatestEvaluation?.currentTopic
    || dynamicSlotState.activeSlotTopics?.[0]
    || evidenceBundle.matchAnalysis?.validationTargets?.[0]
    || coverageState.missingTopics[0]
    || evidenceBundle.missingEvidence[0]
    || evidenceBundle.matchAnalysis?.questionPlanHints?.priorityTopics?.[0]
    || 'role_fit';
  const interviewStructure = buildInterviewTurnPolicy(session, { currentTopic, evaluatorState: resolvedLatestEvaluation });
  const abductiveState = deriveAbductiveState({
    latestAnswer,
    currentTopic,
    candidateState: { specificityLevel: candidateSpecificity },
    dynamicSlotState,
  });
  const currentSection = inferInterviewSection({
    currentStage,
    currentTopic,
    coverageState,
    dynamicSlotState,
    interviewStructure,
  });
  const sectionState = buildSectionState({
    currentSection,
    coverageState,
    dynamicSlotState,
    interviewStructure,
  });

  return {
    taskType,
    sessionId: session.id,
    userId: session.userId,
    currentStage,
    currentObjective: taskType === 'generate_report' ? 'build_grounded_report' : `collect evidence for ${currentTopic}`,
    currentTopic,
    environment,
    evaluatorState: resolvedLatestEvaluation
      ? {
          successStatus: resolvedLatestEvaluation.successStatus,
          evidenceGainScore: resolvedLatestEvaluation.evidenceGainScore,
          misunderstandingFlag: resolvedLatestEvaluation.misunderstandingFlag,
          interactionStatus: resolvedLatestEvaluation.interactionStatus,
          overallInteractionScore: resolvedLatestEvaluation.overallInteractionScore || 0,
          repetitionRisk: resolvedLatestEvaluation.repetitionRisk,
          reflectionNeeded: resolvedLatestEvaluation.reflectionNeeded,
          suggestedNextMode: resolvedLatestEvaluation.suggestedNextMode,
          currentTopic: resolvedLatestEvaluation.currentTopic,
          gapClosure: resolvedLatestEvaluation.gapClosure || null,
          closeCurrentIntent: Boolean(resolvedLatestEvaluation.closeCurrentIntent),
        }
      : null,
    candidateState: {
      answerStyle: latestAnswer ? (latestAnswer.split(/\s+/).length < 18 ? 'brief' : 'expanded') : 'none',
      confidenceSignal: latestAnswer ? 'medium' : 'unknown',
      specificityLevel: candidateSpecificity,
      evidenceQuality: candidateSpecificity === 'high' ? 'strong' : candidateSpecificity === 'medium' ? 'partial' : 'weak',
    },
    coverageState,
    dynamicSlotState,
    abductiveState,
    sectionState,
    interviewStructure,
    sessionReflectionMemory,
    userCoachingMemory,
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
