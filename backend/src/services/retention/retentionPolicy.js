import crypto from 'crypto';

export const DEFAULT_RETENTION_DAYS = 7;
export const SMOKE_BENCHMARK_LABELS = ['empty', 'invalid', 'match', 'mismatch'];

const toValidDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hashText = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export const buildRetentionCutoff = (now = new Date(), retentionDays = DEFAULT_RETENTION_DAYS) =>
  new Date(toValidDate(now).getTime() - retentionDays * 24 * 60 * 60 * 1000);

export const buildRetentionExpiry = (now = new Date(), retentionDays = DEFAULT_RETENTION_DAYS) =>
  new Date(toValidDate(now).getTime() + retentionDays * 24 * 60 * 60 * 1000);

export const isExpiredAtCutoff = (updatedAt, cutoff) => {
  const updatedDate = toValidDate(updatedAt);
  const cutoffDate = toValidDate(cutoff);
  return Boolean(updatedDate && cutoffDate && updatedDate.getTime() <= cutoffDate.getTime());
};

export const partitionDocumentsByRetention = (documents = [], cutoff) => {
  const result = { expired: [], protected: [], manualReview: [] };
  for (const document of documents) {
    const updatedAt = toValidDate(document?.updatedAt);
    if (!updatedAt) {
      result.manualReview.push(document);
    } else if (isExpiredAtCutoff(updatedAt, cutoff)) {
      result.expired.push(document);
    } else {
      result.protected.push(document);
    }
  }
  return result;
};

export const selectFixedSmokeBenchmarkCases = (
  benchmarkCases = [],
  { casesPerLabel = 10, labels = SMOKE_BENCHMARK_LABELS } = {},
) => labels.flatMap((label) => benchmarkCases
  .filter((item) => item?.label === label && item?.caseId)
  .sort((left, right) => hashText(left.caseId).localeCompare(hashText(right.caseId)))
  .slice(0, casesPerLabel));

export const snapshotMatchesCandidate = (candidate = {}, current = {}) => {
  const candidateDate = toValidDate(candidate.updatedAt);
  const currentDate = toValidDate(current.updatedAt);
  return String(candidate.id) === String(current._id ?? current.id)
    && Boolean(candidateDate && currentDate)
    && candidateDate.getTime() === currentDate.getTime();
};

export const partitionDocumentChunksByScope = (chunks = [], expiredSessionIds = new Set()) => {
  const result = { protectedGlobal: [], expiredSession: [], protectedSession: [] };
  for (const chunk of chunks) {
    const sessionId = chunk.sessionId ?? chunk.session_id ?? null;
    if (!sessionId) {
      result.protectedGlobal.push(chunk);
    } else if (expiredSessionIds.has(String(sessionId))) {
      result.expiredSession.push(chunk);
    } else {
      result.protectedSession.push(chunk);
    }
  }
  return result;
};

export const buildHashedIdentity = ({ store, source, id, updatedAt = '' } = {}) =>
  hashText(`${store}:${source}:${id}:${toValidDate(updatedAt)?.toISOString() || ''}`);
