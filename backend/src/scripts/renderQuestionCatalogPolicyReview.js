import fs from 'node:fs';

import { renderVoiceSelectionPolicyReviewMarkdown } from '../services/questions/questionCatalogPolicyReviewDocumentService.js';
import { QUESTION_SELECTION_POLICY_REVIEW } from '../services/questions/questionCatalogPolicyReviewService.js';

const reviewDocumentUrl = new URL(
  '../../../docs/question_refine/reviews/cp2-voice-selection-policy-full-review.md',
  import.meta.url,
);
const markdown = renderVoiceSelectionPolicyReviewMarkdown({
  policyReviewRecord: QUESTION_SELECTION_POLICY_REVIEW,
});
const shouldWrite = process.argv.includes('--write');
const shouldCheck = process.argv.includes('--check');

if (shouldWrite) {
  fs.writeFileSync(reviewDocumentUrl, markdown, 'utf8');
  console.log(`Wrote ${reviewDocumentUrl.pathname}`);
} else if (shouldCheck) {
  const checkedInDocument = fs.readFileSync(reviewDocumentUrl, 'utf8');
  if (checkedInDocument !== markdown) {
    throw new Error('The checked-in CP2 policy review artifact has drifted from executable policy output.');
  }
  console.log('CP2 policy review artifact matches executable policy output.');
} else {
  process.stdout.write(markdown);
}
