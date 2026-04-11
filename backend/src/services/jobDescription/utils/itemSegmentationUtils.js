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

export const segmentBlockItems = (blockText = '') => {
  const normalized = normalizeInlineWhitespace(blockText);
  if (!normalized) return [];
  if (normalized.includes(';')) return splitOutsideParentheses(normalized, ';');
  return [normalized];
};
