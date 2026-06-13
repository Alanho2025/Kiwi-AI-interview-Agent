/**
 * File responsibility: Session recording API helpers.
 * Main responsibilities:
 * - Upload raw browser voice recordings for backend MP3 conversion.
 * - Download the final user-facing MP3 file.
 * - Keep recording endpoints separate from interview turn APIs.
 */

import { apiClient, buildApiUrl, getStoredAuthToken } from './client.js';

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

  return apiClient(`/recordings/session-audio/${sessionId}/status`, {
    method: 'GET',
  });
};
