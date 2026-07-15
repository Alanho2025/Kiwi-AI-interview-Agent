import {
  finalizeRecordingUpload,
  getRecordingUploadStatus,
  initializeRecordingUpload,
  uploadRecordingChunk,
} from '../../api/recordingApi.js';
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

  return {
    getOrCreate,
    setVoicePriorityState: (sessionId, state) => voiceStates.set(sessionId, state),
  };
};

export const recordingUploadRegistry = createRecordingUploadRegistry();
