/**
 * File responsibility: Text processing and sanitization utilities.
 * Main responsibilities:
 * - HTML and whitespace normalization.
 * - Bullet character unification.
 * - Text verification and corruption guards.
 * - No side effects, no state, no I/O.
 */

export const removeHtmlTags = (description) => {
  if (!description) return '';

  return String(description)
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(li|p|div|br)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
};

export const normalizeWhitespace = (text) => {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const normalizeBullets = (text) => {
  return String(text || '')
    .replace(/[•●○◦▪▸►◆★✦✓✔→‣⁃]/g, '•')
    .replace(/^[-–—]\s/gm, '• ')
    .replace(/^\*\s/gm, '• ');
};

export const validateText = (
  text,
  minCharCount = 200,
  maxCharCount = 50000,
  contextLabel = 'Content'
) => {
  if (!text || String(text).trim().length === 0) {
    return {
      isValid: false,
      error: {
        code: 'NO_CONTENT',
        message: `${contextLabel} appears to be empty or contains only whitespace`,
      },
    };
  }

  const textStr = String(text);

  if (textStr.length < minCharCount) {
    return {
      isValid: false,
      error: {
        code: 'TOO_SHORT',
        message: `${contextLabel} is too short. Found ${textStr.length} characters, minimum required: ${minCharCount} characters.`,
        details: {
          characterCount: textStr.length,
          minCharCount,
        },
      },
    };
  }

  if (textStr.length > maxCharCount) {
    return {
      isValid: false,
      error: {
        code: 'TOO_LONG',
        message: `${contextLabel} is too long. Found ${textStr.length} characters, maximum allowed: ${maxCharCount} characters.`,
        details: {
          characterCount: textStr.length,
          maxCharCount,
        },
      },
    };
  }

  // Check for corruption - consecutive special characters
  const MAX_CONSECUTIVE_SPECIAL_CHARS = 20;
  const specialCharPattern = new RegExp(
    `[^a-zA-Z0-9\\s]{${MAX_CONSECUTIVE_SPECIAL_CHARS + 1},}`
  );
  if (specialCharPattern.test(textStr)) {
    return {
      isValid: false,
      error: {
        code: 'CORRUPTED',
        message: `${contextLabel} appears to be corrupted. Found excessive consecutive special characters.`,
        details: {
          maxConsecutiveSpecialChars: MAX_CONSECUTIVE_SPECIAL_CHARS,
        },
      },
    };
  }

  return { isValid: true };
};

const SCORES_RE = /SCORES:\s*match=(\d+)\s+recommendation=(strong|good|partial|weak)/i;

const RECOMMENDATION_LABELS = {
  strong: 'strong',
  good: 'good',
  partial: 'partial',
  weak: 'weak',
};

export function parseJobMatch(raw) {
  const text = String(raw || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  const match = text.match(SCORES_RE);

  let scores;
  if (match) {
    const matchScore = Math.max(0, Math.min(100, Number(match[1])));
    scores = {
      matchScore,
      recommendation: RECOMMENDATION_LABELS[match[2].toLowerCase()] || 'partial',
    };
  }

  let body = match
    ? text.replace(match[0], '')
    : text.replace(/^\s*SCORES:[^\n]*(\n|$)/i, '');
  body = body.replace(/^\s+/, '');

  return { scores, body };
}
