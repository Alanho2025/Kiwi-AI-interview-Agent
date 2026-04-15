
const unique = (items = []) => [...new Set((items || []).filter(Boolean))];

const cleanText = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/[•]/g, ' ')
  .trim();

const titleCase = (value = '') => value
  .split(' ')
  .filter(Boolean)
  .map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

export const pushEvidence = (map = {}, label = '', evidence = '') => {
  const cleanLabel = cleanText(label);
  const cleanEvidence = cleanText(evidence);
  if (!cleanLabel || !cleanEvidence) return;
  map[cleanLabel] = unique([...(map[cleanLabel] || []), cleanEvidence]);
};

export const collectMappedPoints = (text = '', mappings = [], evidenceMap = {}) => {
  const source = cleanText(text);
  if (!source) return [];
  const matches = [];
  for (const entry of mappings) {
    if (entry.patterns.some((pattern) => pattern.test(source))) {
      const labels = Array.isArray(entry.labels) ? entry.labels : [entry.label];
      for (const label of labels.filter(Boolean)) {
        matches.push(label);
        pushEvidence(evidenceMap, label, source);
      }
    }
  }
  return unique(matches);
};

export const fallbackPoint = (text = '', maxWords = 7) => {
  const source = cleanText(text)
    .replace(/^(?:we are looking for|we're looking for|you will|you'll|this role|responsibilities|requirements|benefits|application notes)\s*:?\s*/i, '')
    .replace(/^(?:strong|solid|proven|ability to|experience with|experience in|familiarity with)\s+/i, '')
    .replace(/[.;:,]+$/g, '');
  if (!source) return '';
  const words = source.split(' ').slice(0, maxWords);
  let phrase = words.join(' ')
    .replace(/^(?:and|or|with|for|to)\s+/i, '')
    .trim();
  phrase = phrase.replace(/\b(?:including|such as)\b.*$/i, '').trim();
  phrase = phrase.replace(/\b(?:experience|skills?)\b$/i, '').trim();
  return titleCase(phrase);
};

export const normalizeTextList = (items = [], toPoints) => {
  const evidenceMap = {};
  const points = unique(items.flatMap((item) => toPoints(item, evidenceMap)).filter(Boolean));
  return { points, evidenceMap };
};
