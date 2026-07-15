import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';

const DEFAULT_AGENT_MEMORY = {
  recentPatterns: [],
  topicHistory: [],
  failedStrategies: [],
  successfulStrategies: [],
  evidenceGaps: [],
  projectUsage: {}, // Tracks { [projectName]: count }
  latestFrictionLevel: 'low',
  lastUpdatedAt: null,
};

const uniqueStrings = (values = []) => [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map((item) => String(item)))];

export const getAgentMemory = async (sessionId) => {
  if (!sessionId) {
    return { ...DEFAULT_AGENT_MEMORY };
  }

  const record = await SessionAnalysis.findOne({ sessionId }).lean();
  return {
    ...DEFAULT_AGENT_MEMORY,
    ...(record?.agentMemory || {}),
  };
};

const buildLatestPatterns = ({ latestAnswer = '', selectedAction = '', decisionContext = {}, outcome = {} }) => {
  const patterns = [];
  const answerText = String(latestAnswer || '').trim();
  if (answerText && answerText.split(/\s+/).length < 18) {
    patterns.push('candidate answer was brief');
  }
  if (decisionContext?.candidateState?.specificityLevel === 'low') {
    patterns.push('candidate tends to answer generally');
  }
  if (decisionContext?.matchState?.validationTargets?.length) {
    patterns.push('validation targets still remain');
  }
  if (selectedAction === 'ASK_PROBING_QUESTION' && outcome?.isComplete === false) {
    patterns.push('probing strategy was used');
  }
  return uniqueStrings(patterns);
};

export const updateAgentMemory = async ({
  workflowRunId = null,
  sessionId,
  latestAnswer = '',
  decisionContext = {},
  latestDecision = {},
  outcome = {},
} = {}) => {
  if (!sessionId) {
    return { ...DEFAULT_AGENT_MEMORY };
  }

  const currentMemory = await getAgentMemory(sessionId);
  const selectedAction = latestDecision?.selectedAction || '';
  const topic = latestDecision?.actionInput?.targetTopic || decisionContext?.currentTopic || '';
  const topicHistory = uniqueStrings([...currentMemory.topicHistory, topic]);
  const recentPatterns = uniqueStrings([...currentMemory.recentPatterns, ...buildLatestPatterns({ latestAnswer, selectedAction, decisionContext, outcome })]).slice(-10);
  const evidenceGaps = uniqueStrings([
    ...currentMemory.evidenceGaps,
    ...(decisionContext?.matchState?.missingRequiredSkills || []),
    ...(decisionContext?.coverageState?.weakAreas || []),
  ]).slice(-10);
  const successfulStrategies = selectedAction && outcome?.isComplete === false
    ? uniqueStrings([...currentMemory.successfulStrategies, selectedAction]).slice(-8)
    : currentMemory.successfulStrategies;
  const failedStrategies = selectedAction && outcome?.isComplete && outcome?.completedBecause === 'no_viable_action'
    ? uniqueStrings([...currentMemory.failedStrategies, selectedAction]).slice(-8)
    : currentMemory.failedStrategies;

  const nextProjectUsage = { ...(currentMemory.projectUsage || {}) };
  const mentionedEntities = decisionContext?.evaluatorState?.mentionedEntities || [];
  mentionedEntities.forEach((entity) => {
    nextProjectUsage[entity] = (nextProjectUsage[entity] || 0) + 1;
  });

  const nextMemory = {
    sourceWorkflowRunId: workflowRunId,
    recentPatterns,
    topicHistory,
    failedStrategies,
    successfulStrategies,
    evidenceGaps,
    projectUsage: nextProjectUsage,
    latestFrictionLevel: decisionContext?.evaluatorState?.frictionState?.frictionLevel || 'low',
    lastUpdatedAt: new Date().toISOString(),
  };

  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    { $set: { agentMemory: nextMemory } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return nextMemory;
};
