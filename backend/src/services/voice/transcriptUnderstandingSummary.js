import { normalizeText } from '../../utils/commonHelpers.js';
/**
 * File responsibility: Build safe deterministic confirmation prompts for low-confidence transcripts.
 * This helper intentionally avoids LLM calls so the voice repair path stays fast and predictable.
 */


const truncateTranscript = (text = '', maxLength = 180) => {
  const clean = normalizeText(text);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}...`;
};

export const buildTranscriptConfirmationPrompt = (transcriptText = '') => {
  const preview = truncateTranscript(transcriptText);
  if (!preview) {
    return 'I may not have heard that correctly. Could you repeat your answer?';
  }

  return `I may not have heard every word perfectly. I heard: "${preview}". Did I understand that correctly?`;
};
