import { normalizeInlineWhitespace } from './normalizationUtils.js';

const splitOutsideParentheses = (text = '', separator = ';') => {
  const items = [];
  let depth = 0;
  let current = '';

  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      items.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (current) items.push(current);
  return items.map((item) => normalizeInlineWhitespace(item)).filter(Boolean);
};

const protectKnownAbbreviations = (value = '') => String(value || '')
  .replace(/\be\.g\./gi, 'eg')
  .replace(/\bi\.e\./gi, 'ie');

export const segmentBlockItems = (blockText = '') => {
  const normalized = normalizeInlineWhitespace(blockText);
  if (!normalized) return [];
  if (normalized.includes(';')) return splitOutsideParentheses(normalized, ';');
  const protectedText = protectKnownAbbreviations(normalized);
  const sentenceParts = protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((item) => normalizeInlineWhitespace(item))
    .filter(Boolean);
  if (sentenceParts.length >= 2) return sentenceParts;
  return [normalized];
};
