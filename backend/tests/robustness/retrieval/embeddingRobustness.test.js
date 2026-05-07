import { describe, expect, it } from 'vitest';

import {
  EMBEDDING_DIMENSION,
  buildDeterministicEmbedding,
  cosineSimilarity,
} from '../../../src/services/embeddingService.js';

describe('weighted hash embedding robustness', () => {
  it('returns the configured 256-dimensional normalized vector', () => {
    const vector = buildDeterministicEmbedding('Python SQL data pipelines with PostgreSQL');
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

    expect(vector).toHaveLength(EMBEDDING_DIMENSION);
    expect(EMBEDDING_DIMENSION).toBe(256);
    expect(magnitude).toBeCloseTo(1, 4);
  });

  it('scores related technical phrases above unrelated generic text', () => {
    const query = buildDeterministicEmbedding('PostgreSQL data pipeline experience');
    const related = buildDeterministicEmbedding('Built SQL and PostgreSQL pipelines for analytics data workflows');
    const unrelated = buildDeterministicEmbedding('Customer service teamwork and retail scheduling');

    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });
});
