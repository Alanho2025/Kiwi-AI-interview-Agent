/**
 * File responsibility: ASR transcript normalization.
 * Main responsibilities:
 * - Apply conservative, domain-safe corrections after speech recognition.
 * - Preserve the user's meaning and avoid essay-style rewriting.
 * - Return structured correction metadata for debugging and UI display.
 */

import { collapseSpacing } from '../../utils/textNormalizers.js';
import { SAFE_REPLACEMENTS } from '../../config/transcriptReplacements.js';

export function normalizeTranscript(rawText = '') {
  const originalText = collapseSpacing(String(rawText || ''));
  let normalizedText = originalText;
  const corrections = [];

  for (const [pattern, replacement] of SAFE_REPLACEMENTS) {
    const before = normalizedText;
    normalizedText = normalizedText.replace(pattern, replacement);
    if (before !== normalizedText) {
      corrections.push({ pattern: String(pattern), replacement });
    }
  }

  normalizedText = collapseSpacing(normalizedText);

  return {
    rawText: originalText,
    normalizedText,
    changed: originalText !== normalizedText,
    corrections,
  };
}

// Made with Bob
