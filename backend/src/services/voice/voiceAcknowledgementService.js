import { callDeepSeek } from '../deepseekService.js';

const ACKNOWLEDGEMENT_TIMEOUT_MS = Number(process.env.VOICE_ACKNOWLEDGEMENT_TIMEOUT_MS || 2200);

const cleanAcknowledgement = (value = '') => String(value || '')
  .replace(/```[a-z]*|```/gi, '')
  .replace(/^["'`]+|["'`]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const withTimeout = (promise, timeoutMs) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Voice acknowledgement timed out after ${timeoutMs}ms`)), timeoutMs);
  }),
]);

const buildPrompt = ({ session = {}, transcriptText = '', asrConfidence = null } = {}) => `You are KiwiCoach, a natural voice interviewer.

The candidate just answered. Generate ONE short spoken acknowledgement before the next question.

Important:
- The acknowledgement MUST respond to the candidate's answer content.
- Do NOT always mention CV, JD, resume, or profile.
- Do NOT use a fixed template.
- Do NOT ask a question.
- Do NOT score or judge the answer.
- Do NOT say "great answer" every time.
- Keep it natural, like a human interviewer thinking briefly.
- Maximum 16 words.
- Return plain text only.

Good examples:
- "Thanks, that gives me a useful starting point."
- "I see the direction you are taking there."
- "That helps me understand your project context."
- "Okay, I will connect that to the role requirements."
- "Thanks, I am thinking through the evidence you gave."
- "That is useful context for the next part."

Bad examples:
- "Thanks, let me check your CV."
- "Great answer!"
- "Can you explain more?"
- Any JSON.

Context:
${JSON.stringify({
  role: session?.targetRole || session?.interviewPlan?.jobTitle || '',
  latestCandidateAnswer: String(transcriptText || '').slice(0, 700),
  asrConfidence,
}, null, 2)}

Return only the acknowledgement text.`;

const isBadAcknowledgement = (text = '') => {
  const clean = String(text || '').trim();
  if (!clean) return true;
  if (clean.includes('?')) return true;
  if (clean.split(/\s+/).length > 20) return true;
  if (/^\s*\{/.test(clean)) return true;
  if (/let me (look at|check|review) (that )?(against )?(your )?(cv|resume)/i.test(clean)) return true;
  return false;
};

export const generateVoiceMicroAcknowledgement = async ({
  session = {},
  transcriptText = '',
  asrConfidence = null,
  vad = null,
} = {}) => {
  const cleanTranscript = String(transcriptText || '').trim();
  if (!cleanTranscript) return '';

  try {
    const response = await withTimeout(callDeepSeek(
      buildPrompt({ session, transcriptText: cleanTranscript, asrConfidence, vad }),
      'Return one varied, answer-aware spoken acknowledgement only. Plain text. No question. No JSON.',
      {
        usageMetadata: {
          stage: 'interview',
          operation: 'llm_text',
          feature: 'voice_micro_acknowledgement',
        },
      },
    ), ACKNOWLEDGEMENT_TIMEOUT_MS);

    const acknowledgement = cleanAcknowledgement(response?.content);
    if (isBadAcknowledgement(acknowledgement)) {
      return '';
    }

    return acknowledgement.split(/\s+/).slice(0, 20).join(' ');
  } catch {
    return '';
  }
};
