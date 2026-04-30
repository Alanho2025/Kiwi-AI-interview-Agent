/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Select retrieval sources based on controller objective.
 * - Retrieve evidence with a simple corrective retry hook.
 * - Return one stable retrieval payload that downstream controller code can inspect.
 */

import { buildRetrievalObjective } from '../retrieval/retrievalObjectiveBuilder.js';
import { selectRetrievalSources } from '../retrieval/retrievalSourceSelector.js';
import { retrieveSessionEvidence } from '../retrieval/sessionEvidenceRetriever.js';
import { retrieveGlobalKnowledge } from '../retrieval/globalKnowledgeRetriever.js';
import { assessRetrievalQuality } from '../retrieval/retrievalQualityAssessor.js';
import { runCorrectiveRetrieval } from '../retrieval/correctiveRetrievalService.js';
import { RETRIEVAL_SOURCES } from '../retrieval/retrievalSourceRegistry.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const unique = (items = []) => [...new Set(items.filter(Boolean))];

const buildRetrievalErrorBundle = (source, error) => ({
  items: [],
  retrievalFailed: true,
  error: {
    source,
    message: error?.message || String(error || 'Retrieval failed'),
  },
});

const safeRetrieve = async (source, fn) => {
  try {
    return await fn();
  } catch (error) {
    return buildRetrievalErrorBundle(source, error);
  }
};

const collectRetrievalErrors = (bundles = []) => bundles
  .map((bundle) => bundle?.error)
  .filter(Boolean);

const splitSessionAndGlobalSources = (sourceTypes = []) => {
  const globalSources = [RETRIEVAL_SOURCES.GLOBAL_QUESTION_BANK, RETRIEVAL_SOURCES.GLOBAL_BEHAVIOURAL_BANK];
  return {
    sessionSources: ensureArray(sourceTypes).filter((item) => !globalSources.includes(item)),
    globalSources: ensureArray(sourceTypes).filter((item) => globalSources.includes(item)),
  };
};

const mergeItems = (bundles = []) => {
  const seen = new Set();
  return bundles.flatMap((bundle) => ensureArray(bundle?.items)).filter((item) => {
    const key = `${item?.sourceType || ''}:${item?.sourceId || ''}:${item?.text || ''}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => (right?.scores?.fusion || 0) - (left?.scores?.fusion || 0));
};

export const runRetrievalAgent = async ({
  query,
  sessionId = null,
  sourceTypes = [],
  topK = 5,
  objective = null,
  targetTopic = '',
  taskType = 'interview_next_turn',
  actionType = '',
  preferredSources = [],
} = {}) => {
  const objectivePayload = objective
    ? {
        objective,
        targetTopic,
        evidenceType: 'context',
        fallbackPolicy: 'broaden_query_once',
      }
    : buildRetrievalObjective({ taskType, actionType, targetTopic });

  const resolvedSources = selectRetrievalSources({
    objective: objectivePayload.objective,
    preferredSources: sourceTypes.length ? sourceTypes : preferredSources,
  });
  const { sessionSources, globalSources } = splitSessionAndGlobalSources(resolvedSources);

  const sessionBundle = sessionSources.length
    ? await safeRetrieve('session_evidence', () => retrieveSessionEvidence({ query, sessionId, sourceTypes: sessionSources, topK }))
    : { items: [] };
  const globalBundle = globalSources.length
    ? await safeRetrieve('global_knowledge', () => retrieveGlobalKnowledge({ query, sourceTypes: globalSources, topK }))
    : { items: [] };
  const retrievalErrors = collectRetrievalErrors([sessionBundle, globalBundle]);

  let combinedResult = {
    query,
    objective: objectivePayload.objective,
    targetTopic: objectivePayload.targetTopic,
    evidenceType: objectivePayload.evidenceType,
    sourceTypes: resolvedSources,
    items: mergeItems([sessionBundle, globalBundle]).slice(0, topK),
    correctiveRetryUsed: false,
    retrievalFailed: retrievalErrors.length > 0,
    retrievalErrors,
  };

  const quality = assessRetrievalQuality({ retrievalResult: combinedResult, targetTopic: objectivePayload.targetTopic });
  if (quality.retryRecommended) {
    const retryResult = await safeRetrieve('corrective_retrieval', () => runCorrectiveRetrieval({
      query,
      targetTopic: objectivePayload.targetTopic,
      evidenceType: objectivePayload.evidenceType,
      sessionId,
      sourceTypes: resolvedSources,
      topK,
    }));
    if (retryResult.error) {
      combinedResult.qualityAssessment = {
        ...quality,
        passed: false,
        retryRecommended: false,
        reasons: unique([...(quality.reasons || []), 'RETRIEVAL_ERROR']),
      };
      combinedResult.retrievalFailed = true;
      combinedResult.retrievalErrors = collectRetrievalErrors([sessionBundle, globalBundle, retryResult]);
    } else {
    const retryQuality = assessRetrievalQuality({ retrievalResult: retryResult, targetTopic: objectivePayload.targetTopic });
      if (retryQuality.score >= quality.score) {
        combinedResult = {
          ...retryResult,
          objective: objectivePayload.objective,
          targetTopic: objectivePayload.targetTopic,
          evidenceType: objectivePayload.evidenceType,
          sourceTypes: unique([...(retryResult.correctiveMeta?.retrySources || []), ...resolvedSources]),
          retrievalFailed: retrievalErrors.length > 0,
          retrievalErrors,
        };
        combinedResult.qualityAssessment = retryQuality;
      } else {
        combinedResult.qualityAssessment = retrievalErrors.length
          ? { ...quality, passed: false, retryRecommended: false, reasons: unique([...(quality.reasons || []), 'RETRIEVAL_ERROR']) }
          : quality;
      }
    }
  } else {
    combinedResult.qualityAssessment = retrievalErrors.length
      ? { ...quality, passed: false, retryRecommended: false, reasons: unique([...(quality.reasons || []), 'RETRIEVAL_ERROR']) }
      : quality;
  }

  const evidenceSummary = combinedResult.items
    .slice(0, 3)
    .map((item) => item.metadata?.topic || item.text?.slice(0, 100) || item.sourceType)
    .filter(Boolean);

  return {
    ...combinedResult,
    sourceQuality: combinedResult.qualityAssessment?.passed ? 'strong' : 'limited',
    evidenceSummary,
    recommendedUses: [
      objectivePayload.objective === 'COLLECT_REPORT_EVIDENCE' ? 'ground_report' : 'guide_next_question',
      objectivePayload.evidenceType,
    ],
  };
};
