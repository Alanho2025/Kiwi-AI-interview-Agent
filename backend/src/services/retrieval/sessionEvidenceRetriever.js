import { retrieveEvidenceBundle } from '../ragRetrievalService.js';

export const retrieveSessionEvidence = async ({ query, sessionId, sourceTypes = [], topK = 5 } = {}) =>
  retrieveEvidenceBundle({ query, sessionId, sourceTypes, topK });
