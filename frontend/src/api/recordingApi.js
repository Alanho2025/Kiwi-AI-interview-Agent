/**
 * File responsibility: Session recording API helpers.
 * Main responsibilities:
 * - Upload raw browser voice recordings for backend MP3 conversion.
 * - Download the final user-facing MP3 file.
 * - Keep recording endpoints separate from interview turn APIs.
 */

import { apiClient, apiPost, buildApiUrl, getStoredAuthToken } from './client.js';

const buildDownloadHeaders = () => {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const readDownloadErrorMessage = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return response.text();
  }

  const payload = await response.json();
  return payload.error?.details || payload.message || payload.msg || 'Could not download recording.';
};

export const uploadSessionRecording = async ({ sessionId, audioBlob }) => {
  if (!sessionId || !audioBlob) return null;

  const formData = new FormData();
  formData.append('sessionId', sessionId);
  formData.append('audio', audioBlob, `session-${sessionId}.webm`);

  return apiClient('/recordings/session-audio', {
    method: 'POST',
    body: formData,
  });
};

export const downloadSessionRecording = async (sessionId) => {
  if (!sessionId) throw new Error('Missing session ID.');

  const response = await fetch(buildApiUrl(`/recordings/session-audio/${sessionId}/download`), {
    method: 'GET',
    credentials: 'include',
    headers: buildDownloadHeaders(),
  });

  if (!response.ok) {
    const message = await readDownloadErrorMessage(response);
    throw new Error(message || 'Could not download recording.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `interview-session-${sessionId}.mp3`;
  anchor.click();
  URL.revokeObjectURL(url);
};


export const getSessionRecordingStatus = async (sessionId) => {
  if (!sessionId) return { available: false, status: 'missing' };

  const result = await apiClient(`/recordings/session-audio/${sessionId}/status`, {
    method: 'GET',
  });
  const state = result?.state || result?.status || (result?.available ? 'ready' : 'missing');
  const totalBytes = Number(result?.totalBytes || 0);
  const receivedBytes = Number(result?.receivedBytes || 0);
  return {
    ...result,
    state,
    available: Boolean(result?.available),
    progressPercent: totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : null,
  };
};

export const initializeRecordingUpload = ({ sessionId, mimeType }) => apiPost(
  '/recordings/session-audio/uploads',
  { sessionId, mimeType },
);

export const uploadRecordingChunk = ({ uploadId, sequence, checksum, blob }) => {
  const formData = new FormData();
  formData.append('checksum', checksum);
  formData.append('audio', blob, `recording-${sequence}.webm`);
  return apiClient(`/recordings/session-audio/uploads/${encodeURIComponent(uploadId)}/chunks/${sequence}`, {
    method: 'PUT',
    body: formData,
  });
};

export const finalizeRecordingUpload = ({ uploadId, totalChunks, totalBytes }) => apiPost(
  `/recordings/session-audio/uploads/${encodeURIComponent(uploadId)}/finalize`,
  { totalChunks, totalBytes },
);

export const retryRecordingUpload = (uploadId) => apiPost(
  `/recordings/session-audio/uploads/${encodeURIComponent(uploadId)}/retry`,
  {},
);

export const getRecordingUploadStatus = (uploadId) => apiClient(
  `/recordings/session-audio/uploads/${encodeURIComponent(uploadId)}/status`,
  { method: 'GET' },
);
