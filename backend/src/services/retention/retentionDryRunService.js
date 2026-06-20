import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';
import { RETENTION_AUDIT_ROOT } from '../../config/retentionConfig.js';
import { buildHashedIdentity, snapshotMatchesCandidate } from './retentionPolicy.js';
import { buildMongoGlobalKnowledgeSummary } from './retentionAuditService.js';
import { decryptCandidateManifest } from './retentionManifestService.js';

const checksumHashes = (hashes) => crypto.createHash('sha256').update([...hashes].sort().join('\n')).digest('hex');
const toMongoId = (value) => ObjectId.isValid(value) ? new ObjectId(value) : value;

const loadAuditFiles = async ({ runId, auditRoot, keyPath }) => {
  const directory = path.join(auditRoot, runId);
  const [encryptedText, protectedText, keyText] = await Promise.all([
    fs.readFile(path.join(directory, 'candidate-manifest.json.enc'), 'utf8'),
    fs.readFile(path.join(directory, 'protected-manifest.json'), 'utf8'),
    fs.readFile(keyPath, 'utf8'),
  ]);
  return {
    directory,
    candidateManifest: decryptCandidateManifest(JSON.parse(encryptedText), Buffer.from(keyText.trim(), 'hex')),
    protectedManifest: JSON.parse(protectedText),
  };
};

const groupBy = (items, key) => {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key];
    const entries = grouped.get(value) || [];
    entries.push(item);
    grouped.set(value, entries);
  }
  return grouped;
};

const summarizeCandidatesBy = (candidates, key) => Object.fromEntries(
  [...groupBy(candidates, key)].map(([name, items]) => [name, {
    count: items.length,
    estimatedBytes: items.reduce((total, item) => total + Number(item.estimatedBytes || 0), 0),
  }]),
);

export const buildCandidatePlanSummary = (manifest) => {
  const mongo = manifest.mongo || [];
  const postgres = manifest.postgres || [];
  const filePaths = Object.values(manifest.filePathsByResourceId || {}).flat();
  return {
    mongoByCollection: summarizeCandidatesBy(mongo, 'collection'),
    postgresByTable: summarizeCandidatesBy(postgres, 'table'),
    fileCount: new Set(filePaths).size,
    estimatedReleaseBytes: [...mongo, ...postgres]
      .reduce((total, item) => total + Number(item.estimatedBytes || 0), 0),
  };
};

const verifyMongoCandidates = async (mongoDb, candidates) => {
  const result = { matched: 0, missing: [], changed: [] };
  for (const [collectionName, collectionCandidates] of groupBy(candidates, 'collection')) {
    const documents = await mongoDb.collection(collectionName).find(
      { _id: { $in: collectionCandidates.map((item) => toMongoId(item.id)) } },
      { projection: { _id: 1, updatedAt: 1 } },
    ).toArray();
    const currentById = new Map(documents.map((item) => [String(item._id), item]));
    for (const candidate of collectionCandidates) {
      const current = currentById.get(String(candidate.id));
      if (!current) result.missing.push({ collection: collectionName, idHash: buildHashedIdentity({ source: collectionName, id: candidate.id }) });
      else if (!snapshotMatchesCandidate(candidate, current)) result.changed.push({ collection: collectionName, idHash: buildHashedIdentity({ source: collectionName, id: candidate.id }) });
      else result.matched += 1;
    }
  }
  return result;
};

const POSTGRES_CANDIDATE_QUERIES = Object.freeze({
  interview_sessions: 'SELECT id, updated_at FROM interview_sessions WHERE id = ANY($1::uuid[])',
  uploaded_files: 'SELECT id, updated_at FROM uploaded_files WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL',
});

