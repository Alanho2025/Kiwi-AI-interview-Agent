import { retrieveEvidenceBundle } from '../ragRetrievalService.js';

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const broadenQuery = ({ query = '', targetTopic = '', evidenceType = '' } = {}) => [query, targetTopic, evidenceType, 'example evidence proof']
  .map((item) => String(item || '').trim())
  .filter(Boolean)
  .join(' ')
  .trim();

export const runCorrectiveRetrieval = async ({
  query,
  targetTopic,
  evidenceType,
  sessionId,
  sourceTypes = [],
  topK = 5,
} = {}) => {
  const retryQuery = broadenQuery({ query, targetTopic, evidenceType });
  const retrySources = unique([...sourceTypes, 'transcript', 'question_bank']);
  const retryResult = await retrieveEvidenceBundle({
    query: retryQuery,
    sessionId,
    sourceTypes: retrySources,
    topK,
  });

  return {
    ...retryResult,
    query: retryQuery,
    correctiveRetryUsed: true,
    correctiveMeta: {
      retrySources,
      retryStrategy: 'broaden_query_and_expand_sources',
    },
  };
};
