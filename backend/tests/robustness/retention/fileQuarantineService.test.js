import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFileQuarantineService } from '../../../src/services/retention/fileQuarantineService.js';

const temporaryRoots = [];

const createTemporaryRoot = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-retention-test-'));
  temporaryRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('fileQuarantineService', () => {
  it('moves files to quarantine, restores them, and only deletes after finalization', async () => {
    const root = await createTemporaryRoot();
    const uploadsRoot = path.join(root, 'uploads');
    const quarantineRoot = path.join(root, 'quarantine');
    const originalPath = path.join(uploadsRoot, 'cv', 'candidate.pdf');
    await fs.mkdir(path.dirname(originalPath), { recursive: true });
    await fs.writeFile(originalPath, 'resume');
    const service = createFileQuarantineService({ uploadsRoot, quarantineRoot });

    const entries = await service.quarantine({ jobId: 'job-1', filePaths: [originalPath] });
    await expect(fs.stat(originalPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(entries[0].quarantinePath, 'utf8')).toBe('resume');

    await service.restore({ entries });
    expect(await fs.readFile(originalPath, 'utf8')).toBe('resume');

    const secondEntries = await service.quarantine({ jobId: 'job-2', filePaths: [originalPath] });
    await service.finalize({ entries: secondEntries });
    await expect(fs.stat(secondEntries[0].quarantinePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects paths outside the configured uploads root', async () => {
    const root = await createTemporaryRoot();
    const service = createFileQuarantineService({
      uploadsRoot: path.join(root, 'uploads'),
      quarantineRoot: path.join(root, 'quarantine'),
    });

    await expect(service.quarantine({
      jobId: 'job-1',
      filePaths: [path.join(root, 'outside.txt')],
    })).rejects.toThrow('outside uploads root');
  });

  it('restores files already moved when a later quarantine move fails', async () => {
    const root = await createTemporaryRoot();
    const uploadsRoot = path.join(root, 'uploads');
    const quarantineRoot = path.join(root, 'quarantine');
    const firstPath = path.join(uploadsRoot, 'first.pdf');
    const invalidSecondPath = path.join(root, 'outside.pdf');
    await fs.mkdir(uploadsRoot, { recursive: true });
    await fs.writeFile(firstPath, 'first');
    const service = createFileQuarantineService({ uploadsRoot, quarantineRoot });

    await expect(service.quarantine({
      jobId: 'job-rollback',
      filePaths: [firstPath, invalidSecondPath],
    })).rejects.toThrow('outside uploads root');

    expect(await fs.readFile(firstPath, 'utf8')).toBe('first');
  });
});
