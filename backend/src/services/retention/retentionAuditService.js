import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  RETENTION_AUDIT_ROOT,
  RETENTION_DAYS,
  RETENTION_SMOKE_CASES_PER_LABEL,
  UPLOADS_ROOT,
} from '../../config/retentionConfig.js';
import {
  buildHashedIdentity,
  buildRetentionCutoff,
  isExpiredAtCutoff,
  selectFixedSmokeBenchmarkCases,
} from './retentionPolicy.js';
import { encryptCandidateManifest } from './retentionManifestService.js';

const ATLAS_LIMIT_BYTES = 512 * 1024 * 1024;
const RUNTIME_COLLECTIONS = new Set([
  'ailogs', 'aiusageevents', 'companyvaluesprofiles', 'cvartifactcaches',
  'cvquestionseeds', 'documentcontents', 'interviewplans',
  'interviewquestionpoolitems', 'jdartifactcaches', 'jdquestionfilters',
  'matchanalysisrecords', 'matchartifactcaches', 'sessionanalyses',
  'sessionfeedbackdetails', 'sessionreports', 'sessiontranscripts',
  'tokenusages', 'usercoachingmemories',
]);
const BENCHMARK_COLLECTIONS = new Set([
  'evaluationgroundtruths', 'normalizedcvprofiles', 'normalizedjdrubrics', 'ragbenchmarkcases',
]);

const runIdFromDate = (date) => date.toISOString().replace(/[:.]/g, '-');
const formatBytes = (value) => `${(Number(value || 0) / (1024 * 1024)).toFixed(2)} MiB`;
const checksumHashes = (hashes) => crypto.createHash('sha256').update([...hashes].sort().join('\n')).digest('hex');

export const buildMongoGlobalKnowledgeSummary = (documents = []) => {
  const hashes = documents
    .filter((document) => !document.sessionId)
    .map((document) => buildHashedIdentity({
      store: 'mongo',
      source: 'documentchunks:global',
      id: document._id,
      updatedAt: document.updatedAt,
    }));
  return { count: hashes.length, checksum: checksumHashes(hashes) };
};

const inventoryFiles = async (root, cutoff) => {
  const result = { fileCount: 0, totalBytes: 0, olderThanCutoffCount: 0, olderThanCutoffBytes: 0 };
  const walk = async (directory) => {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(absolutePath);
        result.fileCount += 1;
        result.totalBytes += stat.size;
        if (stat.mtime <= cutoff) {
          result.olderThanCutoffCount += 1;
          result.olderThanCutoffBytes += stat.size;
        }
      }
    }
  };
  await walk(root);
  return result;
};

const loadCollectionStats = async (mongoDb, collectionName) => {
  try {
    const result = await mongoDb.command({ collStats: collectionName, scale: 1 });
    return {
      dataBytes: Number(result.size || 0),
      storageBytes: Number(result.storageSize || 0),
      indexBytes: Number(result.totalIndexSize || 0),
    };
  } catch (error) {
    return { statsError: error.message };
  }
};

const loadSmokeCaseIds = async (mongoDb) => {
  const cases = await mongoDb.collection('ragbenchmarkcases')
    .find({}, { projection: { _id: 0, caseId: 1, label: 1 } })
    .toArray();
  const selected = selectFixedSmokeBenchmarkCases(cases, {
    casesPerLabel: RETENTION_SMOKE_CASES_PER_LABEL,
  });
  if (selected.length !== 40) {
    throw new Error(`Expected 40 protected smoke benchmark cases but selected ${selected.length}`);
  }
  return new Set(selected.map((item) => item.caseId));
};

export const classifyMongoDocument = ({ collectionName, document, cutoff, smokeCaseIds, expiredSessionIds }) => {
  if (RUNTIME_COLLECTIONS.has(collectionName)) {
    return isExpiredAtCutoff(document.updatedAt, cutoff)
      ? 'expired_runtime_document'
      : null;
  }
  if (BENCHMARK_COLLECTIONS.has(collectionName)) {
    return document.caseId && !smokeCaseIds.has(document.caseId)
      ? 'outside_fixed_40_case_smoke_sample'
      : null;
  }
  if (collectionName === 'documentchunks') {
    if (!document.sessionId) return null;
    return expiredSessionIds.has(String(document.sessionId))
      ? 'expired_session_legacy_mirror'
      : null;
  }
  return null;
};

