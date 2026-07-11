import { describe, expect, it } from 'vitest';
import { stampHumanReviewMetadata } from '../jdHumanReview.js';

describe('stampHumanReviewMetadata', () => {
  it('clears match blocking safeguards after the JD is human verified', () => {
    const stampedRubric = stampHumanReviewMetadata(
      {
        title: 'Data Analyst',
        safeguard: {
          blockMatch: true,
          finalStatus: 'jd_parse_needs_review',
          confidence: 0.72,
        },
      },
      'verified',
    );

    expect(stampedRubric.safeguard.blockMatch).toBe(false);
    expect(stampedRubric.safeguard.originalBlockMatch).toBe(true);
    expect(stampedRubric.safeguard.humanReviewOverrideApplied).toBe(true);
    expect(stampedRubric.safeguard.finalStatus).toBe('jd_parse_needs_review_human_reviewed');
    expect(stampedRubric.metadata.safeguard).toEqual(stampedRubric.safeguard);
    expect(stampedRubric.metadata.inputTrustLevel).toBe('human_reviewed');
    expect(stampedRubric.diagnostics.humanReviewStatus).toBe('verified');
  });

  it('preserves blocking safeguards while the JD is only edited', () => {
    const stampedRubric = stampHumanReviewMetadata(
      {
        title: 'Data Analyst',
        metadata: {
          safeguard: {
            blockMatch: true,
            finalStatus: 'jd_parse_needs_review',
          },
        },
      },
      'edited',
    );

    expect(stampedRubric.safeguard.blockMatch).toBe(true);
    expect(stampedRubric.safeguard.humanReviewOverrideApplied).toBeUndefined();
    expect(stampedRubric.metadata.safeguard.blockMatch).toBe(true);
    expect(stampedRubric.metadata.inputTrustLevel).toBe('ai_parsed');
    expect(stampedRubric.diagnostics.humanReviewStatus).toBe('edited');
  });

  it('versions and verifies the role-fit review contract without discarding source-labelled drafts', () => {
    const stampedRubric = stampHumanReviewMetadata({
      title: 'Data Analyst',
      roleFit: {
        review: { status: 'unreviewed', version: 3 },
        companyUnderstanding: { summary: 'Builds trusted reporting products.' },
        roleIntent: { items: [{ id: 'intent:sql', statement: 'Production SQL', sourceLabel: 'JD must-have requirement' }] },
      },
    }, 'verified');

    expect(stampedRubric.roleFit.review).toMatchObject({
      status: 'verified',
      baseVersion: 3,
      version: 4,
    });
    expect(stampedRubric.roleFit.companyUnderstanding.summary).toBe('Builds trusted reporting products.');
    expect(stampedRubric.roleFit.roleIntent.items[0].sourceLabel).toBe('JD must-have requirement');
  });
});
