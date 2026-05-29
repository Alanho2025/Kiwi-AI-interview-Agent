/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: ragIndexService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';
import { query } from '../db/postgres.js';
import { DocumentChunk } from '../db/models/documentChunkModel.js';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL, embedBatch, normalizeForRetrieval } from './embeddingService.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { InterviewPlan } from '../db/models/interviewPlanModel.js';
import { SessionTranscript } from '../db/models/sessionTranscriptModel.js';
import { InterviewQuestionPoolItem } from '../db/models/interviewQuestionPoolItemModel.js';
import { RETRIEVAL_SOURCES } from './retrieval/retrievalSourceRegistry.js';
import { redactSensitiveText } from './privacyRedactionService.js';

const DEFAULT_CHUNK_SIZE = 900;
const hasContent = (value) => {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(String(value).trim());
};

const pickScoreItems = (items = []) => (Array.isArray(items) ? items : []).map((item) => {
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  return {
    label: item.label || item.id || '',
    score: item.score ?? null,
    status: item.status || null,
    weight: item.weight ?? null,
    importance: item.importance || null,
    type: item.type || item.criterionType || null,
    detail: item.detail || item.notes || '',
    evidence,
  };
}).filter((item) => item.label || item.detail || item.evidence.length);

export const buildMatchAnalysisIndexPayload = (analysis = {}) => {
  const explanation = analysis.explanation || {};
  const matchSummary = analysis.matchSummary || {};

  return {
    schemaVersion: analysis.schemaVersion || 'v3',
    candidateName: matchSummary.candidateName || analysis.parsedCvProfile?.candidateName || 'Candidate',
    jobTitle: matchSummary.jobTitle || analysis.parsedJdProfile?.title || analysis.parsedJdProfile?.jobTitle || 'Target Role',
    matchScore: matchSummary.matchScore ?? analysis.scoreBreakdown?.overall ?? null,
    confidence: analysis.confidence ?? null,
    decision: analysis.decision || {},
    scoreBreakdown: analysis.scoreBreakdown || {},
    explanation: {
      summary: explanation.summary || '',
      strengths: explanation.strengths || matchSummary.strengths || [],
      gaps: explanation.gaps || matchSummary.gaps || [],
      risks: explanation.risks || [],
    },
    interviewFocus: matchSummary.interviewFocus || [],
    requirementChecks: pickScoreItems(analysis.requirementChecks),
    macroScores: pickScoreItems(analysis.macroScores),
    microScores: pickScoreItems(analysis.microScores),
    evidenceMap: analysis.evidenceMap || [],
    sourceSnapshots: analysis.sourceSnapshots || [],
    retrievalSnapshots: analysis.retrievalSnapshots || [],
  };
};

export const buildControllerDecisionIndexPayload = (analysis = {}) => ({
  schemaVersion: analysis.schemaVersion || 'v3',
  controllerState: analysis.controllerState || {},
  decisionRecords: analysis.decisionRecords || [],
  evaluatorRecords: analysis.evaluatorRecords || [],
  trajectoryRecords: analysis.trajectoryRecords || [],
  dynamicSlotRecords: analysis.dynamicSlotRecords || [],
  reflectionRecords: analysis.reflectionRecords || [],
  latestEvaluatorRecord: analysis.latestEvaluatorRecord || null,
  latestTrajectoryRecord: analysis.latestTrajectoryRecord || null,
  latestDynamicSlots: analysis.latestDynamicSlots || null,
  latestReflectionRecord: analysis.latestReflectionRecord || null,
  agentMemory: analysis.agentMemory || {},
  evidenceBundleSnapshot: analysis.evidenceBundleSnapshot || {},
});

const shouldIndexControllerPayload = (payload = {}) => [
  payload.controllerState,
  payload.decisionRecords,
  payload.evaluatorRecords,
  payload.trajectoryRecords,
  payload.dynamicSlotRecords,
  payload.reflectionRecords,
  payload.latestEvaluatorRecord,
  payload.latestTrajectoryRecord,
  payload.latestDynamicSlots,
  payload.latestReflectionRecord,
  payload.agentMemory,
  payload.evidenceBundleSnapshot,
].some(hasContent);

