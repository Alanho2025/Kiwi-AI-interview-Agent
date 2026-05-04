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
import { query as postgresQuery } from '../db/postgres.js';

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
  sourceId = null, // Deprecated in pg schema, mapped to metadata
  sessionId = null,
  minimumScore = 0.05,
} = {}) => {
  const queryEmbedding = await embedText(query || '');
  const queryTokens = tokenize(query || '');
  const vectorString = `[${queryEmbedding.join(',')}]`;

  // Build Postgres Query
  let sql = `
    SELECT 
      id as "chunkId", 
      source_type as "sourceType", 
      session_id as "sessionId", 
      text_content as "text", 
      metadata,
      1 - (embedding <=> $1) AS semantic
    FROM document_chunks
    WHERE 1=1
  `;
  const params = [vectorString];
  let paramCounter = 2;

  if (sourceTypes?.length) {
    sql += ` AND source_type = ANY($${paramCounter})`;
    params.push(sourceTypes);
    paramCounter++;
  }
  if (sessionId) {
    sql += ` AND session_id = $${paramCounter}`;
    params.push(sessionId);
    paramCounter++;
  }

  // Use pgvector to pre-filter or just calculate semantic score, we limit to 100 for fusion
  sql += ` ORDER BY embedding <=> $1 LIMIT 100`;

  const { rows: candidateChunks } = await postgresQuery(sql, params);

  return candidateChunks
    .map((chunk) => {
      const semantic = chunk.semantic || 0;
      const keyword = keywordScore(queryTokens, chunk.text || '');
      const metadataObj = chunk.metadata || {};
      
      // Legacy metadata boost logic
      const metadataBoost = sourceId && metadataObj.sourceId === sourceId ? 1 : sessionId && chunk.sessionId === sessionId ? 0.75 : 0;
      const fusionScore = computeFusionScore({ semantic, keyword, metadata: metadataBoost });

      return {
        chunkId: chunk.chunkId,
        sourceType: chunk.sourceType,
        sourceId: metadataObj.sourceId || sourceId,
        sessionId: chunk.sessionId,
        text: chunk.text,
        metadata: metadataObj,
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
