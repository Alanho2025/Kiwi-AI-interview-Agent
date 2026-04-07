import { retrieveEvidenceBundle } from '../ragRetrievalService.js';

export const runRetrievalAgent = async ({ query, sessionId = null, sourceTypes = [], topK = 5 } = {}) =>
  retrieveEvidenceBundle({ query, sessionId, sourceTypes, topK });
