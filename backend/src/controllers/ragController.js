/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: ragController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { formatSuccess } from '../utils/responseFormatter.js';
import { importResumeScoreDetails } from '../scripts/importResumeScoreDetails.js';
import { importInterviewKnowledge } from '../scripts/importInterviewKnowledge.js';
import { retrieveChunks } from '../services/ragRetrievalService.js';
import { indexSessionArtifacts } from '../services/ragIndexService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireBodyField } from '../utils/controllerHelpers.js';

export const importBenchmarkDataset = asyncHandler(async (req, res) => {
  const { inputDir } = req.body || {};
  await importResumeScoreDetails({ inputDir });
  res.json(formatSuccess('Benchmark dataset imported', { inputDir: inputDir || 'default' }));
});

export const importInterviewKnowledgeDataset = asyncHandler(async (req, res) => {
  const { inputDir } = req.body || {};
  await importInterviewKnowledge({ inputDir });
  res.json(formatSuccess('Interview knowledge imported', { inputDir: inputDir || 'default' }));
});

export const rebuildSessionIndex = asyncHandler(async (req, res) => {
  const sessionId = requireBodyField(req, 'sessionId', 'sessionId is required');
  const records = await indexSessionArtifacts(sessionId);
  res.json(formatSuccess('Session artifacts indexed', { sessionId, chunkCount: records.length }));
});

export const retrieveRagContext = asyncHandler(async (req, res) => {
  const query = requireBodyField(req, 'query', 'query is required');
  const { sourceTypes = [], sessionId = null, topK = 5 } = req.body || {};
  const items = await retrieveChunks({ query, sourceTypes, sessionId, topK });
  res.json(formatSuccess('RAG context retrieved', { query, items }));
});
