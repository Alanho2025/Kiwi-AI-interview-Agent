import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { importResumeScoreDetails } from '../scripts/importResumeScoreDetails.js';
import { importInterviewKnowledge } from '../scripts/importInterviewKnowledge.js';
import { retrieveChunks } from '../services/ragRetrievalService.js';
import { indexSessionArtifacts } from '../services/ragIndexService.js';

export const importBenchmarkDataset = async (req, res, next) => {
  try {
    const { inputDir } = req.body || {};
    await importResumeScoreDetails({ inputDir });
    res.json(formatSuccess('Benchmark dataset imported', { inputDir: inputDir || 'default' }));
  } catch (error) {
    next(error);
  }
};


export const importInterviewKnowledgeDataset = async (req, res, next) => {
  try {
    const { inputDir } = req.body || {};
    await importInterviewKnowledge({ inputDir });
    res.json(formatSuccess('Interview knowledge imported', { inputDir: inputDir || 'default' }));
  } catch (error) {
    next(error);
  }
};

export const rebuildSessionIndex = async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json(formatError('Missing sessionId', 'MISSING_PARAM', 'sessionId is required'));
    }
    const records = await indexSessionArtifacts(sessionId);
    res.json(formatSuccess('Session artifacts indexed', { sessionId, chunkCount: records.length }));
  } catch (error) {
    next(error);
  }
};

export const retrieveRagContext = async (req, res, next) => {
  try {
    const { query, sourceTypes = [], sessionId = null, topK = 5 } = req.body || {};
    if (!query?.trim()) {
      return res.status(400).json(formatError('Missing query', 'MISSING_PARAM', 'query is required'));
    }
    const items = await retrieveChunks({ query, sourceTypes, sessionId, topK });
    res.json(formatSuccess('RAG context retrieved', { query, items }));
  } catch (error) {
    next(error);
  }
};
