/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: interviewApi should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { apiClient, apiClientStream } from './client.js';

/**
 * Purpose: Execute the main responsibility for startInterview.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const startInterview = (sessionId) => apiClient('/interview/start', { method: 'POST', body: { sessionId } });
export const replyInterview = (sessionId, answer) => apiClient('/interview/reply', { method: 'POST', body: { sessionId, answer } });
export const repeatQuestion = (sessionId) => apiClient('/interview/repeat', { method: 'POST', body: { sessionId } });
/**
 * Purpose: Execute the main responsibility for pauseInterview.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const pauseInterview = (sessionId) => apiClient('/interview/pause', { method: 'POST', body: { sessionId } });
export const resumeInterview = (sessionId) => apiClient('/interview/resume', { method: 'POST', body: { sessionId } });
export const endInterview = (sessionId) => apiClient('/interview/end', { method: 'POST', body: { sessionId } });

export const replyInterviewWithVoice = ({ sessionId, audioFile, language = 'en-NZ', voiceName = 'en-NZ-MollyNeural', durationMs = null }) => {
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  formData.append('audio', audioFile);
  formData.append('language', language);
  formData.append('voiceName', voiceName);
  if (durationMs != null) formData.append('durationMs', String(durationMs));
  return apiClient('/interview/voice-reply', { method: 'POST', body: formData });
};

export const replyInterviewWithRealtimeVoice = ({
  sessionId,
  transcriptText,
  language = 'en-NZ',
  voiceName = 'en-NZ-MollyNeural',
  asrConfidence = null,
  asrSource = 'azure_realtime',
  inputMode = 'realtime_voice',
  vad = null,
}) => apiClient('/interview/realtime-voice-turn', {
  method: 'POST',
  body: {
    sessionId,
    transcriptText,
    language,
    voiceName,
    asrConfidence,
    asrSource,
    inputMode,
    vad,
  },
});

export const synthesizeInterviewText = (sessionId, text, voiceName = 'en-NZ-MollyNeural') => apiClient('/interview/synthesize', { method: 'POST', body: { sessionId, text, voiceName } });

export const replyInterviewWithRealtimeVoiceStream = async (params, onAudioChunk) => {
  const token = localStorage.getItem('kiwi_auth_token') || localStorage.getItem('authToken');
  const response = await apiClientStream('/interview/realtime-voice-turn-stream', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: params,
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'audio' && onAudioChunk) {
            onAudioChunk(data.base64, data.index);
          } else if (data.type === 'done') {
            finalResult = data.result;
          }
        } catch (e) {
          console.error('Failed to parse SSE data', e);
        }
      }
    }
  }
  return finalResult;
};
