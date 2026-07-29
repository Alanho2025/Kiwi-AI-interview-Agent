import fs from 'node:fs';

import { renderQuestionCatalogReviewMarkdown } from '../services/questions/questionCatalogReviewDocumentService.js';

const reviewDocumentUrl = new URL(
  '../../../docs/question_refine/reviews/cp1-2026.1-catalog-full-review.md',
  import.meta.url,
);
const markdown = renderQuestionCatalogReviewMarkdown();
const shouldWrite = process.argv.includes('--write');
const shouldCheck = process.argv.includes('--check');

if (shouldWrite) {
  fs.writeFileSync(reviewDocumentUrl, markdown, 'utf8');
  console.log(`Wrote ${reviewDocumentUrl.pathname}`);
} else if (shouldCheck) {
  const checkedInDocument = fs.readFileSync(reviewDocumentUrl, 'utf8');
  if (checkedInDocument !== markdown) {
    throw new Error('The checked-in CP1 full review artifact has drifted from the governed catalog source.');
  }
  console.log('CP1 full review artifact matches the governed catalog source.');
} else {
  process.stdout.write(markdown);
}
