import { getEnv } from '../config/env.js';
import { connectMongo, disconnectMongo } from '../db/mongo.js';
import { QUESTION_CATALOG_SEED as QUESTION_CATALOG_SEED_2026_1, QUESTION_CATALOG_VERSION as QUESTION_CATALOG_VERSION_2026_1 } from '../data/questionCatalogSeed2026_1.js';
import { QUESTION_CATALOG_REVIEW as QUESTION_CATALOG_REVIEW_2026_1 } from '../data/questionCatalogReview2026_1.js';
import { QUESTION_CATALOG_SEED as QUESTION_CATALOG_SEED_2026_2, QUESTION_CATALOG_VERSION as QUESTION_CATALOG_VERSION_2026_2 } from '../data/questionCatalogSeed2026_2.js';
import { QUESTION_CATALOG_REVIEW as QUESTION_CATALOG_REVIEW_2026_2 } from '../data/questionCatalogReview2026_2.js';
import { QUESTION_SELECTION_POLICY_REVIEW } from '../services/questions/questionCatalogPolicyReviewService.js';
import { approveQuestionCatalogVersion, seedQuestionCatalog } from '../services/questions/questionCatalogRepository.js';

const shouldApprove = process.argv.includes('--approve');
const versionArgIndex = process.argv.indexOf('--version');
const requestedVersion = versionArgIndex !== -1 && process.argv[versionArgIndex + 1] ? process.argv[versionArgIndex + 1] : '2026.1';

const is2026_2 = requestedVersion === QUESTION_CATALOG_VERSION_2026_2;
const catalogSeed = is2026_2 ? QUESTION_CATALOG_SEED_2026_2 : QUESTION_CATALOG_SEED_2026_1;
const catalogVersion = is2026_2 ? QUESTION_CATALOG_VERSION_2026_2 : QUESTION_CATALOG_VERSION_2026_1;
const reviewRecord = is2026_2 ? QUESTION_CATALOG_REVIEW_2026_2 : QUESTION_CATALOG_REVIEW_2026_1;
const policyReviewRecord = { ...QUESTION_SELECTION_POLICY_REVIEW, policyVersion: catalogVersion };

const run = async () => {
  await connectMongo();
  const seedResult = await seedQuestionCatalog({ items: catalogSeed });
  const report = {
    catalogVersion,
    seedItemCount: catalogSeed.length,
    insertedCount: seedResult.upsertedCount || 0,
    retainedCount: seedResult.matchedCount || 0,
    approval: 'not_requested',
  };

  if (shouldApprove) {
    const reviewer = getEnv('QUESTION_CATALOG_REVIEWER');
    const approvalResult = await approveQuestionCatalogVersion({
      catalogVersion,
      reviewer,
      reviewRecord,
      policyReviewRecord,
      catalogItems: catalogSeed,
    });
    report.approval = {
      status: 'approved',
      reviewer,
      activatedCount: approvalResult.modifiedCount || 0,
    };
  }

  console.log(JSON.stringify(report, null, 2));
};

run()
  .catch((error) => {
    console.error('[Question catalog sync failed]', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectMongo);

