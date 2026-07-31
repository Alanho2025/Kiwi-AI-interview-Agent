import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  sha256Text,
  sha256Json,
  buildCvHash,
  buildJdHash,
  buildMatchCacheKey,
} from '../../../src/utils/cacheHash.js';

describe('F-13 File Repository & Upload SHA256 Deduplication Robustness Suite', () => {
  it('generates consistent deterministic SHA256 checksums for binary file buffers', () => {
    const fileBuffer1 = Buffer.from('Candidate Resume Content - John Doe - 2026');
    const fileBuffer2 = Buffer.from('Candidate Resume Content - John Doe - 2026');
    const fileBuffer3 = Buffer.from('Candidate Resume Content - Jane Smith - 2026');

    const checksum1 = crypto.createHash('sha256').update(fileBuffer1).digest('hex');
    const checksum2 = crypto.createHash('sha256').update(fileBuffer2).digest('hex');
    const checksum3 = crypto.createHash('sha256').update(fileBuffer3).digest('hex');

    expect(checksum1).toBe(checksum2);
    expect(checksum1).not.toBe(checksum3);
    expect(checksum1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates deterministic SHA256 text and JSON hashes in cacheHash utility', () => {
    const textHash = sha256Text('Senior Software Engineer');
    const jsonHash = sha256Json({ name: 'John', role: 'Developer' });

    expect(textHash).toMatch(/^[a-f0-9]{64}$/);
    expect(jsonHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Text('Senior Software Engineer')).toBe(textHash);
  });

  it('builds canonical CV hash, JD hash, and match cache keys for duplicate detection', () => {
    const cvInput = { rawText: 'CV text content', cvProfile: { name: 'Applicant' } };
    const cvHash1 = buildCvHash(cvInput);
    const cvHash2 = buildCvHash(cvInput);

    const jdInput = { rawJD: 'JD requirements text', jdRubric: { title: 'Engineer' } };
    const jdHash1 = buildJdHash(jdInput);
    const jdHash2 = buildJdHash(jdInput);

    const cacheKey1 = buildMatchCacheKey({ userId: 'user-123', cvHash: cvHash1, jdHash: jdHash1, settingsHash: 's1' });
    const cacheKey2 = buildMatchCacheKey({ userId: 'user-123', cvHash: cvHash2, jdHash: jdHash2, settingsHash: 's1' });

    expect(cvHash1).toBe(cvHash2);
    expect(jdHash1).toBe(jdHash2);
    expect(cacheKey1).toBe(cacheKey2);
  });
});
