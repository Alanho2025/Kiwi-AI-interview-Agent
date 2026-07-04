import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const REQUIRED_SMOKE_CASE_COUNT = 40;

const assertEncryptionKey = (key) => {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('Retention manifest encryption key must contain exactly 32 bytes');
  }
};

const hasValidTimestamp = (value) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const validateCandidates = (candidates, sourceName) => {
  if (!Array.isArray(candidates)) throw new Error(`${sourceName} candidates must be an array`);
  for (const candidate of candidates) {
    if (!candidate?.id || !hasValidTimestamp(candidate.updatedAt)) {
      throw new Error(`${sourceName} candidate requires an audited timestamp and identifier`);
    }
  }
};

export const validateCandidateManifest = (manifest) => {
  if (!manifest?.runId || !hasValidTimestamp(manifest.cutoff)) {
    throw new Error('Retention candidate manifest requires runId and cutoff');
  }
  validateCandidates(manifest.mongo, 'Mongo');
  validateCandidates(manifest.postgres, 'PostgreSQL');
  const smokeCaseIds = new Set(manifest.fixedSmokeCaseIds || []);
  if (smokeCaseIds.size !== REQUIRED_SMOKE_CASE_COUNT) {
    throw new Error(`Retention candidate manifest must protect exactly ${REQUIRED_SMOKE_CASE_COUNT} smoke cases`);
  }
  return manifest;
};

export const encryptCandidateManifest = (manifest, key) => {
  assertEncryptionKey(key);
  validateCandidateManifest(manifest);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(manifest), 'utf8'),
    cipher.final(),
  ]);
  return {
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
};

export const decryptCandidateManifest = (encrypted, key) => {
  assertEncryptionKey(key);
  if (encrypted?.algorithm !== ENCRYPTION_ALGORITHM) {
    throw new Error(`Unsupported retention manifest encryption algorithm: ${encrypted?.algorithm}`);
  }
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(encrypted.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return validateCandidateManifest(JSON.parse(plaintext));
};