export const buildPreparedQuestionPoolIndexPayload = (items = []) => ({
  schemaVersion: 'v1',
  questionCount: Array.isArray(items) ? items.length : 0,
  questions: (Array.isArray(items) ? items : []).map((item) => ({
    questionId: item.questionId,
    sourceStage: item.sourceStage,
    sourceType: item.sourceType,
    category: item.category,
    stage: item.stage,
    topic: item.topic,
    competency: item.competency,
    questionIntent: item.questionIntent,
    text: item.fallbackText || item.text || '',
    expectedSignal: item.expectedSignal || [],
    evidenceNeed: item.evidenceNeed || [],
    priorityWeight: item.priorityWeight,
    coverageWeight: item.coverageWeight,
    riskWeight: item.riskWeight,
    status: item.status,
  })),
});

const upsertLegacyMongoChunkMirror = async (record) => {
  // Runtime retrieval reads PostgreSQL pgvector. Mongo remains a legacy mirror for migration/debug compatibility.
  await DocumentChunk.findOneAndUpdate({ chunkId: record.chunkId }, record, { upsert: true, setDefaultsOnInsert: true });
};

/**
 * Purpose: Execute the main responsibility for splitTextIntoChunks.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const splitTextIntoChunks = (text = '', chunkSize = DEFAULT_CHUNK_SIZE) => {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return [];
  }

  const chunks = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }
  return chunks;
};

/**
 * Purpose: Execute the main responsibility for buildChunkRecord.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildChunkRecord = ({ sourceType, sourceId, documentType, sessionId = null, userId = null, text, chunkIndex, metadata = {} }) => ({
  chunkId: `${sourceType}_${sourceId}_${chunkIndex}_${crypto.createHash('md5').update(text).digest('hex').slice(0, 8)}`,
  sourceType,
  sourceId,
  documentType,
  sessionId,
  userId,
  text,
  normalizedText: normalizeForRetrieval(text),
  metadata: {
    chunkIndex,
    sourceId,
    documentType,
    userId,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimension: EMBEDDING_DIMENSION,
    ...metadata,
  },
  schemaVersion: 'v2',
});

/**
 * Purpose: Execute the main responsibility for indexTextSource.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const indexTextSource = async ({ sourceType, sourceId, documentType, text, sessionId = null, userId = null, metadata = {} } = {}) => {
  const textChunks = splitTextIntoChunks(text);
  if (!textChunks.length) {
    return [];
  }

  const records = textChunks.map((chunkText, index) => buildChunkRecord({
    sourceType,
    sourceId,
    documentType,
    sessionId,
    userId,
    text: chunkText,
    chunkIndex: index,
    metadata,
  }));
  const embeddings = await embedBatch(records.map((record) => record.normalizedText || record.text));

  for (let index = 0; index < records.length; index += 1) {
    records[index].embedding = embeddings[index];
    
    // Format vector array to Postgres pgvector string format: '[v1,v2,...]'
    const vectorString = `[${embeddings[index].join(',')}]`;
    const record = records[index];

    await query(
      `INSERT INTO document_chunks (session_id, source_type, chunk_index, text_content, metadata, embedding)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`, // Add simple conflict avoidance or just let it insert duplicates for now, or maybe delete old chunks for session first
      [
        record.sessionId || null,
        record.sourceType,
        record.metadata.chunkIndex,
        record.text,
        JSON.stringify(record.metadata),
        vectorString
      ]
    );

    await upsertLegacyMongoChunkMirror(record);
  }

  return records;
};

/**
 * Purpose: Execute the main responsibility for indexSessionArtifacts.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const indexSessionArtifacts = async (sessionId) => {
  const [analysis, plan, transcript, preparedQuestionPool] = await Promise.all([
    SessionAnalysis.findOne({ sessionId }).lean(),
    InterviewPlan.findOne({ sessionId }).lean(),
    SessionTranscript.findOne({ sessionId }).lean(),
    InterviewQuestionPoolItem.find({ sessionId, status: { $in: ['active', 'asked'] } }).sort({ priorityWeight: -1, createdAt: 1 }).lean(),
  ]);

  const indexed = [];

  if (analysis?.parsedCvProfile) {
    indexed.push(...await indexTextSource({
      sourceType: RETRIEVAL_SOURCES.SESSION_CV,
      sourceId: sessionId,
      documentType: 'cv_profile',
      sessionId,
      userId: analysis.userId,
      text: JSON.stringify(analysis.parsedCvProfile, null, 2),
      metadata: { schemaVersion: analysis.schemaVersion || 'v3' },
    }));
  }

  if (analysis?.parsedJdProfile) {
    indexed.push(...await indexTextSource({
      sourceType: RETRIEVAL_SOURCES.SESSION_JD,
      sourceId: sessionId,
      documentType: 'jd_rubric',
      sessionId,
      userId: analysis.userId,
      text: JSON.stringify(analysis.parsedJdProfile, null, 2),
      metadata: { schemaVersion: analysis.schemaVersion || 'v3' },
    }));
  }

  if (analysis) {
    indexed.push(...await indexTextSource({
      sourceType: RETRIEVAL_SOURCES.SESSION_MATCH,
      sourceId: sessionId,
      documentType: 'match_analysis',
      sessionId,
      userId: analysis.userId,
      text: JSON.stringify(buildMatchAnalysisIndexPayload(analysis), null, 2),
      metadata: { schemaVersion: analysis.schemaVersion || 'v3' },
    }));
  }

  const controllerPayload = analysis ? buildControllerDecisionIndexPayload(analysis) : null;
  if (controllerPayload && shouldIndexControllerPayload(controllerPayload)) {
    indexed.push(...await indexTextSource({
      sourceType: RETRIEVAL_SOURCES.SESSION_DECISIONS,
      sourceId: sessionId,
      documentType: 'controller_decision',
      sessionId,
      userId: analysis.userId,
      text: JSON.stringify(controllerPayload, null, 2),
      metadata: {
        schemaVersion: analysis.schemaVersion || 'v3',
        decisionRecordCount: controllerPayload.decisionRecords.length,
        evaluatorRecordCount: controllerPayload.evaluatorRecords.length,
        reflectionRecordCount: controllerPayload.reflectionRecords.length,
      },
    }));
  }

  if (plan) {
    indexed.push(...await indexTextSource({
      sourceType: RETRIEVAL_SOURCES.SESSION_INTERVIEW_PLAN,
      sourceId: sessionId,
      documentType: 'interview_plan',
      sessionId,
      userId: plan.userId,
      text: JSON.stringify({
        strategy: plan.strategy,
        questionPool: plan.questionPool,
        explanation: plan.explanation,
      }, null, 2),
      metadata: { schemaVersion: plan.schemaVersion || 'v3' },
    }));
  }

  if (preparedQuestionPool?.length) {
    indexed.push(...await indexTextSource({
      sourceType: RETRIEVAL_SOURCES.SESSION_PREPARED_QUESTION_POOL,
      sourceId: sessionId,
      documentType: 'prepared_question_pool',
      sessionId,
      userId: preparedQuestionPool[0]?.userId || analysis?.userId || plan?.userId || null,
      text: JSON.stringify(buildPreparedQuestionPoolIndexPayload(preparedQuestionPool), null, 2),
      metadata: {
        schemaVersion: 'v1',
        questionCount: preparedQuestionPool.length,
        activeCount: preparedQuestionPool.filter((item) => item.status === 'active').length,
        askedCount: preparedQuestionPool.filter((item) => item.status === 'asked').length,
      },
    }));
  }

  if (transcript?.turns?.length) {
    const redactedTranscriptText = transcript.redactedTranscript
      || redactSensitiveText(transcript.turns.map((turn) => `${turn.role}: ${turn.text}`).join('\n'));
    indexed.push(...await indexTextSource({
      sourceType: RETRIEVAL_SOURCES.SESSION_TRANSCRIPT,
      sourceId: sessionId,
      documentType: 'transcript',
      sessionId,
      userId: transcript.userId,
      text: redactedTranscriptText,
      metadata: { turnCount: transcript.turns.length },
    }));
  }

  return indexed;
};

export const ensureSessionArtifactsIndexed = async (sessionId) => {
  const existing = await SessionAnalysis.findOne({ sessionId }).select('ragIndexStatus').lean();
  const indexedAt = existing?.ragIndexStatus?.indexedAt;
  if (indexedAt) {
    return { skipped: true, indexedAt, records: [] };
  }

  const records = await indexSessionArtifacts(sessionId);
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        ragIndexStatus: {
          indexedAt: new Date(),
          recordCount: records.length,
          mode: 'initial_full_index',
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { skipped: false, indexedAt: new Date(), records };
};
