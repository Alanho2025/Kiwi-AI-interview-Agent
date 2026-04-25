/**
 * File responsibility: Voice domain phrase configuration.
 * Main responsibilities:
 * - Keep interview-specific ASR hints out of transport and Azure SDK code.
 * - Provide a safe default phrase list for technical and NZ interview terms.
 * - Allow later extension from CV/JD-derived skills without changing the STT service.
 */

export const GLOBAL_INTERVIEW_PHRASES = [
  'React',
  'React Query',
  'TanStack Query',
  'Vite',
  'Node.js',
  'Express.js',
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'REST API',
  'JWT',
  'OAuth',
  'RAG',
  'LLM',
  'vLLM',
  'Azure Speech',
  'DeepSeek',
  'University of Auckland',
  'UoA',
  'New Zealand',
  'Auckland',
  'Te Tiriti o Waitangi',
  'Tall Poppy Syndrome',
  'STAR method',
  'Agile',
  'Scrum',
  'frontend',
  'backend',
  'full stack',
  'CV',
  'JD',
];

const cleanPhrase = (value) => String(value || '').trim();

export function buildSpeechPhraseList(extraPhrases = []) {
  return Array.from(new Set([...GLOBAL_INTERVIEW_PHRASES, ...extraPhrases].map(cleanPhrase).filter(Boolean)));
}
