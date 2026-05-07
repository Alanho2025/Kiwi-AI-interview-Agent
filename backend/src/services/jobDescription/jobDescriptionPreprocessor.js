import { normalizeInlineWhitespace, normalizeWhitespacePreservingLines } from './utils/normalizationUtils.js';

const cleanBrokenWordJoins = (text = '') => String(text || '')
  .replace(/([A-Za-z])-\n([A-Za-z])/g, '$1$2')
  .replace(/\bpost\s*\n\s*graduate\b/gi, 'post graduate')
  .replace(/\bfull\s*\n\s*time\b/gi, 'full time')
  .replace(/\bpart\s*\n\s*time\b/gi, 'part time');

const detectBlockType = (line = '') => {
  if (!line) return 'paragraph';
  if (/^[•*-]/.test(line)) return 'bullet';
  if (/^[A-Z][A-Za-z0-9 '&/()-]+\??$/.test(line) && line.length <= 90) return 'heading';
  return 'paragraph';
};

export const preprocessJobDescriptionText = (rawText = '') => {
  const repaired = cleanBrokenWordJoins(rawText);
  const normalizedText = normalizeWhitespacePreservingLines(repaired);
  const rawLines = normalizedText.split('\n').map((line) => normalizeInlineWhitespace(line.trim()));
  const lines = rawLines.filter(Boolean);
  const flatText = normalizeInlineWhitespace(lines.join(' '));

  const blocks = lines.map((line, index) => ({
    id: `block-${index + 1}`,
    text: line.replace(/^[•*-]\s*/, '').trim(),
    rawText: line,
    type: detectBlockType(line),
    lineStart: index + 1,
    lineEnd: index + 1,
  }));

  return {
    rawText: String(rawText || ''),
    repairedText: repaired,
    normalizedText,
    flatText,
    lines,
    blocks,
  };
};
