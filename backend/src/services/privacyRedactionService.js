/**
 * File responsibility: Deterministic privacy redaction.
 * Main responsibilities:
 * - Minimize common personal data before storing redacted text variants.
 * - Keep business-critical raw text unchanged where existing workflows need it.
 */

const REDACTION_RULES = [
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    pattern: /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    pattern: /\b(?:https?:\/\/|www\.)\S+\b/gi,
    replacement: '[REDACTED_URL]',
  },
  {
    pattern: /\b(?:token|api[_-]?key|secret|password)\s*[:=]\s*\S+/gi,
    replacement: '[REDACTED_SECRET]',
  },
];

export const redactSensitiveText = (value = '') => {
  let redacted = String(value || '');
  for (const rule of REDACTION_RULES) {
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }
  return redacted;
};

export const hasRedactedSensitiveText = (value = '') =>
  redactSensitiveText(value) !== String(value || '');
