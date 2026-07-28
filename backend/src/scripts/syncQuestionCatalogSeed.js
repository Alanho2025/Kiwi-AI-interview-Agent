import { getEnv } from '../config/env.js';
import { connectMongo, disconnectMongo } from '../db/mongo.js';
import { QUESTION_CATALOG_SEED, QUESTION_CATALOG_VERSION } from '../data/questionCatalogSeed2026_1.js';
import { approveQuestionCatalogVersion, seedQuestionCatalog } from '../services/questions/questionCatalogRepository.js';

const shouldApprove = process.argv.includes('--approve');

const run = async () => {
  await connectMongo();
  const seedResult = await seedQuestionCatalog();
  const report = {
    catalogVersion: QUESTION_CATALOG_VERSION,
    seedItemCount: QUESTION_CATALOG_SEED.length,
    insertedCount: seedResult.upsertedCount || 0,
    retainedCount: seedResult.matchedCount || 0,
    approval: 'not_requested',
  };

  if (shouldApprove) {
    const reviewer = getEnv('QUESTION_CATALOG_REVIEWER');
    const approvalResult = await approveQuestionCatalogVersion({ reviewer });
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
