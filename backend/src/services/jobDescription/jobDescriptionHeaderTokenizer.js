const FIELD_LABELS = [
  'company',
  'employment type',
  'location',
  'salary',
  'contract type',
  'job type',
];

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FIELD_PATTERN = new RegExp(`\\b(${FIELD_LABELS.map(escapeRegex).join('|')})\\s*:`, 'ig');

export const tokenizeJobDescriptionHeaderLines = (lines = []) => {
  const tokens = [];
  for (const line of lines) {
    const text = String(line || '').trim();
    if (!text) continue;

    const matches = [...text.matchAll(FIELD_PATTERN)];
    if (matches.length <= 1) {
      tokens.push(text);
      continue;
    }

    for (let index = 0; index < matches.length; index += 1) {
      const start = matches[index].index ?? 0;
      const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
      const segment = text.slice(start, end).trim().replace(/[.;]\s*$/g, '').trim();
      if (segment) tokens.push(segment);
    }
  }
  return tokens;
};
