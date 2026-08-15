import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { getRecordingConfig } from '../../config/recordingConfig.js';

const safePart = (value) => {
  const sanitized = String(value || '').replace(/[^a-zA-Z0-9_.-]/g, '');
  return (sanitized === '.' || sanitized === '..') ? 'invalid' : sanitized;
};
const extensionForMime = (mimeType = '') => mimeType.includes('mp4') ? '.mp4' : mimeType.includes('ogg') ? '.ogg' : '.webm';

const moveFile = async (source, target) => {
  try {
    await fs.rename(source, target);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(source, target);
    await fs.unlink(source);
  }
};

export const createRecordingChunkStorageService = ({ root = getRecordingConfig().storageRoot } = {}) => {
  const resolveStorageKey = (storageKey) => path.join(root, ...String(storageKey).split('/').map(safePart));

  const persistChunk = async ({ uploadId, sequence, checksum, file }) => {
    const extension = extensionForMime(file?.mimetype);
    const actualChecksum = createHash('sha256').update(await fs.readFile(file.path)).digest('hex');
    const storageKey = `chunks/${safePart(uploadId)}/${String(sequence).padStart(6, '0')}-${actualChecksum}${extension}`;
    const target = resolveStorageKey(storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await moveFile(file.path, target);
    return { storageKey, checksum: actualChecksum, checksumMatches: !checksum || checksum === actualChecksum };
  };

  const deleteChunk = async (storageKey) => fs.unlink(resolveStorageKey(storageKey)).catch(() => {});
  const discardTemporaryFile = async (temporaryPath) => fs.unlink(temporaryPath).catch(() => {});

  const assembleChunks = async ({ uploadId, chunks }) => {
    const workPath = resolveStorageKey(`work/${safePart(uploadId)}.source`);
    await fs.mkdir(path.dirname(workPath), { recursive: true });
    await fs.writeFile(workPath, Buffer.alloc(0));
    const ordered = [...chunks].sort((left, right) => Number(left.sequence) - Number(right.sequence));
    for (const chunk of ordered) {
      await fs.appendFile(workPath, await fs.readFile(resolveStorageKey(chunk.storage_key)));
    }
    return workPath;
  };

  const getPublishedMp3Path = (sessionId) => resolveStorageKey(`mp3/${safePart(sessionId)}.mp3`);
  const publishMp3 = async ({ temporaryPath, sessionId }) => {
    const target = getPublishedMp3Path(sessionId);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await moveFile(temporaryPath, target);
    return { storageKey: `mp3/${safePart(sessionId)}.mp3`, path: target };
  };

  return { resolveStorageKey, persistChunk, deleteChunk, discardTemporaryFile, assembleChunks, getPublishedMp3Path, publishMp3 };
};

export const recordingChunkStorageService = createRecordingChunkStorageService();
