import { NZ_COMPANY_DIRECTORY, NZ_COMPANY_DIRECTORY_VERSION } from '../../../data/nzCompanyDirectory.js';

const NORMALIZER_PATTERN = /[^a-z0-9]+/g;
const COMMON_SUFFIX_PATTERN = /\b(?:limited|ltd|company|co|group|holdings|corporation|corp|inc|new zealand|nz)\b/g;

const normalizeName = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(NORMALIZER_PATTERN, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeLoose = (value = '') => normalizeName(value)
  .replace(COMMON_SUFFIX_PATTERN, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const uniq = (items = []) => [...new Set(items.filter(Boolean))];

const buildDirectoryRecords = () => NZ_COMPANY_DIRECTORY.flatMap((entry) => {
  const names = uniq([entry.canonicalName, ...(entry.aliases || [])]);
  return names.map((name) => ({
    ...entry,
    matchName: name,
    normalized: normalizeName(name),
    loose: normalizeLoose(name),
  }));
});

const DIRECTORY_RECORDS = buildDirectoryRecords();
const DIRECTORY_BY_NORMALIZED = new Map(DIRECTORY_RECORDS.map((record) => [record.normalized, record]));
const DIRECTORY_BY_LOOSE = new Map(DIRECTORY_RECORDS.filter((record) => record.loose.length >= 3).map((record) => [record.loose, record]));

const escapeRegex = (value = '') => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildBoundaryPattern = (name = '') => {
  const escaped = escapeRegex(name).replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, 'i');
};

const RISKY_BODY_ALIAS_SET = new Set([
  'spark', 'contact', 'vector', 'genesis', 'mercury', 'meridian', 'vista',
  'jade', 'tower', 'vend', 'halter', 'partly', 'figured', 'kami', 'at', 'ep',
]);

const isSafeBodyMatchName = (record) => {
  const normalized = normalizeName(record.matchName);
  if (record.matchName === record.canonicalName && normalized.split(' ').length >= 2) return true;
  if (normalized.length >= 8 && normalized.split(' ').length >= 2) return true;
  if (RISKY_BODY_ALIAS_SET.has(normalized)) return false;
  return normalized.length >= 5 && /[a-z]/i.test(record.matchName);
};

const makeResult = ({ record, source, score, evidence = '' }) => ({
  value: record.canonicalName,
  canonicalName: record.canonicalName,
  matchedName: record.matchName,
  source,
  score,
  evidence: evidence || record.matchName,
  category: record.category,
  directorySource: record.source,
  directoryVersion: NZ_COMPANY_DIRECTORY_VERSION,
});

export const matchCompanyCandidateToDirectory = (candidate = '') => {
  const normalized = normalizeName(candidate);
  const loose = normalizeLoose(candidate);
  if (!normalized) return null;

  const exact = DIRECTORY_BY_NORMALIZED.get(normalized);
  if (exact) return makeResult({ record: exact, source: 'company_directory_exact', score: 0.99, evidence: candidate });

  const looseMatch = DIRECTORY_BY_LOOSE.get(loose);
  if (looseMatch) return makeResult({ record: looseMatch, source: 'company_directory_alias', score: 0.96, evidence: candidate });

  return null;
};

export const matchCompanyInText = (rawText = '') => {
  const text = String(rawText || '');
  if (!text.trim()) return null;

  const orderedRecords = [...DIRECTORY_RECORDS]
    .filter((record) => record.matchName.length >= 3 && isSafeBodyMatchName(record))
    .sort((a, b) => b.matchName.length - a.matchName.length);

  for (const record of orderedRecords) {
    const pattern = buildBoundaryPattern(record.matchName);
    const match = text.match(pattern);
    if (!match) continue;
    const evidence = match[2];
    const score = record.matchName === record.canonicalName ? 0.94 : 0.92;
    return makeResult({ record, source: 'company_directory_text_match', score, evidence });
  }

  return null;
};

export const getNzCompanyDirectoryStats = () => ({
  version: NZ_COMPANY_DIRECTORY_VERSION,
  companyCount: NZ_COMPANY_DIRECTORY.length,
  searchableNameCount: DIRECTORY_RECORDS.length,
});
