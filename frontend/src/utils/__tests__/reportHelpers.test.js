import { describe, expect, it } from 'vitest';
import { formatReportAsText } from '../reportHelpers.js';

describe('report export text formatting', () => {
  it('renders object-shaped recommendations and QA notes without object placeholders', () => {
    const text = formatReportAsText({
      sessionId: 'session-report-export',
      latestStatus: 'needs_review',
      report: {
        schemaVersion: 'v3',
        candidateName: 'Aroha Candidate',
        jobTitle: 'Frontend Developer',
        summary: 'Evidence is useful but incomplete.',
        scores: {
          overall: 'not-scored',
          macro: 72,
          evidenceStrength: null,
        },
        recommendations: [
          { title: 'Add measurable outcomes', description: 'Use result evidence.' },
        ],
      },
      qaResult: {
        coverageScore: 61,
        hallucinationRisk: 'medium',
        notes: [{ label: 'Needs stronger evidence', content: 'Report should stay cautious.' }],
        qualityFlags: ['insufficient_evidence'],
      },
    });

    expect(text).toContain('Candidate: Aroha Candidate');
    expect(text).toContain('Target Role: Frontend Developer');
    expect(text).toContain('Overall Score: Not available');
    expect(text).toContain('Add measurable outcomes');
    expect(text).toContain('Report Status: needs_review');
    expect(text).toContain('Coverage Score: 61/100');
    expect(text).toContain('insufficient_evidence');
    expect(text).not.toContain('[object Object]');
    expect(text).not.toContain('NaN');
  });
});
