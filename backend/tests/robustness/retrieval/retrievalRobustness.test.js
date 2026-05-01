import { describe, expect, it } from 'vitest';

import { assessRetrievalQuality } from '../../../src/services/retrieval/retrievalQualityAssessor.js';

describe('retrieval robustness', () => {
  it('recommends retry when retrieval returns no evidence', () => {
    expect(assessRetrievalQuality({ retrievalResult: { items: [] }, targetTopic: 'React' })).toEqual({
      passed: false,
      reasons: ['NO_RESULTS'],
      retryRecommended: true,
      score: 0,
    });
  });

  it('detects low topic alignment and generic evidence instead of accepting irrelevant chunks', () => {
    const quality = assessRetrievalQuality({
      targetTopic: 'Kubernetes',
      retrievalResult: {
        items: [
          { text: 'Good communicator', metadata: { topic: 'soft_skills' }, scores: { fusion: 0.02 } },
          { text: 'Team player', metadata: { topic: 'teamwork' }, scores: { fusion: 0.01 } },
        ],
      },
    });

    expect(quality.passed).toBe(false);
    expect(quality.retryRecommended).toBe(true);
    expect(quality.reasons).toEqual(expect.arrayContaining(['LOW_TOPIC_ALIGNMENT', 'LOW_FUSION_SCORE', 'GENERIC_EVIDENCE']));
  });
});
