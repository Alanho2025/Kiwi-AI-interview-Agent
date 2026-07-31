import { normalizeText } from '../../utils/commonHelpers.js';

/**
 * File responsibility: Build safe deterministic confirmation prompts for low-confidence transcripts.
 * Implements 2-level confirmation policy:
 * - Specific term confirmation for strong single matches ("Did you mean 'Databricks'?")
 * - Neutral restatement for weak/ambiguous matches ("Could you repeat the tool name?") to avoid Answer Priming.
 */

const truncateTranscript = (text = '', maxLength = 180) => {
  const clean = normalizeText(text);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}...`;
};

export const buildTwoLevelTranscriptConfirmationPrompt = ({
  transcriptText = '',
  termCorruption = null,
  matchStrength = null,
  ambiguityCount = 1,
} = {}) => {
  const preview = truncateTranscript(transcriptText);

  // Level 1: Strong single term corruption match
  if (termCorruption?.candidateTerm && (matchStrength === 'strong' || termCorruption.matchStrength === 'strong') && ambiguityCount <= 1) {
    return `Just to confirm, did you mean '${termCorruption.candidateTerm}'?`;
  }

  // Level 2: Weak match or ambiguous multiple candidates (Neutral Restatement to avoid Answer Priming)
  if (termCorruption?.candidateTerm || ambiguityCount > 1 || matchStrength === 'weak') {
    return 'I may have misheard one tool or system name. Could you briefly repeat the specific tool or technology name?';
  }

  // Level 3: General low-confidence preview confirmation
  if (!preview) {
    return 'I may not have heard that clearly. Could you repeat your answer?';
  }

  return `I may not have heard every word perfectly. I heard: "${preview}". Did I understand that correctly?`;
};

export const buildTranscriptConfirmationPrompt = (transcriptText = '', options = {}) => {
  if (typeof transcriptText === 'object' && transcriptText !== null) {
    return buildTwoLevelTranscriptConfirmationPrompt(transcriptText);
  }
  return buildTwoLevelTranscriptConfirmationPrompt({
    transcriptText,
    termCorruption: options?.termCorruption || null,
    matchStrength: options?.matchStrength || null,
    ambiguityCount: options?.ambiguityCount || 1,
  });
};
