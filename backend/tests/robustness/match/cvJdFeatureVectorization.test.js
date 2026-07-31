import { describe, expect, it } from 'vitest';
import {
  buildDeterministicEmbedding,
  cosineSimilarity,
  embedText,
  embedBatch,
  normalizeForRetrieval,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
} from '../../../src/services/embeddingService.js';

describe('F-48 ETL CV-JD Feature Vectorization Robustness Suite', () => {
  it('generates 256-dimensional feature vectors with correct model identifier', async () => {
    const text = 'Senior React Developer with TypeScript, Redux, and REST API experience';
    const vector = buildDeterministicEmbedding(text);
    const asyncVector = await embedText(text);

    expect(EMBEDDING_DIMENSION).toBe(256);
    expect(EMBEDDING_MODEL).toBe('weighted_hash_ngram_v2');
    expect(Array.isArray(vector)).toBe(true);
    expect(vector.length).toBe(256);
    expect(asyncVector).toEqual(vector);
  });

  it('calculates cosine similarity accurately between feature vectors', () => {
    const vectorA = buildDeterministicEmbedding('React TypeScript Frontend Developer');
    const vectorB = buildDeterministicEmbedding('React TypeScript Web Developer');
    const vectorC = buildDeterministicEmbedding('Healthcare Registered Nurse Clinical Practitioner');

    const similarityAB = cosineSimilarity(vectorA, vectorB);
    const similarityAC = cosineSimilarity(vectorA, vectorC);

    expect(similarityAB).toBeGreaterThan(similarityAC);
    expect(similarityAB).toBeGreaterThan(0.5);
    expect(similarityAC).toBeLessThan(0.3);
  });

  it('vectorizes text batches asynchronously with embedBatch', async () => {
    const texts = [
      'Python Data Scientist with PyTorch',
      'Java Enterprise Spring Boot Backend Engineer',
      'AWS Cloud Infrastructure Specialist',
    ];

    const vectors = await embedBatch(texts);
    expect(Array.isArray(vectors)).toBe(true);
    expect(vectors.length).toBe(3);
    expect(vectors[0].length).toBe(256);
  });

  it('normalizes tokens for retrieval with normalizeForRetrieval helper', () => {
    const rawText = 'Senior CI/CD & Node.js Developer (Full-Stack)!';
    const normalized = normalizeForRetrieval(rawText);

    expect(normalized).toContain('cicd');
    expect(normalized).toContain('node');
    expect(normalized).not.toContain('!');
  });
});
