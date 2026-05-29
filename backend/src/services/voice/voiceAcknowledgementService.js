import { callDeepSeek } from '../deepseekService.js';

const DEFAULT_ACKNOWLEDGEMENT = 'Thanks, let me look at that against your CV for a moment.';

const ACKNOWLEDGEMENT_TIMEOUT_MS = Number(process.env.VOICE_ACKNOWLEDGEMENT_TIMEOUT_MS || 1500);

const cleanAcknowledgement = (value = '') => String(value || '')
  .replace(/^["'`]+|["'`]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const withTimeout = (promise, timeoutMs) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Voice acknowledgement timed out after ${timeoutMs}ms`)), timeoutMs);
  }),
]);

const buildPrompt = ({ session = {}, transcriptText = '', asrConfidence = null } = {}) => `You are a voice interview coach.

Write ONE short spoken acknowledgement before the next interview question is generated.

Rules:
- Use natural spoken English.
- Maximum 14 words.
- Do not ask a question.
- Do not score the candidate.
- Do not invent facts.
- It may mention checking the CV or thinking briefly.
- Keep it suitable for a New Zealand interview practice flow.

Context:
${JSON.stringify({
  role: session?.targetRole || session?.interviewPlan?.jobTitle || '',
  candidateAnswer: String(transcriptText || '').slice(0, 600),
  asrConfidence,
}, null, 2)}

Return only the acknowledgement text.`;

export const generateVoiceMicroAcknowledgement = async ({
  session = {},
  transcriptText = '',
  asrConfidence = null,
  vad = null,
} = {}) => {
  const cleanTranscript = String(transcriptText || '').trim();
  if (!cleanTranscript) return DEFAULT_ACKNOWLEDGEMENT;

  try {
    const response = await withTimeout(callDeepSeek(
      buildPrompt({ session, transcriptText: cleanTranscript, asrConfidence, vad }),
      'Return one short spoken acknowledgement only. No JSON. No question.',
      {
        usageMetadata: {
          stage: 'interview',
          operation: 'llm_text',
          feature: 'voice_micro_acknowledgement',
        },
      },
    ), ACKNOWLEDGEMENT_TIMEOUT_MS);

    const acknowledgement = cleanAcknowledgement(response?.content);
    if (!acknowledgement || acknowledgement.includes('?')) {
      return DEFAULT_ACKNOWLEDGEMENT;
    }

    return acknowledgement.split(/\s+/).slice(0, 18).join(' ');
  } catch {
    return DEFAULT_ACKNOWLEDGEMENT;
  }
};
