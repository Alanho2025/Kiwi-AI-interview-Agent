import { describe, expect, it } from 'vitest';
import { assessRetrievalQuality } from '../../src/services/retrieval/retrievalQualityAssessor.js';

describe('assessRetrievalQuality', () => {
  it('recommends retry when retrieval result is generic and off-topic', () => {
    const assessment = assessRetrievalQuality({
      targetTopic: 'api security',
      retrievalResult: {
        items: [
          { text: 'general question', metadata: { topic: 'general' }, scores: { fusion: 0.04 } },
        ],
      },
    });

    expect(assessment.retryRecommended).toBe(true);
    expect(assessment.reasons).toContain('LOW_TOPIC_ALIGNMENT');
  });
});
