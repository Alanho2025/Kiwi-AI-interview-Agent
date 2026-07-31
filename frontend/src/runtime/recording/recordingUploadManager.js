import { RECORDING_LATENCY_CRITICAL_STATES } from './recordingConstants.js';
import { requestRecordingBackgroundSync } from './recordingBackgroundSync.js';

export const checksumRecordingBlob = async (blob) => {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const buildInitialSnapshot = () => ({
  state: 'idle',
  uploadId: null,
  pendingChunks: 0,
  totalChunks: null,
  uploadedChunks: 0,
  progressPercent: null,
  available: false,
  retryable: true,
  error: null,
});

const calculateProgressPercent = ({ uploadedChunks, totalChunks }) => (
  Number.isInteger(totalChunks) && totalChunks > 0
    ? Math.min(100, Math.round((uploadedChunks / totalChunks) * 100))
    : null
);

export const createRecordingUploadManager = ({
  sessionId,
  store,
  api,
  checksumBlob = checksumRecordingBlob,
  getVoicePriorityState = () => null,
}) => {
  let snapshot = buildInitialSnapshot();
  let active = false;
  let pumpPromise = null;
  let rerunRequested = false;
  let finalizationPromise = null;
  let manifestSyncPromise = null;
  const listeners = new Set();

  const publish = (patch) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener(snapshot));
  };

  const asNonNegativeInteger = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  };

  const ensureLocalManifest = async ({ mimeType = 'audio/webm' } = {}) => {
    const existing = await store.getManifest(sessionId);
    if (existing) return existing;
    return store.putManifest({
      sessionId,
      uploadId: null,
      mimeType,
      finalized: false,
      totalChunks: null,
      nextSequence: 0,
      totalBytes: 0,
    });
  };

  const ensureManifest = async () => {
    let manifest = await ensureLocalManifest();
    if (manifest.uploadId) return manifest;
    const initialized = await api.initialize({ sessionId, mimeType: manifest.mimeType || 'audio/webm' });
    manifest = await store.putManifest({
      ...manifest,
      uploadId: initialized.uploadId,
      mimeType: manifest.mimeType || 'audio/webm',
    });
    publish({ uploadId: initialized.uploadId, state: initialized.state || 'receiving' });
    return manifest;
  };

  const rebasePendingChunks = async ({ chunks, remoteNextSequence }) => {
    if (!chunks.length || chunks.every((chunk) => chunk.sequence >= remoteNextSequence)) return chunks;

    const rebased = chunks.map((original, index) => ({
      original,
      chunk: {
        ...original,
        sequence: remoteNextSequence + index,
      },
    }));
    for (const { original, chunk } of [...rebased].reverse()) {
      await store.putChunk(chunk);
      if (original.sequence !== chunk.sequence) {
        await store.deleteChunk(sessionId, original.sequence);
      }
    }
    return rebased.map(({ chunk }) => chunk);
  };

  const synchronizeManifest = async () => {
    if (manifestSyncPromise) return manifestSyncPromise;
    manifestSyncPromise = Promise.resolve().then(async () => {
      let manifest = await ensureManifest();
      let remoteStatus = null;
      if (manifest.uploadId && api.getStatus) {
        try {
          remoteStatus = await api.getStatus(manifest.uploadId);
        } catch {
          remoteStatus = null;
        }
      }

      const remoteNextSequence = asNonNegativeInteger(
        remoteStatus?.receivedChunks ?? manifest.remoteReceivedChunks
      );
      const remoteReceivedBytes = asNonNegativeInteger(
        remoteStatus?.receivedBytes ?? manifest.remoteReceivedBytes
      );
      const pendingChunks = await store.listChunks(sessionId);
      const rebasedChunks = await rebasePendingChunks({ chunks: pendingChunks, remoteNextSequence });
      const localNextSequence = rebasedChunks.reduce(
        (next, chunk) => Math.max(next, asNonNegativeInteger(chunk.sequence) + 1),
        0
      );
      const pendingBytes = rebasedChunks.reduce(
        (total, chunk) => total + asNonNegativeInteger(chunk.byteLength || chunk.blob?.size),
        0
      );
      manifest = await store.putManifest({
        ...manifest,
        remoteReceivedChunks: remoteNextSequence,
        remoteReceivedBytes,
        nextSequence: Math.max(
          asNonNegativeInteger(manifest.nextSequence),
          remoteNextSequence,
          localNextSequence
        ),
        totalBytes: Math.max(
          asNonNegativeInteger(manifest.totalBytes),
          remoteReceivedBytes + pendingBytes
        ),
      });
      return manifest;
    }).finally(() => { manifestSyncPromise = null; });
    return manifestSyncPromise;
  };

  const publishUploadError = (error) => {
    publish({
      state: error instanceof TypeError ? 'waiting_for_network' : 'recoverable_failed',
      error,
      retryable: true,
    });
  };

  const pump = async () => {
    const manifest = await synchronizeManifest();
    const priorityState = getVoicePriorityState();
    if (!manifest.finalized && RECORDING_LATENCY_CRITICAL_STATES.has(priorityState)) {
      publish({ state: 'paused_for_voice' });
      return;
    }
    const chunks = await store.listChunks(sessionId);
    if (manifest.finalized && Number.isInteger(manifest.totalChunks)) {
      const uploadedChunks = Math.max(0, manifest.totalChunks - chunks.length);
      publish({
        totalChunks: manifest.totalChunks,
        uploadedChunks,
        progressPercent: calculateProgressPercent({ uploadedChunks, totalChunks: manifest.totalChunks }),
      });
    }
    for (const chunk of chunks) {
      if (!active) return;
      await store.updateChunk(sessionId, chunk.sequence, { state: 'uploading' });
      publish({ state: 'uploading', pendingChunks: chunks.length });
      try {
        await api.uploadChunk({
          uploadId: manifest.uploadId,
          sequence: chunk.sequence,
          checksum: chunk.checksum,
          blob: chunk.blob,
        });
        await store.deleteChunk(sessionId, chunk.sequence);
        const uploadedChunks = snapshot.uploadedChunks + 1;
        publish({
          uploadedChunks,
          pendingChunks: Math.max(0, snapshot.pendingChunks - 1),
          progressPercent: calculateProgressPercent({ uploadedChunks, totalChunks: snapshot.totalChunks }),
        });
      } catch (error) {
        await store.updateChunk(sessionId, chunk.sequence, { state: 'pending' });
        publishUploadError(error);
        return;
      }
    }
    const latestManifest = await store.getManifest(sessionId);
    if (latestManifest?.finalized && !latestManifest.remoteFinalized) {
      const result = await api.finalize({
        uploadId: latestManifest.uploadId,
        totalChunks: latestManifest.totalChunks,
        totalBytes: latestManifest.totalBytes,
      });
      await store.putManifest({ ...latestManifest, remoteFinalized: true, remoteState: result.state });
      publish({ state: result.state || 'queued', pendingChunks: 0, progressPercent: 100 });
      return;
    }
    const finalState = latestManifest?.remoteState || (latestManifest?.finalized ? 'locally_durable' : 'receiving');
    publish({ state: finalState, pendingChunks: 0 });
  };

  const start = () => {
    active = true;
    if (pumpPromise) {
      rerunRequested = true;
      return pumpPromise;
    }
    pumpPromise = Promise.resolve().then(async () => {
      do {
        rerunRequested = false;
        try {
          await store.resetUploading(sessionId);
          await pump();
        } catch (error) {
          publishUploadError(error);
          return;
        }
      } while (active && rerunRequested);
    })
      .finally(() => { pumpPromise = null; });
    return pumpPromise;
  };

  const enqueueChunk = async ({ sequence, blob, mimeType }) => {
    const checksum = await checksumBlob(blob);
    const current = await ensureLocalManifest({ mimeType });
    const resolvedSequence = Math.max(
      asNonNegativeInteger(sequence),
      asNonNegativeInteger(current.nextSequence)
    );
    await store.putChunk({
      sessionId,
      sequence: resolvedSequence,
      blob,
      mimeType,
      checksum,
      byteLength: blob.size,
      state: 'pending',
    });
    await store.putManifest({
      ...(current || {}),
      sessionId,
      mimeType,
      nextSequence: resolvedSequence + 1,
      totalBytes: Number(current?.totalBytes || 0) + blob.size,
    });
    publish({ state: 'captured_locally', pendingChunks: snapshot.pendingChunks + 1 });
    void requestRecordingBackgroundSync().catch(() => null);
    if (active) void start();
    return { sequence: resolvedSequence };
  };

  const finalizeLocalCapture = ({ totalChunks, totalBytes }) => {
    if (finalizationPromise) return finalizationPromise;
    finalizationPromise = Promise.resolve().then(async () => {
      const current = await ensureLocalManifest();
      const resolvedTotalChunks = Math.max(
        asNonNegativeInteger(totalChunks),
        asNonNegativeInteger(current.nextSequence)
      );
      await store.putManifest({
        ...current,
        sessionId,
        finalized: true,
        totalChunks: resolvedTotalChunks,
        totalBytes: Math.max(
          asNonNegativeInteger(totalBytes),
          asNonNegativeInteger(current.totalBytes)
        ),
      });
      publish({
        state: 'locally_durable',
        totalChunks: resolvedTotalChunks,
        progressPercent: 0,
      });
      void start();
      return { state: 'locally_durable' };
    });
    return finalizationPromise;
  };

  return {
    enqueueChunk,
    finalizeLocalCapture,
    getSnapshot: () => snapshot,
    start,
    stop: () => { active = false; },
    subscribe: (listener) => { listeners.add(listener); listener(snapshot); return () => listeners.delete(listener); },
  };
};
