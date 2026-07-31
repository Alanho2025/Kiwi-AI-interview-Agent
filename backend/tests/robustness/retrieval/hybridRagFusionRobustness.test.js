import { describe, expect, it } from 'vitest';
import { rankRetrievalCandidates, RETRIEVAL_CONFIG } from '../../../src/services/ragRetrievalService.js';

describe('Phase 1 - F-70: Hybrid RAG Linear Score Fusion Robustness', () => {
  it('correctly balances semantic (0.55), keyword (0.35), and metadata (0.1) weights', () => {
    expect(RETRIEVAL_CONFIG.fusionWeights).toEqual({
      semantic: 0.55,
      keyword: 0.35,
      metadata: 0.1,
    });
  });

  it('ranks candidate chunks based on linear score fusion and pre-filters below minimum score', () => {
    const candidateChunks = [
      {
        chunkId: 'chunk-1',
        sourceType: 'cv',
        sessionId: 's-1',
        text: 'I worked with PostgreSQL and Docker containers for microservices.',
        semantic: 0.9,
      },
      {
        chunkId: 'chunk-2',
        sourceType: 'job_description',
        sessionId: 's-1',
        text: 'Looking for a developer with React and CSS styling skills.',
        semantic: 0.1,
      },
    ];

    const results = rankRetrievalCandidates({
      query: 'PostgreSQL database experience',
      candidateChunks,
      sessionId: 's-1',
      minimumScore: 0.3,
    });

    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('chunk-1');
    expect(results[0].scores.fusion).toBeGreaterThan(0.5);
  });

  it('handles Maori and special character tokenization safely without regex errors', () => {
    const candidateChunks = [
      {
        chunkId: 'chunk-maori',
        sourceType: 'cv',
        sessionId: 's-1',
        text: 'Tāngata whenua project collaboration with +5* special symbols.',
        semantic: 0,
      },
    ];

    const results = rankRetrievalCandidates({
      query: 'Tāngata whenua +5*',
      candidateChunks,
      sessionId: 's-1',
      minimumScore: 0.05,
    });

    expect(results).toHaveLength(1);
    expect(results[0].scores.keyword).toBeGreaterThan(0.5);
    expect(results[0].scores.fusion).toBeGreaterThan(0.1);
  });
});
