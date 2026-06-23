import {
  RECORDING_CHUNK_STORE,
  RECORDING_DATABASE_NAME,
  RECORDING_DATABASE_VERSION,
  RECORDING_MANIFEST_STORE,
} from './recordingConstants.js';

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionComplete = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

export const openRecordingDatabase = ({ indexedDb = globalThis.indexedDB } = {}) => {
  if (!indexedDb) return Promise.reject(new Error('IndexedDB is unavailable'));
  const request = indexedDb.open(RECORDING_DATABASE_NAME, RECORDING_DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(RECORDING_MANIFEST_STORE)) {
      database.createObjectStore(RECORDING_MANIFEST_STORE, { keyPath: 'sessionId' });
    }
    if (!database.objectStoreNames.contains(RECORDING_CHUNK_STORE)) {
      const store = database.createObjectStore(RECORDING_CHUNK_STORE, { keyPath: 'key' });
      store.createIndex('sessionId', 'sessionId', { unique: false });
    }
  };
  return requestResult(request);
};

export const createIndexedDbRecordingChunkStore = ({ openDatabase = openRecordingDatabase } = {}) => {
  const withStore = async (storeName, mode, action) => {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, mode);
    const result = await action(transaction.objectStore(storeName));
    await transactionComplete(transaction);
    return result;
  };
  const chunkKey = (sessionId, sequence) => `${sessionId}:${String(sequence).padStart(8, '0')}`;

  const getManifest = (sessionId) => withStore(
    RECORDING_MANIFEST_STORE,
    'readonly',
    (store) => requestResult(store.get(sessionId)),
  );
  const putManifest = (manifest) => withStore(
    RECORDING_MANIFEST_STORE,
    'readwrite',
    async (store) => { await requestResult(store.put(manifest)); return manifest; },
  );
  const putChunk = (chunk) => {
    const record = { ...chunk, key: chunkKey(chunk.sessionId, chunk.sequence) };
    return withStore(RECORDING_CHUNK_STORE, 'readwrite', async (store) => {
      await requestResult(store.put(record));
      return record;
    });
  };
  const listChunks = (sessionId) => withStore(
    RECORDING_CHUNK_STORE,
    'readonly',
    (store) => requestResult(store.index('sessionId').getAll(sessionId)),
  ).then((chunks) => chunks.sort((left, right) => left.sequence - right.sequence));
  const updateChunk = async (sessionId, sequence, patch) => {
    const key = chunkKey(sessionId, sequence);
    return withStore(RECORDING_CHUNK_STORE, 'readwrite', async (store) => {
      const current = await requestResult(store.get(key));
      if (!current) return null;
      const updated = { ...current, ...patch };
      await requestResult(store.put(updated));
      return updated;
    });
  };
  const deleteChunk = (sessionId, sequence) => withStore(
    RECORDING_CHUNK_STORE,
    'readwrite',
    (store) => requestResult(store.delete(chunkKey(sessionId, sequence))),
  );
  const resetUploading = async (sessionId) => {
    const chunks = await listChunks(sessionId);
    await Promise.all(chunks.filter((chunk) => chunk.state === 'uploading')
      .map((chunk) => updateChunk(sessionId, chunk.sequence, { state: 'pending' })));
  };

  return { getManifest, putManifest, putChunk, listChunks, updateChunk, deleteChunk, resetUploading };
};

export const indexedDbRecordingChunkStore = createIndexedDbRecordingChunkStore();
