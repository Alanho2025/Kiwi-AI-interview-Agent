import { MatchArtifactCache } from '../../db/models/matchArtifactCacheModel.js';
import { CvArtifactCache } from '../../db/models/cvArtifactCacheModel.js';
import { JdArtifactCache } from '../../db/models/jdArtifactCacheModel.js';
import {
  buildCvHash,
  buildJdHash,
  buildMatchCacheKey,
  buildMatchSettingsHash,
} from '../../utils/cacheHash.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MATCH_CACHE_TTL_DAYS = 7;
const CV_CACHE_TTL_DAYS = 7;
const JD_CACHE_TTL_DAYS = 30;

const nowPlusDays = (days) => new Date(Date.now() + days * DAY_MS);

const isCacheDisabled = (settings = {}) => settings.disableMatchCache === true || process.env.DISABLE_MATCH_ARTIFACT_CACHE === 'true';

export const buildMatchArtifactCacheIdentity = ({ userId = '', cvInput = {}, rawJD = '', jdRubric = null, settings = {} } = {}) => {
  const cvHash = buildCvHash(cvInput);
  const jdHash = buildJdHash({ rawJD, jdRubric });
  const settingsHash = buildMatchSettingsHash(settings);
  const cacheKey = buildMatchCacheKey({ userId, cvHash, jdHash, settingsHash });
  return { cacheKey, cvHash, jdHash, settingsHash };
};

export const readMatchArtifactCache = async ({ userId = '', cacheKey = '', settings = {} } = {}) => {
  if (!userId || !cacheKey || isCacheDisabled(settings)) return null;
  const cached = await MatchArtifactCache.findOne({
    userId,
    cacheKey,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!cached?.matchResult || Object.keys(cached.matchResult).length === 0) return null;
  await MatchArtifactCache.updateOne({ _id: cached._id }, { $set: { lastUsedAt: new Date() } });
  return {
    ...cached.matchResult,
    cache: {
      hit: true,
      source: 'match_artifact_cache',
      cacheKey,
      cachedAt: cached.createdAt,
      expiresAt: cached.expiresAt,
    },
  };
};

export const writeMatchArtifactCache = async ({
  userId = '',
  identity = {},
  matchResult = {},
  settings = {},
} = {}) => {
  if (!userId || !identity.cacheKey || isCacheDisabled(settings)) return null;
  await MatchArtifactCache.findOneAndUpdate(
    { cacheKey: identity.cacheKey, userId },
    {
      $set: {
        userId,
        cacheKey: identity.cacheKey,
        cvHash: identity.cvHash,
        jdHash: identity.jdHash,
        settingsHash: identity.settingsHash,
        matchResult: {
          ...matchResult,
          cache: {
            ...(matchResult.cache || {}),
            hit: false,
            stored: true,
            source: 'fresh_match_then_cached',
          },
        },
        cacheMeta: {
          matchEngine: settings.matchEngine || process.env.MATCH_ENGINE || 'default',
          source: 'cv_jd_match',
          ttlDays: MATCH_CACHE_TTL_DAYS,
        },
        lastUsedAt: new Date(),
        expiresAt: nowPlusDays(MATCH_CACHE_TTL_DAYS),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return true;
};

export const warmCvArtifactCache = async ({ userId = '', cvHash = '', cvInput = {}, matchResult = {}, settings = {} } = {}) => {
  if (!userId || !cvHash || isCacheDisabled(settings)) return null;
  const parsedCvProfile = matchResult.parsedCvProfile || cvInput.cvProfile || {};
  const cvEvidenceProfile = matchResult.cvEvidenceProfile || parsedCvProfile.evidenceProfile || cvInput.evidenceProfile || {};
  const cvAnalysis = matchResult.cvAnalysis || parsedCvProfile.cvAnalysis || {};
  await CvArtifactCache.findOneAndUpdate(
    { userId, cvHash },
    {
      $set: {
        userId,
        cvHash,
        parsedCvProfile,
        cvEvidenceProfile,
        cvAnalysis,
        artifactMeta: {
          parserVersion: settings.parserVersion || 'v1',
          evidenceProfileVersion: settings.evidenceProfileVersion || 'v1',
        },
        lastUsedAt: new Date(),
        expiresAt: nowPlusDays(CV_CACHE_TTL_DAYS),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return true;
};

export const warmJdArtifactCache = async ({ userId = '', jdHash = '', rawJD = '', jdRubric = null, matchResult = {}, settings = {} } = {}) => {
  if (!userId || !jdHash || isCacheDisabled(settings)) return null;
  const normalizedJdRubric = matchResult.parsedJdProfile || jdRubric || {};
  const universalRoleProfile = normalizedJdRubric.universalRoleProfile || normalizedJdRubric.metadata?.universalRoleProfile || {};
  await JdArtifactCache.findOneAndUpdate(
    { userId, jdHash },
    {
      $set: {
        userId,
        jdHash,
        title: normalizedJdRubric.title || normalizedJdRubric.jobTitle || matchResult.jobTitle || '',
        company: normalizedJdRubric.company || normalizedJdRubric.companyName || '',
        sourceUrl: settings.jdSourceUrl || normalizedJdRubric.sourceUrl || '',
        rawTextPreview: String(rawJD || '').slice(0, 500),
        normalizedJdRubric,
        universalRoleProfile,
        requirements: normalizedJdRubric.requirements || [],
        interviewTargets: normalizedJdRubric.interviewTargets || {},
        artifactMeta: {
          jdParserVersion: settings.jdParserVersion || settings.parserVersion || 'v1',
          rubricVersion: settings.rubricVersion || 'v1',
        },
        lastUsedAt: new Date(),
        expiresAt: nowPlusDays(JD_CACHE_TTL_DAYS),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return true;
};

export const warmReusableArtifactCaches = async ({ userId = '', identity = {}, cvInput = {}, rawJD = '', jdRubric = null, matchResult = {}, settings = {} } = {}) => {
  await Promise.allSettled([
    warmCvArtifactCache({ userId, cvHash: identity.cvHash, cvInput, matchResult, settings }),
    warmJdArtifactCache({ userId, jdHash: identity.jdHash, rawJD, jdRubric, matchResult, settings }),
  ]);
};
