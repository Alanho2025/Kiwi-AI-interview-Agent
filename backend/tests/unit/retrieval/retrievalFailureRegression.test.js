import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assessRetrievalQuality } from '../../../src/services/retrieval/retrievalQualityAssessor.js';

describe('retrieval failure regressions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('flags empty retrieval as retry-worthy limited evidence', () => {
    const quality = assessRetrievalQuality({
      targetTopic: 'api security',
      retrievalResult: { items: [] },
    });

    expect(quality.passed).toBe(false);
    expect(quality.retryRecommended).toBe(true);
    expect(quality.reasons).toContain('NO_RESULTS');
  });

  it('flags irrelevant low-score chunks as off-topic', () => {
    const quality = assessRetrievalQuality({
      targetTopic: 'api security',
      retrievalResult: {
        items: [
          { text: 'general soft skill question', metadata: { topic: 'communication' }, scores: { fusion: 0.03 } },
        ],
      },
    });

    expect(quality.passed).toBe(false);
    expect(quality.reasons).toContain('LOW_TOPIC_ALIGNMENT');
    expect(quality.reasons).toContain('LOW_FUSION_SCORE');
  });

  it('returns a safe limited payload when retrieval dependencies throw', async () => {
    vi.doMock('../../../src/services/retrieval/sessionEvidenceRetriever.js', () => ({
      retrieveSessionEvidence: vi.fn(async () => {
        throw new Error('Mongo unavailable');
      }),
    }));
    vi.doMock('../../../src/services/retrieval/globalKnowledgeRetriever.js', () => ({
      retrieveGlobalKnowledge: vi.fn(async () => ({ items: [] })),
    }));
    vi.doMock('../../../src/services/retrieval/correctiveRetrievalService.js', () => ({
      runCorrectiveRetrieval: vi.fn(async () => {
        throw new Error('Vector timeout');
      }),
    }));

    const { runRetrievalAgent } = await import('../../../src/services/agents/retrievalAgent.js');
    const result = await runRetrievalAgent({
      query: 'api security',
      sessionId: 's1',
      sourceTypes: ['cv_profile'],
      targetTopic: 'api security',
      topK: 3,
    });

    expect(result.items).toEqual([]);
    expect(result.sourceQuality).toBe('limited');
    expect(result.retrievalFailed).toBe(true);
    expect(result.qualityAssessment.reasons).toContain('RETRIEVAL_ERROR');
  });
});
