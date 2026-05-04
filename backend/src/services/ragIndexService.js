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
import { embedBatch, normalizeForRetrieval } from './embeddingService.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { InterviewPlan } from '../db/models/interviewPlanModel.js';
import { SessionTranscript } from '../db/models/sessionTranscriptModel.js';

const DEFAULT_CHUNK_SIZE = 900;

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

    // Keep Mongo insertion for backward compatibility temporarily if needed
    await DocumentChunk.findOneAndUpdate({ chunkId: record.chunkId }, record, { upsert: true, setDefaultsOnInsert: true });
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
  const [analysis, plan, transcript] = await Promise.all([
    SessionAnalysis.findOne({ sessionId }).lean(),
    InterviewPlan.findOne({ sessionId }).lean(),
    SessionTranscript.findOne({ sessionId }).lean(),
  ]);

  const indexed = [];

  if (analysis?.parsedCvProfile) {
    indexed.push(...await indexTextSource({
      sourceType: 'cv_profile',
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
      sourceType: 'jd_rubric',
      sourceId: sessionId,
      documentType: 'jd_rubric',
      sessionId,
      userId: analysis.userId,
      text: JSON.stringify(analysis.parsedJdProfile, null, 2),
      metadata: { schemaVersion: analysis.schemaVersion || 'v3' },
    }));
  }

  if (plan) {
    indexed.push(...await indexTextSource({
      sourceType: 'interview_plan',
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

  if (transcript?.turns?.length) {
    indexed.push(...await indexTextSource({
      sourceType: 'transcript',
      sourceId: sessionId,
      documentType: 'transcript',
      sessionId,
      userId: transcript.userId,
      text: transcript.turns.map((turn) => `${turn.role}: ${turn.text}`).join('\n'),
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
