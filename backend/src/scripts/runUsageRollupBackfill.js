import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongo, disconnectMongo } from '../db/mongo.js';
import { AiUsageEvent } from '../db/models/aiUsageEventModel.js';
import { TokenUsage } from '../db/models/tokenUsageModel.js';
import { UsageDailyRollup } from '../db/models/usageDailyRollupModel.js';
import {
  AI_USAGE_ROLLUP_SOURCE,
  TOKEN_USAGE_ROLLUP_SOURCE,
  buildUsageRollupBackfillPlan,
  verifyUsageRollupBackfill,
} from '../services/usageRollupService.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const reportRoot = path.join(backendRoot, 'tmp', 'retention-audit');
const hashId = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const groupByUser = (items) => {
  const groups = new Map();
  for (const item of items) {
    const userId = String(item.userId);
    const group = groups.get(userId) || [];
    group.push(item);
    groups.set(userId, group);
  }
  return groups;
};

const persistUnverifiedPlan = async (plan) => {
  if (!plan.length) return;
  await UsageDailyRollup.bulkWrite(plan.map((rollup) => ({
    replaceOne: {
      filter: { userId: rollup.userId, source: rollup.source, day: rollup.day },
      replacement: { ...rollup, verifiedAt: null },
      upsert: true,
    },
  })), { ordered: true });
};

const verifySource = async ({ events, source }) => {
  const eventGroups = groupByUser(events);
  const results = [];
  for (const [userId, userEvents] of eventGroups) {
    const rollups = await UsageDailyRollup.find({ userId, source }).sort({ day: 1 }).lean();
    const verification = verifyUsageRollupBackfill({ events: userEvents, rollups, source });
    results.push({ userId, ...verification });
  }
  return results;
};

const markVerified = async (plan) => {
  const verifiedAt = new Date();
  await UsageDailyRollup.bulkWrite(plan.map((rollup) => ({
    updateOne: {
      filter: {
        userId: rollup.userId,
        source: rollup.source,
        day: rollup.day,
        sourceChecksum: rollup.sourceChecksum,
      },
      update: { $set: { verifiedAt } },
    },
  })), { ordered: true });
  return verifiedAt;
};

const createReport = ({ runId, aiEvents, tokenEvents, plan, verifications, verifiedAt }) => ({
  runId,
  completedAt: new Date().toISOString(),
  verifiedAt: verifiedAt?.toISOString() || null,
  verified: verifications.every((item) => item.verified),
  rawCounts: {
    aiusageevents: aiEvents.length,
    tokenusages: tokenEvents.length,
  },
  rollupCount: plan.length,
  users: verifications.map(({ userId, ...verification }) => ({
    userIdHash: hashId(userId),
    ...verification,
  })),
});

const run = async () => {
  const runId = `usage-rollup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await connectMongo();

  const existingVerified = await UsageDailyRollup.countDocuments({ verifiedAt: { $type: 'date' } });
  if (existingVerified > 0) {
    throw new Error('Verified usage rollups already exist; initial backfill refuses to overwrite lifetime history');
  }

  const [aiEvents, tokenEvents] = await Promise.all([
    AiUsageEvent.find({}).sort({ createdAt: 1 }).lean(),
    TokenUsage.find({}).sort({ createdAt: 1 }).lean(),
  ]);
  const plan = buildUsageRollupBackfillPlan({ aiEvents, tokenEvents });
  await persistUnverifiedPlan(plan);

  const verifications = [
    ...await verifySource({ events: aiEvents, source: AI_USAGE_ROLLUP_SOURCE }),
    ...await verifySource({ events: tokenEvents, source: TOKEN_USAGE_ROLLUP_SOURCE }),
  ];
  const allVerified = verifications.every((item) => item.verified);
  const verifiedAt = allVerified ? await markVerified(plan) : null;
  const report = createReport({ runId, aiEvents, tokenEvents, plan, verifications, verifiedAt });

  await fs.mkdir(reportRoot, { recursive: true });
  const reportPath = path.join(reportRoot, `${runId}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ runId, reportPath, ...report.rawCounts, rollupCount: plan.length, verified: report.verified }, null, 2));
  if (!report.verified) throw new Error(`Usage rollup verification failed; inspect ${reportPath}`);
};

run()
  .catch((error) => {
    console.error('[Usage rollup backfill failed]', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectMongo);
