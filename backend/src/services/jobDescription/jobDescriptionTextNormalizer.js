import { cleanBulletPrefix, normalizeInlineWhitespace, normalizeWhitespacePreservingLines } from './utils/normalizationUtils.js';

const detectBlockType = (line = '') => {
  if (!line) return 'paragraph';
  if (/^[A-Z][A-Za-z0-9 '&/()\-]+\??$/.test(line) && line.length <= 80) return 'heading';
  if (/^[•\-*]/.test(line)) return 'bullet';
  return 'paragraph';
};

export const normalizeJobDescriptionText = (rawText = '') => {
  const normalizedText = normalizeWhitespacePreservingLines(rawText);
  const rawLines = normalizedText.split('\n').map((line) => line.trim());
  const lines = rawLines.filter(Boolean);
  const blocks = [];

  lines.forEach((line, index) => {
    const original = line;
    const blockType = detectBlockType(original);
    const cleanedText = normalizeInlineWhitespace(blockType === 'bullet' ? cleanBulletPrefix(original) : original);
    blocks.push({
      id: `block-${index + 1}`,
      text: cleanedText,
      rawText: original,
      type: blockType,
      lineStart: index + 1,
      lineEnd: index + 1,
    });
  });

  return { normalizedText, lines, blocks };
};
