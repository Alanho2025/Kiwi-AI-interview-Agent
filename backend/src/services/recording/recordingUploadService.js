import { badRequest, forbidden, notFound } from '../../utils/appError.js';
import { recordingUploadRepository } from '../../repositories/recordingUploadRepository.js';
import { loadOwnedSessionOrThrow } from '../interview/interviewSessionService.js';
import { recordingChunkStorageService } from './recordingChunkStorageService.js';
import { getRecordingConfig } from '../../config/recordingConfig.js';

const toStatus = (manifest, missingSequences = []) => ({
  uploadId: manifest.id,
  sessionId: manifest.session_id,
  state: manifest.status,
  receivedChunks: Number(manifest.received_chunks || 0),
  totalChunks: manifest.total_chunks == null ? null : Number(manifest.total_chunks),
  receivedBytes: Number(manifest.received_bytes || 0),
  totalBytes: manifest.total_bytes == null ? null : Number(manifest.total_bytes),
  missingSequences,
  available: manifest.status === 'ready' && Boolean(manifest.mp3_storage_key),
  retryable: !['ready', 'failed'].includes(manifest.status),
});

const requireOwnedManifest = async ({ repository, uploadId, userId }) => {
  const manifest = await repository.findOwnedById({ uploadId, userId });
  if (!manifest) throw notFound('Recording upload not found');
  if (manifest.user_id !== userId) throw forbidden('Recording upload access denied');
  return manifest;
};

export const createRecordingUploadService = ({ repository, storage, loadOwnedSession, config = getRecordingConfig() }) => {
  const initialize = async ({ sessionId, userId, mimeType }) => {
    const session = await loadOwnedSession({ sessionId, userId });
    if (!session || session.mode !== 'voice') throw badRequest('Voice session required');
    const manifest = await repository.findOrCreateActive({ sessionId, userId, mimeType });
    return toStatus(manifest);
  };

  const uploadChunk = async ({ uploadId, userId, sequence, checksum, file }) => {
    let temporaryFileHandled = false;
    try {
      await requireOwnedManifest({ repository, uploadId, userId });
      if (!Number.isInteger(sequence) || sequence < 0) throw badRequest('Invalid recording chunk sequence');
      if (!file?.path || !file?.size) throw badRequest('Recording chunk is required');
      if (!checksum || String(checksum).length > 255) throw badRequest('Recording chunk checksum is required');
      if (file.size > config.maxChunkBytes) throw badRequest('Recording chunk is too large');
      const existing = await repository.findChunk({ uploadId, sequence });
      if (existing) {
        await storage.discardTemporaryFile(file.path);
        temporaryFileHandled = true;
        if (existing.checksum !== checksum) throw badRequest('Recording chunk checksum conflict');
        return toStatus(await repository.refreshCounters(uploadId));
      }
      const stored = await storage.persistChunk({ uploadId, sequence, checksum, file });
      temporaryFileHandled = true;
      if (stored.checksumMatches === false) {
        await storage.deleteChunk(stored.storageKey);
        throw badRequest('Recording chunk checksum does not match its content');
      }
      const result = await repository.insertChunk({
        uploadId,
        sequence,
        checksum,
        byteLength: file.size,
        storageKey: stored.storageKey,
      });
      if (!result.inserted && result.existing?.checksum !== checksum) {
        await storage.deleteChunk(stored.storageKey);
        throw badRequest('Recording chunk checksum conflict');
      }
      const manifest = await repository.refreshCounters(uploadId);
      return toStatus(manifest);
    } catch (error) {
      if (!temporaryFileHandled && file?.path) {
        await storage.discardTemporaryFile(file.path);
      }
      throw error;
    }
  };

  const finalize = async ({ uploadId, userId, totalChunks, totalBytes }) => {
    if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > config.maxChunks) {
      throw badRequest('Invalid total recording chunks');
    }
    if (!Number.isFinite(totalBytes) || totalBytes < 1 || totalBytes > config.maxSessionBytes) {
      throw badRequest('Invalid total recording bytes');
    }
    const manifest = await requireOwnedManifest({ repository, uploadId, userId });
    const chunks = await repository.listChunks(uploadId);
    const sequences = new Set(chunks.map((chunk) => Number(chunk.sequence)));
    const missingSequences = Array.from({ length: totalChunks }, (_, index) => index)
      .filter((sequence) => !sequences.has(sequence));
    if (missingSequences.length > 0) {
      return toStatus({ ...manifest, status: 'awaiting_missing_chunks', total_chunks: totalChunks, total_bytes: totalBytes }, missingSequences);
    }
    return toStatus(await repository.finalizeManifest({ uploadId, totalChunks, totalBytes }));
  };

  const getStatus = async ({ uploadId, userId }) => toStatus(
    await requireOwnedManifest({ repository, uploadId, userId }),
  );

  const retry = async ({ uploadId, userId }) => {
    const manifest = await requireOwnedManifest({ repository, uploadId, userId });
    if (manifest.status !== 'recoverable_failed') return toStatus(manifest);
    return toStatus(await repository.queueRetry(uploadId));
  };

  const getSessionStatus = async ({ sessionId, userId }) => {
    const manifest = await repository.findOwnedBySession({ sessionId, userId });
    return manifest ? toStatus(manifest) : null;
  };

  return { initialize, uploadChunk, finalize, getStatus, getSessionStatus, retry };
};

export const recordingUploadService = createRecordingUploadService({
  repository: recordingUploadRepository,
  storage: recordingChunkStorageService,
  loadOwnedSession: loadOwnedSessionOrThrow,
});
