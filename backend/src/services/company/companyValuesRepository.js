import { CompanyValuesProfile } from '../../db/models/companyValuesProfileModel.js';
import { conflict } from '../../utils/appError.js';
import { buildRetentionExpiry } from '../retention/retentionPolicy.js';

const terminalStatuses = new Set(['ready', 'fallback', 'failed']);

const cleanSet = (payload = {}) => Object.fromEntries(
  Object.entries(payload).filter(([, value]) => value !== undefined)
);

const buildPrivateRetentionFields = () => ({
  retentionUntil: buildRetentionExpiry(),
  deletedAt: null,
  containsSensitiveData: true,
  accessScope: 'private',
  schemaVersion: 'v2',
});

export const getCompanyValuesProfile = async (sessionId) => {
  if (!sessionId) return null;
  return CompanyValuesProfile.findOne({ sessionId }).lean();
};

export const getCompanyValuesProfileByFingerprint = async ({ userId, jdFingerprint } = {}) => {
  if (!userId || !jdFingerprint) return null;
  return CompanyValuesProfile.findOne({ userId: String(userId), jdFingerprint }).lean();
};

export const getCompanyValuesProfilesByUserId = async (userId) => {
  if (!userId) return [];
  return CompanyValuesProfile.find({ userId: String(userId) }).sort({ updatedAt: -1 }).lean();
};

export const markCompanyValuesStatus = async ({
  userId,
  jdFingerprint,
  sessionId,
  companyName,
  location,
  status,
  websiteUrl,
  manualWebsiteUrl,
  source,
  confidence,
  fallbackReason,
  errorMessage,
} = {}) => {
  if (!userId || !jdFingerprint) return null;

  return CompanyValuesProfile.findOneAndUpdate(
    { userId: String(userId), jdFingerprint },
    {
      $set: cleanSet({
        userId: String(userId),
        jdFingerprint,
        sessionId: sessionId || undefined,
        companyName: companyName || undefined,
        location: location || undefined,
        status: status || undefined,
        websiteUrl: websiteUrl || undefined,
        manualWebsiteUrl: manualWebsiteUrl || undefined,
        source: source || undefined,
        confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : undefined,
        fallbackReason: fallbackReason || undefined,
        errorMessage: errorMessage || undefined,
        startedAt: status === 'pending' ? new Date() : undefined,
        completedAt: terminalStatuses.has(status) ? new Date() : undefined,
        ...buildPrivateRetentionFields(),
      }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

export const saveCompanyValuesProfile = async (profile = {}) => {
  if (!profile.userId || !profile.jdFingerprint) return null;

  const completedAt = terminalStatuses.has(profile.status)
    ? profile.completedAt || new Date()
    : profile.completedAt;

  return CompanyValuesProfile.findOneAndUpdate(
    { userId: String(profile.userId), jdFingerprint: profile.jdFingerprint },
    {
      $set: cleanSet({
        ...profile,
        userId: String(profile.userId),
        sessionId: profile.sessionId || undefined,
        completedAt,
        ...buildPrivateRetentionFields(),
      }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

export const attachCompanyValuesProfileToSession = async ({ userId, jdFingerprint, sessionId } = {}) => {
  if (!userId || !jdFingerprint || !sessionId) return null;
  return CompanyValuesProfile.findOneAndUpdate(
    { userId: String(userId), jdFingerprint },
    { $set: { sessionId, ...buildPrivateRetentionFields() } },
    { new: true }
  ).lean();
};

export const saveCompanyRoleFitDraft = async ({ userId, jdFingerprint, roleFitProfile, rawJD, sourceUrl, jdRubric } = {}) => {
  if (!userId || !jdFingerprint || !roleFitProfile) return null;
  const version = Math.max(1, Number(roleFitProfile.review?.version) || 1);
  return CompanyValuesProfile.findOneAndUpdate(
    { userId: String(userId), jdFingerprint },
    {
      $set: cleanSet({
        userId: String(userId),
        jdFingerprint,
        roleFitProfile,
        roleFitReviewVersion: version,
        roleFitReviewStatus: roleFitProfile.review?.status || 'unreviewed',
        rawJD,
        sourceUrl,
        jdRubric,
        ...buildPrivateRetentionFields(),
      }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

export const confirmCompanyRoleFitReview = async ({
  userId,
  jdFingerprint,
  baseVersion,
  roleFitProfile,
  jdRubric,
} = {}) => {
  const expectedVersion = Number(baseVersion);
  const nextVersion = expectedVersion + 1;
  if (!userId || !jdFingerprint || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !roleFitProfile) {
    throw conflict('Role-fit review conflict', 'The role-fit review version is missing or stale. Re-summarise the JD before confirming.');
  }

  const reviewedAt = new Date();
  const reviewedProfile = {
    ...roleFitProfile,
    review: {
      ...(roleFitProfile.review || {}),
      status: 'verified',
      baseVersion: expectedVersion,
      version: nextVersion,
      reviewedAt: reviewedAt.toISOString(),
    },
  };
  const updated = await CompanyValuesProfile.findOneAndUpdate(
    { userId: String(userId), jdFingerprint, roleFitReviewVersion: expectedVersion },
    {
      $set: cleanSet({
        roleFitProfile: reviewedProfile,
        roleFitReviewVersion: nextVersion,
        roleFitReviewStatus: 'verified',
        roleFitReviewedAt: reviewedAt,
        jdRubric,
        ...buildPrivateRetentionFields(),
      }),
    },
    { new: true }
  ).lean();

  if (!updated) {
    throw conflict('Role-fit review conflict', 'This JD understanding changed in another request. Re-summarise it before confirming.');
  }
  return updated;
};

export const assertVerifiedCompanyRoleFitReview = async ({
  userId,
  jdFingerprint,
  reviewVersion,
  roleFitProfileId,
} = {}) => {
  const profile = await getCompanyValuesProfileByFingerprint({ userId, jdFingerprint });
  const isVerified = profile?.roleFitReviewStatus === 'verified';
  const versionMatches = Number(profile?.roleFitReviewVersion) === Number(reviewVersion);
  const identityMatches = Boolean(roleFitProfileId && profile?.roleFitProfile?.id === roleFitProfileId);
  if (!isVerified || !versionMatches || !identityMatches) {
    throw conflict(
      'Role-fit review conflict',
      'The verified company and role understanding is missing or stale. Re-summarise and confirm the JD before matching.'
    );
  }
  return profile;
};
