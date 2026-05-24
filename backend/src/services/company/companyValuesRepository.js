import { CompanyValuesProfile } from '../../db/models/companyValuesProfileModel.js';

const terminalStatuses = new Set(['ready', 'fallback', 'failed']);

const cleanSet = (payload = {}) => Object.fromEntries(
  Object.entries(payload).filter(([, value]) => value !== undefined)
);

export const getCompanyValuesProfile = async (sessionId) => {
  if (!sessionId) return null;
  return CompanyValuesProfile.findOne({ sessionId }).lean();
};

export const getCompanyValuesProfileByFingerprint = async ({ userId, jdFingerprint } = {}) => {
  if (!userId || !jdFingerprint) return null;
  return CompanyValuesProfile.findOne({ userId: String(userId), jdFingerprint }).lean();
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
      }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

export const attachCompanyValuesProfileToSession = async ({ userId, jdFingerprint, sessionId } = {}) => {
  if (!userId || !jdFingerprint || !sessionId) return null;
  return CompanyValuesProfile.findOneAndUpdate(
    { userId: String(userId), jdFingerprint },
    { $set: { sessionId } },
    { new: true }
  ).lean();
};
