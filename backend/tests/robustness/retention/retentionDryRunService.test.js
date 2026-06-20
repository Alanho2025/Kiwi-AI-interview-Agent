import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCandidatePlanSummary,
  verifyCandidateFiles,
  verifyPostgresCandidates,
} from '../../../src/services/retention/retentionDryRunService.js';

describe('retentionDryRunService PostgreSQL verification', () => {
  it('verifies session timestamps and Mongo-timestamped file existence by table', async () => {
    const postgresQuery = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ id: 'session-1', updated_at: new Date('2026-06-01T00:00:00.000Z') }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'file-1', updated_at: new Date('2026-06-01T00:00:00.000Z') }],
      });

    const result = await verifyPostgresCandidates(postgresQuery, [
      {
        table: 'interview_sessions',
        id: 'session-1',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      {
        table: 'uploaded_files',
        id: 'file-1',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ]);

    expect(result).toEqual({ matched: 2, missing: [], changed: [] });
    expect(postgresQuery).toHaveBeenCalledTimes(2);
    expect(postgresQuery.mock.calls[0][0]).toContain('FROM interview_sessions');
    expect(postgresQuery.mock.calls[1][0]).toContain('FROM uploaded_files');
  });

  it('rejects unsupported tables instead of constructing dynamic SQL', async () => {
    await expect(verifyPostgresCandidates(vi.fn(), [{
      table: 'users',
      id: 'user-1',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }])).rejects.toThrow('Unsupported PostgreSQL retention table');
  });

  it('reports planned counts and estimated release by collection and table', () => {
    const summary = buildCandidatePlanSummary({
      mongo: [
        { collection: 'sessionanalyses', estimatedBytes: 100 },
        { collection: 'sessionanalyses', estimatedBytes: 150 },
        { collection: 'documentcontents', estimatedBytes: 200 },
      ],
      postgres: [
        { table: 'interview_sessions', estimatedBytes: 50 },
        { table: 'uploaded_files', estimatedBytes: 1_000 },
      ],
      filePathsByResourceId: { 'file-1': ['/uploads/cv.pdf'] },
    });

    expect(summary.mongoByCollection.sessionanalyses).toEqual({ count: 2, estimatedBytes: 250 });
    expect(summary.postgresByTable.uploaded_files).toEqual({ count: 1, estimatedBytes: 1000 });
    expect(summary.estimatedReleaseBytes).toBe(1500);
    expect(summary.fileCount).toBe(1);
  });

  it('reports already-missing files but only marks out-of-root paths unsafe', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-retention-files-'));
    const existing = path.join(root, 'existing.wav');
    await fs.writeFile(existing, 'audio');
    try {
      const result = await verifyCandidateFiles({
        uploadsRoot: root,
        filePathsByResourceId: {
          session: [existing, path.join(root, 'missing.wav'), path.join(root, '..', 'outside.wav')],
        },
      });
      expect(result.valid).toBe(false);
      expect(result.matchedCount).toBe(1);
      expect(result.missingCount).toBe(1);
      expect(result.outsideRootCount).toBe(1);

      const withoutOutsidePath = await verifyCandidateFiles({
        uploadsRoot: root,
        filePathsByResourceId: { session: [existing, path.join(root, 'missing.wav')] },
      });
      expect(withoutOutsidePath.valid).toBe(true);
      expect(withoutOutsidePath.missingCount).toBe(1);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
