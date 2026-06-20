import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptCandidateManifest,
  encryptCandidateManifest,
  validateCandidateManifest,
} from '../../../src/services/retention/retentionManifestService.js';

const buildManifest = () => ({
  runId: 'run-1',
  cutoff: '2026-06-12T00:00:00.000Z',
  retentionDays: 7,
  mongo: [{ collection: 'sessionanalyses', id: 'mongo-1', updatedAt: '2026-06-01T00:00:00.000Z' }],
  postgres: [{ table: 'interview_sessions', id: 'session-1', updatedAt: '2026-06-01T00:00:00.000Z' }],
  fixedSmokeCaseIds: Array.from({ length: 40 }, (_, index) => `case-${index}`),
});

describe('retentionManifestService', () => {
  it('round-trips an encrypted candidate manifest', () => {
    const key = crypto.randomBytes(32);
    const encrypted = encryptCandidateManifest(buildManifest(), key);

    expect(decryptCandidateManifest(encrypted, key)).toEqual(buildManifest());
  });

  it('rejects a manifest whose authenticated ciphertext was modified', () => {
    const key = crypto.randomBytes(32);
    const encrypted = encryptCandidateManifest(buildManifest(), key);
    const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -4)}AAAA` };

    expect(() => decryptCandidateManifest(tampered, key)).toThrow();
  });

  it('rejects candidates without audited timestamps and incomplete smoke protection', () => {
    const invalid = buildManifest();
    invalid.mongo[0].updatedAt = null;
    invalid.fixedSmokeCaseIds = ['case-1'];

    expect(() => validateCandidateManifest(invalid)).toThrow('audited timestamp');
  });
});