const inventoryMongo = async ({ mongoDb, cutoff, smokeCaseIds, expiredSessionIds }) => {
  const names = (await mongoDb.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => item.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();
  const candidates = [];
  const protectedByCollection = {};
  const collections = [];
  let globalKnowledge = buildMongoGlobalKnowledgeSummary();

  for (const collectionName of names) {
    const collection = mongoDb.collection(collectionName);
    const documents = await collection.find({}, {
      projection: { _id: 1, caseId: 1, sessionId: 1, fileId: 1, updatedAt: 1 },
    }).toArray();
    const stats = await loadCollectionStats(mongoDb, collectionName);
    if (collectionName === 'documentchunks') {
      globalKnowledge = buildMongoGlobalKnowledgeSummary(documents);
    }
    const candidateStartIndex = candidates.length;
    const protectedHashes = [];
    let expiredTimestampCount = 0;
    let invalidTimestampCount = 0;

    for (const document of documents) {
      if (!document.updatedAt || Number.isNaN(new Date(document.updatedAt).getTime())) {
        invalidTimestampCount += 1;
      } else if (isExpiredAtCutoff(document.updatedAt, cutoff)) {
        expiredTimestampCount += 1;
      }
      const reason = classifyMongoDocument({
        collectionName,
        document,
        cutoff,
        smokeCaseIds,
        expiredSessionIds,
      });
      if (reason && document.updatedAt && !Number.isNaN(new Date(document.updatedAt).getTime())) {
        candidates.push({
          collection: collectionName,
          id: String(document._id),
          updatedAt: new Date(document.updatedAt).toISOString(),
          sessionId: document.sessionId ? String(document.sessionId) : null,
          fileId: document.fileId ? String(document.fileId) : null,
          caseId: document.caseId || null,
          reason,
        });
      } else {
        protectedHashes.push(buildHashedIdentity({
          store: 'mongo', source: collectionName, id: document._id, updatedAt: document.updatedAt,
        }));
      }
    }
    const averageDocumentBytes = documents.length ? Number(stats.dataBytes || 0) / documents.length : 0;
    for (const candidate of candidates.slice(candidateStartIndex)) {
      candidate.estimatedBytes = Math.ceil(averageDocumentBytes);
    }
    protectedByCollection[collectionName] = {
      count: protectedHashes.length,
      checksum: checksumHashes(protectedHashes),
    };
    collections.push({
      collection: collectionName,
      count: documents.length,
      candidateCount: candidates.filter((item) => item.collection === collectionName).length,
      protectedCount: protectedHashes.length,
      expiredTimestampCount,
      invalidTimestampCount,
      ...stats,
    });
  }
  return { candidates, protectedByCollection, collections, globalKnowledge };
};

const inventoryPostgres = async ({ postgresQuery, cutoff, uploadsRoot }) => {
  const timestampColumnResult = await postgresQuery(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'uploaded_files'
        AND column_name = 'updated_at'
    ) AS exists
  `);
  const uploadedFileUpdatedAtAvailable = Boolean(timestampColumnResult.rows[0]?.exists);
  const [
    databaseSize,
    tables,
    sessions,
    chunks,
    identities,
    sessionFiles,
    sessionRecordings,
    uploadedFileTimestampReview,
  ] = await Promise.all([
    postgresQuery('SELECT pg_database_size(current_database())::bigint AS bytes'),
    postgresQuery(`
      SELECT relname AS table_name,
             pg_total_relation_size(relid)::bigint AS total_bytes,
             pg_relation_size(relid)::bigint AS table_bytes,
             pg_indexes_size(relid)::bigint AS index_bytes,
             n_live_tup::bigint AS estimated_rows
      FROM pg_catalog.pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `),
    postgresQuery(
      `SELECT id, updated_at FROM interview_sessions
       WHERE updated_at <= $1 ORDER BY updated_at ASC`,
      [cutoff.toISOString()],
    ),
    postgresQuery(`
      SELECT id, session_id, source_type, created_at
      FROM document_chunks
    `),
    postgresQuery(`
      SELECT 'users' AS source, id::text AS id, updated_at AS timestamp FROM users
      UNION ALL
      SELECT 'user_consents' AS source, id::text AS id, captured_at AS timestamp FROM user_consents
    `),
    postgresQuery(
      `SELECT files.session_id AS resource_id, files.storage_provider, files.storage_key
       FROM uploaded_files files
       INNER JOIN interview_sessions sessions ON sessions.id = files.session_id
       WHERE sessions.updated_at <= $1 AND files.deleted_at IS NULL`,
      [cutoff.toISOString()],
    ),
    postgresQuery(
      `SELECT responses.session_id AS resource_id, responses.audio_storage_key AS storage_key
       FROM interview_responses responses
       INNER JOIN interview_sessions sessions ON sessions.id = responses.session_id
       WHERE sessions.updated_at <= $1 AND responses.audio_storage_key IS NOT NULL`,
      [cutoff.toISOString()],
    ),
    uploadedFileUpdatedAtAvailable
      ? postgresQuery(`
          SELECT COUNT(*)::bigint AS count
          FROM uploaded_files
          WHERE updated_at IS NULL AND deleted_at IS NULL
        `)
      : postgresQuery(`
          SELECT COUNT(*)::bigint AS count
          FROM uploaded_files
          WHERE deleted_at IS NULL
        `),
  ]);
  const expiredSessionIds = new Set(sessions.rows.map((row) => String(row.id)));
  const globalKnowledgeHashes = [];
  const protectedIdentityHashes = identities.rows.map((row) => buildHashedIdentity({
    store: 'postgres', source: row.source, id: row.id, updatedAt: row.timestamp,
  }));
  let expiredSessionChunkCount = 0;
  let protectedSessionChunkCount = 0;
  const filePathsByResourceId = {};
  const addFilePath = (resourceId, storageKey) => {
    if (!resourceId || !storageKey) return;
    const key = String(resourceId);
    const paths = filePathsByResourceId[key] || [];
    paths.push(path.join(uploadsRoot, storageKey));
    filePathsByResourceId[key] = paths;
  };
  for (const row of sessionFiles.rows) {
    if (row.storage_provider === 'local') addFilePath(row.resource_id, row.storage_key);
  }
  for (const row of sessionRecordings.rows) addFilePath(row.resource_id, row.storage_key);
  for (const row of chunks.rows) {
    if (!row.session_id) {
      globalKnowledgeHashes.push(buildHashedIdentity({
        store: 'postgres', source: `global:${row.source_type}`, id: row.id, updatedAt: row.created_at,
      }));
    } else if (expiredSessionIds.has(String(row.session_id))) {
      expiredSessionChunkCount += 1;
    } else {
      protectedSessionChunkCount += 1;
    }
  }
  return {
    databaseBytes: Number(databaseSize.rows[0]?.bytes || 0),
    tables: tables.rows.map((row) => ({
      table: row.table_name,
      totalBytes: Number(row.total_bytes),
      tableBytes: Number(row.table_bytes),
      indexBytes: Number(row.index_bytes),
      estimatedRows: Number(row.estimated_rows),
    })),
    candidates: sessions.rows.map((row) => ({
      table: 'interview_sessions',
      id: String(row.id),
      updatedAt: row.updated_at.toISOString(),
      reason: 'expired_session',
    })),
    expiredSessionIds,
    globalKnowledge: {
      count: globalKnowledgeHashes.length,
      checksum: checksumHashes(globalKnowledgeHashes),
    },
    protectedIdentities: {
      count: protectedIdentityHashes.length,
      checksum: checksumHashes(protectedIdentityHashes),
    },
    expiredSessionChunkCount,
    protectedSessionChunkCount,
    filePathsByResourceId,
    uploadedFileMissingTimestampCount: Number(uploadedFileTimestampReview.rows[0]?.count || 0),
    uploadedFileUpdatedAtAvailable,
  };
};

const loadExpiredCvFileCandidates = async ({
  postgresQuery,
  mongoCandidates,
  uploadsRoot,
  cutoff,
  updatedAtAvailable,
}) => {
  const documentCandidates = mongoCandidates.filter((item) => item.collection === 'documentcontents' && item.fileId);
  if (!documentCandidates.length || !updatedAtAvailable) return { candidates: [], filePaths: {} };
  const documentByFileId = new Map(documentCandidates.map((item) => [item.fileId, item]));
  const result = await postgresQuery(
    `SELECT id, storage_provider, storage_key, file_size_bytes, updated_at
     FROM uploaded_files
     WHERE id = ANY($1::uuid[])
       AND updated_at <= $2
       AND deleted_at IS NULL`,
    [[...documentByFileId.keys()], cutoff.toISOString()],
  );
  const filePaths = {};
  const candidates = result.rows.map((row) => {
    if (row.storage_provider === 'local' && row.storage_key) {
      filePaths[String(row.id)] = [path.join(uploadsRoot, row.storage_key)];
    }
    return {
      table: 'uploaded_files',
      id: String(row.id),
      updatedAt: row.updated_at.toISOString(),
      sourceCollection: 'documentcontents',
      sourceId: documentByFileId.get(String(row.id))?.id || null,
      estimatedBytes: Number(row.file_size_bytes || 0),
      reason: 'expired_cv_document',
    };
  });
  return { candidates, filePaths };
};

const renderSummary = ({ runId, cutoff, dbStats, mongo, postgres, files, keyPath }) => {
  const logicalBytes = Number(dbStats.dataSize || 0) + Number(dbStats.indexSize || 0);
  const collectionRows = mongo.collections.map((item) =>
    `| ${item.collection} | ${item.count} | ${item.candidateCount} | ${item.protectedCount} | ${item.invalidTimestampCount} | ${formatBytes(item.dataBytes)} | ${formatBytes(item.indexBytes)} |`).join('\n');
  const tableRows = postgres.tables.map((item) =>
    `| ${item.table} | ${item.estimatedRows} | ${formatBytes(item.tableBytes)} | ${formatBytes(item.indexBytes)} | ${formatBytes(item.totalBytes)} |`).join('\n');
  return `# Retention Preflight ${runId}\n\n` +
    `- Fixed cutoff: ${cutoff.toISOString()}\n` +
    `- Encrypted candidate key: ${keyPath}\n` +
    `- Missing or invalid timestamps are protected and require manual review.\n` +
    `- Every PostgreSQL document_chunk with session_id IS NULL is protected global knowledge.\n\n` +
    `## Atlas\n\n` +
    `- dataSize: ${formatBytes(dbStats.dataSize)}\n` +
    `- indexSize: ${formatBytes(dbStats.indexSize)}\n` +
    `- logical usage: ${formatBytes(logicalBytes)} / 512 MiB (${((logicalBytes / ATLAS_LIMIT_BYTES) * 100).toFixed(2)}%)\n` +
    `- candidates: ${mongo.candidates.length}\n\n` +
    `- protected Mongo global knowledge: ${mongo.globalKnowledge.count}\n\n` +
    `| Collection | Total | Candidates | Protected | Invalid timestamp | Data | Index |\n|---|---:|---:|---:|---:|---:|---:|\n${collectionRows}\n\n` +
    `## PostgreSQL\n\n` +
    `- database size: ${formatBytes(postgres.databaseBytes)}\n` +
    `- expired sessions: ${postgres.candidates.filter((item) => item.table === 'interview_sessions').length}\n` +
    `- expired session chunks: ${postgres.expiredSessionChunkCount}\n` +
    `- protected session chunks: ${postgres.protectedSessionChunkCount}\n` +
    `- protected global knowledge: ${postgres.globalKnowledge.count}\n\n` +
    `- uploaded files missing updated_at (manual review): ${postgres.uploadedFileMissingTimestampCount}\n\n` +
    `| Table | Rows | Table | Index | Total |\n|---|---:|---:|---:|---:|\n${tableRows}\n\n` +
    `## Local files\n\n` +
    `- files: ${files.fileCount}\n- total: ${formatBytes(files.totalBytes)}\n` +
    `- older than cutoff by mtime only: ${files.olderThanCutoffCount} / ${formatBytes(files.olderThanCutoffBytes)}\n`;
};

export const generateRetentionAudit = async ({
  mongoDb,
  postgresQuery,
  now = new Date(),
  auditRoot = RETENTION_AUDIT_ROOT,
  uploadsRoot = UPLOADS_ROOT,
  keyRoot = path.join('/private/tmp', 'kiwi-retention-audit-keys'),
} = {}) => {
  const runId = runIdFromDate(now);
  const cutoff = buildRetentionCutoff(now, RETENTION_DAYS);
  const outputDirectory = path.join(auditRoot, runId);
  const keyPath = path.join(keyRoot, `${runId}.key`);
  await Promise.all([
    fs.mkdir(outputDirectory, { recursive: true }),
    fs.mkdir(keyRoot, { recursive: true }),
  ]);
  const [dbStats, smokeCaseIds, postgres, files] = await Promise.all([
    mongoDb.command({ dbStats: 1, scale: 1 }),
    loadSmokeCaseIds(mongoDb),
    inventoryPostgres({ postgresQuery, cutoff, uploadsRoot }),
    inventoryFiles(uploadsRoot, cutoff),
  ]);
  const mongo = await inventoryMongo({
    mongoDb,
    cutoff,
    smokeCaseIds,
    expiredSessionIds: postgres.expiredSessionIds,
  });
  const expiredCvFiles = await loadExpiredCvFileCandidates({
    postgresQuery,
    mongoCandidates: mongo.candidates,
    uploadsRoot,
    cutoff,
    updatedAtAvailable: postgres.uploadedFileUpdatedAtAvailable,
  });
  postgres.candidates.push(...expiredCvFiles.candidates);
  const candidateManifest = {
    runId,
    cutoff: cutoff.toISOString(),
    retentionDays: RETENTION_DAYS,
    mongo: mongo.candidates,
    postgres: postgres.candidates,
    fixedSmokeCaseIds: [...smokeCaseIds].sort(),
    filePathsByResourceId: {
      ...postgres.filePathsByResourceId,
      ...expiredCvFiles.filePaths,
    },
  };
  const protectedManifest = {
    runId,
    cutoff: cutoff.toISOString(),
    mongo: mongo.protectedByCollection,
    mongoGlobalKnowledge: mongo.globalKnowledge,
    postgres: {
      identities: postgres.protectedIdentities,
      globalKnowledge: postgres.globalKnowledge,
      uploadedFileMissingTimestampCount: postgres.uploadedFileMissingTimestampCount,
      protectedSessionChunkCount: postgres.protectedSessionChunkCount,
    },
    fixedSmokeCaseIds: [...smokeCaseIds].sort(),
  };
  const expiredSummary = {
    runId,
    cutoff: cutoff.toISOString(),
    mongo: mongo.collections,
    postgres: {
      databaseBytes: postgres.databaseBytes,
      tables: postgres.tables,
      expiredSessionCount: postgres.candidates.filter((item) => item.table === 'interview_sessions').length,
      expiredUploadedFileCount: postgres.candidates.filter((item) => item.table === 'uploaded_files').length,
      expiredSessionChunkCount: postgres.expiredSessionChunkCount,
      protectedSessionChunkCount: postgres.protectedSessionChunkCount,
      globalKnowledge: postgres.globalKnowledge,
    },
    localFiles: files,
  };
  const key = crypto.randomBytes(32);
  const encryptedManifest = encryptCandidateManifest(candidateManifest, key);
  await fs.writeFile(keyPath, key.toString('hex'), { mode: 0o600 });
  await Promise.all([
    fs.writeFile(path.join(outputDirectory, 'candidate-manifest.json.enc'), JSON.stringify(encryptedManifest, null, 2), { mode: 0o600 }),
    fs.writeFile(path.join(outputDirectory, 'protected-manifest.json'), JSON.stringify(protectedManifest, null, 2)),
    fs.writeFile(path.join(outputDirectory, 'expired-summary.json'), JSON.stringify(expiredSummary, null, 2)),
    fs.writeFile(path.join(outputDirectory, 'preflight-summary.md'), renderSummary({
      runId, cutoff, dbStats, mongo, postgres, files, keyPath,
    })),
  ]);
  return {
    runId,
    outputDirectory,
    keyPath,
    cutoff: cutoff.toISOString(),
    atlasLogicalBytes: Number(dbStats.dataSize || 0) + Number(dbStats.indexSize || 0),
    mongoCandidateCount: mongo.candidates.length,
    postgresCandidateCount: postgres.candidates.length,
    globalKnowledgeCount: postgres.globalKnowledge.count,
    mongoGlobalKnowledgeCount: mongo.globalKnowledge.count,
  };
};
