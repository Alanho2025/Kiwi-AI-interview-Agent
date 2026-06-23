import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecordingChunkStorageService } from '../../../src/services/recording/recordingChunkStorageService.js';

describe('recording chunk storage', () => {
  let root;
  let storage;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-recording-storage-'));
    storage = createRecordingChunkStorageService({ root });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('moves a temporary chunk into an upload-specific durable path', async () => {
    const temporaryPath = path.join(root, 'incoming.webm');
    await fs.writeFile(temporaryPath, Buffer.from('chunk-zero'));

    const result = await storage.persistChunk({
      uploadId: 'upload-1',
      sequence: 0,
      checksum: 'hash-zero',
      file: { path: temporaryPath, mimetype: 'audio/webm' },
    });

    const checksum = createHash('sha256').update('chunk-zero').digest('hex');
    expect(result.storageKey).toBe(`chunks/upload-1/000000-${checksum}.webm`);
    expect(result.checksum).toBe(checksum);
    await expect(fs.readFile(storage.resolveStorageKey(result.storageKey), 'utf8')).resolves.toBe('chunk-zero');
    await expect(fs.stat(temporaryPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('assembles chunks in sequence order without deleting sources', async () => {
    const first = path.join(root, 'first.webm');
    const second = path.join(root, 'second.webm');
    await fs.writeFile(first, Buffer.from('A'));
    await fs.writeFile(second, Buffer.from('B'));
    const storedSecond = await storage.persistChunk({ uploadId: 'upload-1', sequence: 1, checksum: 'b', file: { path: second, mimetype: 'audio/webm' } });
    const storedFirst = await storage.persistChunk({ uploadId: 'upload-1', sequence: 0, checksum: 'a', file: { path: first, mimetype: 'audio/webm' } });

    const assembledPath = await storage.assembleChunks({
      uploadId: 'upload-1',
      chunks: [
        { sequence: 1, storage_key: storedSecond.storageKey },
        { sequence: 0, storage_key: storedFirst.storageKey },
      ],
    });

    await expect(fs.readFile(assembledPath, 'utf8')).resolves.toBe('AB');
    await expect(fs.stat(storage.resolveStorageKey(storedFirst.storageKey))).resolves.toBeTruthy();
  });
});
