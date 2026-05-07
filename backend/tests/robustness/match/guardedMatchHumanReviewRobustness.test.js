import { describe, expect, it } from 'vitest';

import { compareCvToJobDescriptionWithSafeguard } from '../../../src/services/match/guardedMatchService.js';

const cvText = `Ava Chen
Data Engineer

Built Python and SQL data pipelines for customer analytics projects.
Used PostgreSQL, Linux, Git, and dashboard validation to clean data and check output quality.
Documented data workflows and explained pipeline trade-offs to stakeholders.`;

const blockedJdRubric = {
  schemaVersion: 'v3',
  title: 'Data Engineer',
  jobTitle: 'Data Engineer',
  jobOverview: { title: 'Data Engineer' },
  sections: {
    responsibilities: ['Build Python and SQL data pipelines for analytics use cases.'],
    mustHaveRequirements: ['Python', 'SQL'],
    technicalSkills: {
      data: [{ label: 'Python' }, { label: 'SQL' }, { label: 'PostgreSQL' }],
    },
  },
  mustHaveRequirements: ['Python', 'SQL'],
  technicalSkillRequirements: ['Python', 'SQL', 'PostgreSQL'],
  weights: {
    overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
    macro: { technical_expertise: 1 },
    micro: { python: 0.5, sql: 0.5 },
  },
  macroCriteria: [{ label: 'Technical expertise', weight: 1 }],
  microCriteria: [
    { label: 'Python', weight: 0.5 },
    { label: 'SQL', weight: 0.5 },
  ],
  requirements: [
    { label: 'Python', type: 'hard', importance: 'high' },
    { label: 'SQL', type: 'hard', importance: 'high' },
  ],
  safeguard: {
    verdict: 'reject',
    confidence: 0.42,
    blockMatch: true,
    finalStatus: 'needs_manual_jd_review',
    issues: [{ field: 'requirements', severity: 'high', problem: 'JD parse needs review.', action: 'Confirm extracted fields.' }],
  },
  metadata: {
    safeguard: {
      verdict: 'reject',
      confidence: 0.42,
      blockMatch: true,
      finalStatus: 'needs_manual_jd_review',
    },
  },
};

describe('guarded match human review override', () => {
  it('keeps a blocked JD at zero when the JD has not been human reviewed', async () => {
    const result = await compareCvToJobDescriptionWithSafeguard(cvText, 'Data Engineer JD', blockedJdRubric);

    expect(result.overallScore).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.decision).toMatchObject({ label: 'manual_review' });
    expect(result.riskFlags).toContain('JD needs review before matching.');
  });

  it('allows matching when a previously blocked JD is human reviewed', async () => {
    const reviewedRubric = {
      ...blockedJdRubric,
      metadata: {
        ...blockedJdRubric.metadata,
        humanReviewStatus: 'verified',
        inputTrustLevel: 'human_reviewed',
      },
    };

    const result = await compareCvToJobDescriptionWithSafeguard(cvText, 'Data Engineer JD', reviewedRubric);

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.decision.label).not.toBe('manual_review');
    expect(result.matchingDetails.jdSafeguard).toMatchObject({
      blockMatch: false,
      humanReviewOverrideApplied: true,
      originalBlockMatch: true,
    });
  });
});
