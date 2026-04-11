export const normalizeSmartQuotes = (value = '') => value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

export const normalizeWhitespacePreservingLines = (value = '') =>
  normalizeSmartQuotes(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const cleanBulletPrefix = (value = '') => value.replace(/^[•\-*]+\s*/, '').trim();

export const normalizeInlineWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim();

export const toSentenceCaseLabel = (value = '') => normalizeInlineWhitespace(value);

export const lowerIncludesAny = (text = '', terms = []) => {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(String(term).toLowerCase()));
};
