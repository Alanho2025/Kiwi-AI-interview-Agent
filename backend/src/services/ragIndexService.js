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
    await DocumentChunk.findOneAndUpdate({ chunkId: records[index].chunkId }, records[index], { upsert: true, setDefaultsOnInsert: true });
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
