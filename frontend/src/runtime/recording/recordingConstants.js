export const RECORDING_CHUNK_INTERVAL_MS = 4000;
export const RECORDING_DATABASE_NAME = 'kiwi-recording-uploads';
export const RECORDING_DATABASE_VERSION = 1;
export const RECORDING_CHUNK_STORE = 'chunks';
export const RECORDING_MANIFEST_STORE = 'manifests';

export const RECORDING_LATENCY_CRITICAL_STATES = new Set([
  'user_speaking',
  'stt_finalizing',
  'agent_thinking',
  'answer_processing',
  'ai_speaking',
  'assistant_speaking',
  'next_question_speaking',
]);
