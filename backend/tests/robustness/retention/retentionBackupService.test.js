import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRetentionBackupService } from '../../../src/services/retention/retentionBackupService.js';

const temporaryRoots = [];

const createTemporaryRoot = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-retention-backup-test-'));
  temporaryRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('retentionBackupService', () => {
  it('creates encrypted Mongo and PostgreSQL archives and verifies both before approval', async () => {
    const root = await createTemporaryRoot();
    const runCommand = vi.fn(async ({ command, outputPath }) => {
      if (outputPath) await fs.writeFile(outputPath, `archive:${command}`, { mode: 0o600 });
      return { ok: true };
    });
    const service = createRetentionBackupService({
      backupRoot: path.join(root, 'backups'),
      keyRoot: path.join(root, 'keys'),
      temporaryRoot: path.join(root, 'temporary'),
      runCommand,
      now: () => new Date('2026-06-20T00:00:00.000Z'),
    });

    const result = await service.createAndVerify({
      runId: 'run-1',
      mongoUri: 'mongodb+srv://secret',
      postgresUrl: 'postgresql://secret',
    });

    expect(result.verified).toBe(true);
    expect(result.expiresAt).toBe('2026-06-27T00:00:00.000Z');
    await expect(fs.stat(result.archives.mongo.encryptedPath)).resolves.toBeDefined();
    await expect(fs.stat(result.archives.postgres.encryptedPath)).resolves.toBeDefined();
    await expect(fs.stat(path.join(root, 'temporary', 'run-1-mongo.raw'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(runCommand.mock.calls.map(([call]) => call.command)).toEqual([
      'mongodump',
      'pg_dump',
      'mongorestore',
      'pg_restore',
    ]);
  });

  it('does not mark the backup verified when an archive validation command fails', async () => {
    const root = await createTemporaryRoot();
    const runCommand = vi.fn(async ({ command, outputPath }) => {
      if (outputPath) await fs.writeFile(outputPath, `archive:${command}`, { mode: 0o600 });
      if (command === 'mongorestore') throw new Error('invalid archive');
      return { ok: true };
    });
    const service = createRetentionBackupService({
      backupRoot: path.join(root, 'backups'),
      keyRoot: path.join(root, 'keys'),
      temporaryRoot: path.join(root, 'temporary'),
      runCommand,
    });

    await expect(service.createAndVerify({
      runId: 'run-1',
      mongoUri: 'mongodb+srv://secret',
      postgresUrl: 'postgresql://secret',
    })).rejects.toThrow('invalid archive');

    await expect(fs.stat(path.join(root, 'backups', 'run-1', 'backup-verification.json')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });
});