export const verifyPostgresCandidates = async (postgresQuery, candidates) => {
  if (!candidates.length) return { matched: 0, missing: [], changed: [] };
  const verification = { matched: 0, missing: [], changed: [] };
  for (const [table, tableCandidates] of groupBy(candidates, 'table')) {
    const sql = POSTGRES_CANDIDATE_QUERIES[table];
    if (!sql) throw new Error(`Unsupported PostgreSQL retention table: ${table}`);
    const result = await postgresQuery(sql, [tableCandidates.map((item) => item.id)]);
    const currentById = new Map(result.rows.map((item) => [String(item.id), item]));
    for (const candidate of tableCandidates) {
      const current = currentById.get(String(candidate.id));
      const idHash = buildHashedIdentity({ source: candidate.table, id: candidate.id });
      if (!current) {
        verification.missing.push({ table: candidate.table, idHash });
      } else if (new Date(current.updated_at).getTime() !== new Date(candidate.updatedAt).getTime()) {
        verification.changed.push({ table: candidate.table, idHash });
      } else {
        verification.matched += 1;
      }
    }
  }
  return verification;
};

const verifyMongoProtection = async ({ mongoDb, expected, candidates }) => {
  const candidateIdsByCollection = new Map(
    [...groupBy(candidates, 'collection')].map(([name, items]) => [name, new Set(items.map((item) => String(item.id)))]),
  );
  const details = {};
  let valid = true;
  for (const [collectionName, expectation] of Object.entries(expected || {})) {
    const candidateIds = candidateIdsByCollection.get(collectionName) || new Set();
    const hashes = [];
    const cursor = mongoDb.collection(collectionName).find({}, { projection: { _id: 1, updatedAt: 1 } });
    for await (const document of cursor) {
      if (candidateIds.has(String(document._id))) continue;
      hashes.push(buildHashedIdentity({
        store: 'mongo', source: collectionName, id: document._id, updatedAt: document.updatedAt,
      }));
    }
    const actual = { count: hashes.length, checksum: checksumHashes(hashes) };
    const matches = actual.count === expectation.count && actual.checksum === expectation.checksum;
    if (!matches) valid = false;
    details[collectionName] = { expected: expectation, actual, matches };
  }
  return { valid, details };
};

const verifyPostgresProtection = async ({ postgresQuery, expected, expiredSessionIds }) => {
  const [identities, globalKnowledge, protectedSessionChunks] = await Promise.all([
    postgresQuery(`
      SELECT 'users' AS source, id::text AS id, updated_at AS timestamp FROM users
      UNION ALL
      SELECT 'user_consents' AS source, id::text AS id, captured_at AS timestamp FROM user_consents
    `),
    postgresQuery(`
      SELECT id, source_type, created_at FROM document_chunks WHERE session_id IS NULL
    `),
    expiredSessionIds.length
      ? postgresQuery(
        'SELECT COUNT(*)::bigint AS count FROM document_chunks WHERE session_id IS NOT NULL AND NOT (session_id = ANY($1::uuid[]))',
        [expiredSessionIds],
      )
      : postgresQuery('SELECT COUNT(*)::bigint AS count FROM document_chunks WHERE session_id IS NOT NULL'),
  ]);
  const identityHashes = identities.rows.map((row) => buildHashedIdentity({
    store: 'postgres', source: row.source, id: row.id, updatedAt: row.timestamp,
  }));
  const globalHashes = globalKnowledge.rows.map((row) => buildHashedIdentity({
    store: 'postgres', source: `global:${row.source_type}`, id: row.id, updatedAt: row.created_at,
  }));
  const actual = {
    identities: { count: identityHashes.length, checksum: checksumHashes(identityHashes) },
    globalKnowledge: { count: globalHashes.length, checksum: checksumHashes(globalHashes) },
    protectedSessionChunkCount: Number(protectedSessionChunks.rows[0]?.count || 0),
  };
  return {
    valid: actual.identities.count === expected.identities.count
      && actual.identities.checksum === expected.identities.checksum
      && actual.globalKnowledge.count === expected.globalKnowledge.count
      && actual.globalKnowledge.checksum === expected.globalKnowledge.checksum
      && actual.protectedSessionChunkCount === expected.protectedSessionChunkCount,
    expected,
    actual,
  };
};

