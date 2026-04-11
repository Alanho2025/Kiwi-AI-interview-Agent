/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: ragRetrievalService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { DocumentChunk } from '../db/models/documentChunkModel.js';
import { cosineSimilarity, embedText, normalizeForRetrieval } from './embeddingService.js';

/**
 * Purpose: Execute the main responsibility for tokenize.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const tokenize = (text = '') => new Set(normalizeForRetrieval(text).split(/\s+/).filter(Boolean));

const keywordScore = (queryTokens, text = '') => {
  const chunkTokens = tokenize(text);
  if (!queryTokens.size || !chunkTokens.size) {
    return 0;
  }

  let overlap = 0;
  queryTokens.forEach((token) => {
    if (chunkTokens.has(token)) {
      overlap += 1;
    }
  });

  return Number((overlap / queryTokens.size).toFixed(6));
};

/**
 * Purpose: Execute the main responsibility for computeFusionScore.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const computeFusionScore = ({ semantic = 0, keyword = 0, metadata = 0 }) => Number((semantic * 0.55 + keyword * 0.35 + metadata * 0.1).toFixed(6));

export const retrieveChunks = async ({
  query,
  topK = 5,
  sourceTypes = [],
  sourceId = null,
  sessionId = null,
  minimumScore = 0.05,
} = {}) => {
  const mongoFilter = {};
  if (sourceTypes?.length) {
    mongoFilter.sourceType = { $in: sourceTypes };
  }
  if (sourceId) {
    mongoFilter.sourceId = sourceId;
  }
  if (sessionId) {
    mongoFilter.$or = [{ sessionId }, { 'metadata.sessionId': sessionId }];
  }

  const queryEmbedding = await embedText(query || '');
  const queryTokens = tokenize(query || '');
  const candidateChunks = await DocumentChunk.find(mongoFilter).lean();

  return candidateChunks
    .map((chunk) => {
      const semantic = cosineSimilarity(queryEmbedding, chunk.embedding || []);
      const keyword = keywordScore(queryTokens, chunk.normalizedText || chunk.text || '');
      const metadataBoost = sourceId && chunk.sourceId === sourceId ? 1 : sessionId && chunk.sessionId === sessionId ? 0.75 : 0;
      const fusionScore = computeFusionScore({ semantic, keyword, metadata: metadataBoost });

      return {
        chunkId: chunk.chunkId,
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        sessionId: chunk.sessionId,
        text: chunk.text,
        metadata: chunk.metadata || {},
        scores: { semantic, keyword, metadata: metadataBoost, fusion: fusionScore },
      };
    })
    .filter((item) => item.scores.fusion >= minimumScore)
    .sort((left, right) => right.scores.fusion - left.scores.fusion)
    .slice(0, topK);
};

/**
 * Purpose: Execute the main responsibility for retrieveEvidenceBundle.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const retrieveEvidenceBundle = async ({ query, sessionId, sourceTypes = [], topK = 5 } = {}) => {
  const items = await retrieveChunks({ query, sessionId, sourceTypes, topK });
  return {
    query,
    topK,
    items,
    sourceTypes,
  };
};
