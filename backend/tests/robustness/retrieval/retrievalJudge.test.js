import { describe, expect, it } from 'vitest';

import { judgeRetrievalCase } from '../../../eval/helpers/retrievalJudge.js';

describe('retrieval eval judge', () => {
  it('does not fail when blocked evidence appears as a JD requirement gap', () => {
    const result = judgeRetrievalCase({
      id: 'weak_evidence_not_upgraded',
      query: 'cloud native Kubernetes production deployment',
      sources: {
        cv: [
          'Deployed a student project to Vercel and Render for a course demo.',
          'Used Node.js, React, and MongoDB.',
        ],
        jd: [
          'The job requires cloud-native engineering and Kubernetes.',
        ],
      },
      expectedRelevantEvidence: ['Vercel', 'Render', 'Node.js'],
      blockedEvidence: ['Kubernetes', 'cloud-native engineering'],
      expectedOutcome: 'retrieve deployment evidence but do not claim Kubernetes or cloud-native experience',
    });

    expect(result.score).toBeGreaterThanOrEqual(0.6);
    expect(result.failedChecks).not.toContain('blocked_evidence_absent_from_sources');
    expect(result.failedChecks).not.toContain('blocked_evidence_not_upgraded_to_supported_claim');
    expect(result.subScores.blockedEvidence).toBe(1);
    expect(result.diagnostics.blockedHits).toEqual(['Kubernetes', 'cloud-native engineering']);
  });

  it('fails when the expected outcome upgrades blocked evidence into support', () => {
    const result = judgeRetrievalCase({
      id: 'unsupported_upgrade',
      query: 'Kubernetes production deployment',
      sources: {
        cv: ['Deployed a student project to Vercel.'],
        jd: ['The job requires Kubernetes.'],
      },
      expectedRelevantEvidence: ['Vercel'],
      blockedEvidence: ['Kubernetes'],
      expectedOutcome: 'claim Kubernetes production deployment as supported by the candidate evidence',
    });

    expect(result.failedChecks).toContain('blocked_evidence_not_upgraded_to_supported_claim');
    expect(result.subScores.blockedEvidence).toBe(0);
  });
});