const verifySmokeCases = async (mongoDb, caseIds) => {
  const collections = ['evaluationgroundtruths', 'normalizedcvprofiles', 'normalizedjdrubrics', 'ragbenchmarkcases'];
  const details = {};
  let valid = true;
  for (const collectionName of collections) {
    const count = await mongoDb.collection(collectionName).countDocuments({ caseId: { $in: caseIds } });
    const matches = count === 40;
    if (!matches) valid = false;
    details[collectionName] = { expected: 40, actual: count, matches };
  }
  return { valid, details };
};

const verifyMongoGlobalKnowledge = async (mongoDb, expected) => {
  const documents = await mongoDb.collection('documentchunks')
    .find({}, { projection: { _id: 1, sessionId: 1, updatedAt: 1 } })
    .toArray();
  const actual = buildMongoGlobalKnowledgeSummary(documents);
  return {
    valid: actual.count === expected.count && actual.checksum === expected.checksum,
    expected,
    actual,
  };
};

const renderDryRunReport = ({
  runId,
  manifest,
  mongoCandidates,
  postgresCandidates,
  mongoProtection,
  mongoGlobalKnowledge,
  postgresProtection,
  smokeCases,
}) => {
  const safeToExecute = mongoCandidates.missing.length === 0
    && mongoCandidates.changed.length === 0
    && postgresCandidates.missing.length === 0
    && postgresCandidates.changed.length === 0
    && mongoProtection.valid
    && mongoGlobalKnowledge.valid
    && postgresProtection.valid
    && smokeCases.valid;
  return {
    runId,
    generatedAt: new Date().toISOString(),
    cutoff: manifest.cutoff,
    dryRun: true,
    safeToExecute,
    planned: buildCandidatePlanSummary(manifest),
    candidates: { mongo: mongoCandidates, postgres: postgresCandidates },
    protected: {
      mongo: mongoProtection,
      mongoGlobalKnowledge,
      postgres: postgresProtection,
      smokeCases,
    },
  };
};

export const runRetentionDryRun = async ({
  runId,
  mongoDb,
  postgresQuery,
  auditRoot = RETENTION_AUDIT_ROOT,
  keyPath = path.join('/private/tmp', 'kiwi-retention-audit-keys', `${runId}.key`),
} = {}) => {
  const { directory, candidateManifest, protectedManifest } = await loadAuditFiles({ runId, auditRoot, keyPath });
  const [
    mongoCandidates,
    postgresCandidates,
    mongoProtection,
    mongoGlobalKnowledge,
    postgresProtection,
    smokeCases,
  ] = await Promise.all([
    verifyMongoCandidates(mongoDb, candidateManifest.mongo),
    verifyPostgresCandidates(postgresQuery, candidateManifest.postgres),
    verifyMongoProtection({ mongoDb, expected: protectedManifest.mongo, candidates: candidateManifest.mongo }),
    verifyMongoGlobalKnowledge(mongoDb, protectedManifest.mongoGlobalKnowledge),
    verifyPostgresProtection({
      postgresQuery,
      expected: protectedManifest.postgres,
      expiredSessionIds: candidateManifest.postgres
        .filter((item) => item.table === 'interview_sessions')
        .map((item) => item.id),
    }),
    verifySmokeCases(mongoDb, candidateManifest.fixedSmokeCaseIds),
  ]);
  const report = renderDryRunReport({
    runId,
    manifest: candidateManifest,
    mongoCandidates,
    postgresCandidates,
    mongoProtection,
    mongoGlobalKnowledge,
    postgresProtection,
    smokeCases,
  });
  const reportPath = path.join(directory, 'dry-run-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  return { ...report, reportPath };
};
