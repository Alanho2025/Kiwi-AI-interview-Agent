import {
  finalizeRecordingUpload,
  getRecordingUploadStatus,
  initializeRecordingUpload,
  uploadRecordingChunk,
} from '../../api/recordingApi.js';
import { RECORDING_LATENCY_CRITICAL_STATES } from './recordingConstants.js';
import { indexedDbRecordingChunkStore } from './indexedDbRecordingChunkStore.js';
import { createRecordingUploadManager } from './recordingUploadManager.js';

const recordingApi = {
  initialize: initializeRecordingUpload,
  uploadChunk: uploadRecordingChunk,
  finalize: finalizeRecordingUpload,
  getStatus: getRecordingUploadStatus,
};

export const createRecordingUploadRegistry = ({
  managerFactory = createRecordingUploadManager,
  store = indexedDbRecordingChunkStore,
  api = recordingApi,
} = {}) => {
  const managers = new Map();
  const voiceStates = new Map();

  const getOrCreate = (sessionId) => {
    if (managers.has(sessionId)) return managers.get(sessionId);
    const manager = managerFactory({
      sessionId,
      store,
      api,
      getVoicePriorityState: () => voiceStates.get(sessionId) || null,
    });
    managers.set(sessionId, manager);
    return manager;
  };

  const setVoicePriorityState = (sessionId, state) => {
    const previousState = voiceStates.get(sessionId) || null;
    voiceStates.set(sessionId, state);
    const manager = managers.get(sessionId);
    if (manager) {
      if (
        RECORDING_LATENCY_CRITICAL_STATES.has(previousState) &&
        !RECORDING_LATENCY_CRITICAL_STATES.has(state)
      ) {
        void manager.start();
      }
    }
  };

  const resumeAllUnresolved = async () => {
    if (!store.listUnresolvedManifests) return [];
    const manifests = await store.listUnresolvedManifests().catch(() => []);
    const started = [];
    for (const manifest of manifests) {
      if (manifest?.sessionId) {
        const manager = getOrCreate(manifest.sessionId);
        void manager.start();
        started.push(manifest.sessionId);
      }
    }
    return started;
  };

  return {
    getOrCreate,
    setVoicePriorityState,
    resumeAllUnresolved,
  };
};

export const recordingUploadRegistry = createRecordingUploadRegistry();
