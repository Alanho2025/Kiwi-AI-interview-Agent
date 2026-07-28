import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AI_DELIVERY_SIGNAL_TAXONOMY,
  ML_SIGNAL_ALIASES,
  QUESTION_CATALOG_SEED,
} from '../../../src/data/questionCatalogSeed2026_1.js';
import { QUESTION_CATALOG_REVIEW } from '../../../src/data/questionCatalogReview2026_1.js';
import { renderQuestionCatalogReviewMarkdown } from '../../../src/services/questions/questionCatalogReviewDocumentService.js';

const REVIEW_DOCUMENT_URL = new URL(
  '../../../../docs/question_refine/reviews/cp1-2026.1-catalog-full-review.md',
  import.meta.url,
);

describe('question catalog human review document', () => {
  it('renders every governed question, level variant, taxonomy entry, alias, and source', () => {
    const markdown = renderQuestionCatalogReviewMarkdown();

    expect(markdown).toContain(QUESTION_CATALOG_REVIEW.candidateCatalogDigest);
    QUESTION_CATALOG_REVIEW.governanceScope.forEach((scope) => expect(markdown).toContain(scope));
    QUESTION_CATALOG_SEED.forEach((item) => {
      expect(markdown).toContain(`\`${item.catalogQuestionId}\``);
      item.promptVariants.forEach((variant) => {
        expect(markdown).toContain(variant.text);
      });
      item.researchBasis.sources.forEach((source) => expect(markdown).toContain(source));
      item.notEligibleExamples.forEach((example) => expect(markdown).toContain(example));
    });
    AI_DELIVERY_SIGNAL_TAXONOMY.forEach((entry) => {
      expect(markdown).toContain(`\`${entry.canonicalKey}\``);
      entry.aliases.forEach((alias) => expect(markdown).toContain(`\`${alias}\``));
      entry.sources.forEach((source) => expect(markdown).toContain(source));
    });
    ML_SIGNAL_ALIASES.forEach((alias) => expect(markdown).toContain(`\`${alias}\``));
  });

  it('keeps the checked-in review artifact byte-for-byte aligned with the governed source', () => {
    const checkedInDocument = fs.readFileSync(REVIEW_DOCUMENT_URL, 'utf8');

    expect(checkedInDocument).toBe(renderQuestionCatalogReviewMarkdown());
  });
});
