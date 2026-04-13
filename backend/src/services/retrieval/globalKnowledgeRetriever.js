import { retrieveEvidenceBundle } from '../ragRetrievalService.js';

export const retrieveGlobalKnowledge = async ({ query, sourceTypes = [], topK = 5 } = {}) =>
  retrieveEvidenceBundle({ query, sourceTypes, topK });
