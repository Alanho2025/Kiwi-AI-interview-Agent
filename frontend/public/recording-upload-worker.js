const DATABASE_NAME = 'kiwi-recording-uploads';
const DATABASE_VERSION = 1;
const CHUNK_STORE = 'chunks';
const MANIFEST_STORE = 'manifests';
const SYNC_TAG = 'kiwi-recording-upload';

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionComplete = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = resolve;
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

const openDatabase = () => requestResult(indexedDB.open(DATABASE_NAME, DATABASE_VERSION));

const readAll = async (database, storeName) => {
  const transaction = database.transaction(storeName, 'readonly');
  const records = await requestResult(transaction.objectStore(storeName).getAll());
  await transactionComplete(transaction);
  return records;
};

const putRecord = async (database, storeName, record) => {
  const transaction = database.transaction(storeName, 'readwrite');
  await requestResult(transaction.objectStore(storeName).put(record));
  await transactionComplete(transaction);
};

const deleteRecord = async (database, storeName, key) => {
  const transaction = database.transaction(storeName, 'readwrite');
  await requestResult(transaction.objectStore(storeName).delete(key));
  await transactionComplete(transaction);
};

const loadCsrfToken = async () => {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!response.ok) throw new Error('Could not load CSRF token for recording sync');
  const payload = await response.json();
  return payload.data?.csrfToken || '';
};

const requestJson = async (url, { method, body, csrfToken }) => {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Recording sync request failed (${response.status})`);
  return (await response.json()).data;
};

const initializeManifest = async (database, manifest, csrfToken) => {
  if (manifest.uploadId) return manifest;
  const result = await requestJson('/api/recordings/session-audio/uploads', {
    method: 'POST',
    csrfToken,
    body: { sessionId: manifest.sessionId, mimeType: manifest.mimeType || 'audio/webm' },
  });
  const updated = { ...manifest, uploadId: result.uploadId };
  await putRecord(database, MANIFEST_STORE, updated);
  return updated;
};

const uploadChunk = async (database, manifest, chunk, csrfToken) => {
  const formData = new FormData();
  formData.append('checksum', chunk.checksum);
  formData.append('audio', chunk.blob, `recording-${chunk.sequence}.webm`);
  const response = await fetch(`/api/recordings/session-audio/uploads/${encodeURIComponent(manifest.uploadId)}/chunks/${chunk.sequence}`, {
    method: 'PUT',
    credentials: 'include',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    body: formData,
  });
  if (!response.ok) throw new Error(`Recording chunk sync failed (${response.status})`);
  await deleteRecord(database, CHUNK_STORE, chunk.key);
};

const syncRecordings = async () => {
  const database = await openDatabase();
  const csrfToken = await loadCsrfToken();
  const manifests = await readAll(database, MANIFEST_STORE);
  const allChunks = await readAll(database, CHUNK_STORE);
  for (const rawManifest of manifests) {
    const manifest = await initializeManifest(database, rawManifest, csrfToken);
    const chunks = allChunks
      .filter((chunk) => chunk.sessionId === manifest.sessionId)
      .sort((left, right) => left.sequence - right.sequence);
    for (const chunk of chunks) await uploadChunk(database, manifest, chunk, csrfToken);
    if (manifest.finalized && !manifest.remoteFinalized) {
      const result = await requestJson(`/api/recordings/session-audio/uploads/${encodeURIComponent(manifest.uploadId)}/finalize`, {
        method: 'POST',
        csrfToken,
        body: { totalChunks: manifest.totalChunks, totalBytes: manifest.totalBytes },
      });
      await putRecord(database, MANIFEST_STORE, { ...manifest, remoteFinalized: true, remoteState: result.state });
    }
  }
};

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(syncRecordings());
});
