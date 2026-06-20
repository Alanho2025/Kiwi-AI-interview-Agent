/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: importInterviewKnowledge should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL, embedBatch } from '../services/embeddingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultInputDir = path.resolve(__dirname, '../../../data/interview-knowledge');

/**
 * Purpose: Execute the main responsibility for readJson.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

import { query as postgresQuery } from '../db/postgres.js';

const upsertMany = async (items) => {
  for (const item of items) {
    // 1. Insert to Postgres Vector DB
    const vectorString = `[${(item.embedding || []).join(',')}]`;
    await postgresQuery(
      `INSERT INTO document_chunks (session_id, source_type, chunk_index, text_content, metadata, embedding)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        item.sessionId || null,
        item.sourceType || 'knowledge',
        item.metadata?.chunkIndex || 0,
        item.text || item.normalizedText || '',
        JSON.stringify({
          ...(item.metadata || {}),
          chunkId: item.chunkId,
          caseId: item.caseId || null,
          sourceId: item.sourceId || null,
          documentType: item.documentType || null,
          embeddingModel: EMBEDDING_MODEL,
          embeddingDimension: EMBEDDING_DIMENSION,
        }),
        vectorString
      ]
    );
  }
};

/**
 * Purpose: Execute the main responsibility for run.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const run = async ({ inputDir = defaultInputDir } = {}) => {
  const chunks = readJson(path.join(inputDir, 'normalized_interview_chunks.json'));
  const embeddings = await embedBatch(chunks.map((item) => item.normalizedText || item.text || ''));
  const hydrated = chunks.map((item, index) => ({
    ...item,
    embedding: embeddings[index] || [],
    metadata: {
      ...(item.metadata || {}),
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimension: EMBEDDING_DIMENSION,
    },
  }));
  await upsertMany(hydrated);
  console.log(`Imported ${hydrated.length} interview knowledge chunks from ${inputDir}`);
};

if (process.argv[1] === __filename) {
  const inputDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultInputDir;
  run({ inputDir }).catch((error) => {
    console.error('Interview knowledge import failed:', error);
    process.exitCode = 1;
  });
}

export { run as importInterviewKnowledge };
