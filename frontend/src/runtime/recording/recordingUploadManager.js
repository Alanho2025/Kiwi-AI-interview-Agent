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
  const listeners = new Set();

  const publish = (patch) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener(snapshot));
  };

  const ensureManifest = async () => {
    let manifest = await store.getManifest(sessionId);
    if (manifest?.uploadId) return manifest;
    const initialized = await api.initialize({ sessionId, mimeType: manifest?.mimeType || 'audio/webm' });
    manifest = await store.putManifest({
      sessionId,
      uploadId: initialized.uploadId,
      mimeType: manifest?.mimeType || 'audio/webm',
      finalized: Boolean(manifest?.finalized),
      totalChunks: manifest?.totalChunks ?? null,
      totalBytes: manifest?.totalBytes ?? 0,
    });
    publish({ uploadId: initialized.uploadId, state: initialized.state || 'receiving' });
    return manifest;
  };

  const publishUploadError = (error) => {
    publish({
      state: error instanceof TypeError ? 'waiting_for_network' : 'recoverable_failed',
      error,
      retryable: true,
    });
  };

  const pump = async () => {
    const priorityState = getVoicePriorityState();
    if (RECORDING_LATENCY_CRITICAL_STATES.has(priorityState)) {
      publish({ state: 'paused_for_voice' });
      return;
    }
    const manifest = await ensureManifest();
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
    publish({ state: latestManifest?.finalized ? 'locally_durable' : 'receiving', pendingChunks: 0 });
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
    await store.putChunk({ sessionId, sequence, blob, mimeType, checksum, byteLength: blob.size, state: 'pending' });
    const current = await store.getManifest(sessionId);
    await store.putManifest({
      ...(current || {}),
      sessionId,
      mimeType,
      totalBytes: Number(current?.totalBytes || 0) + blob.size,
    });
    publish({ state: 'captured_locally', pendingChunks: snapshot.pendingChunks + 1 });
    void requestRecordingBackgroundSync().catch(() => null);
    if (active) void start();
  };

  const finalizeLocalCapture = ({ totalChunks, totalBytes }) => {
    if (finalizationPromise) return finalizationPromise;
    finalizationPromise = Promise.resolve().then(async () => {
      const current = await store.getManifest(sessionId);
      await store.putManifest({
        ...(current || {}),
        sessionId,
        finalized: true,
        totalChunks,
        totalBytes,
      });
      publish({ state: 'locally_durable', totalChunks, progressPercent: 0 });
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
