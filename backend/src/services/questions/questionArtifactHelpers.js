import crypto from 'crypto';
import { ensureArray, normalizeKey, normalizeText, tokenize, unique } from '../../utils/commonHelpers.js';

export const questionRetentionDate = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

export const clampWeight = (value, fallback = 0.5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

export const stableQuestionId = (prefix, parts = []) => {
  const normalized = parts.map((part) => normalizeKey(part).replace(/[^a-z0-9]+/g, '-')).filter(Boolean).join('|');
  const hash = crypto.createHash('sha1').update(normalized || crypto.randomUUID()).digest('hex').slice(0, 12);
  return `${prefix}_${hash}`;
};

export const normalizeTopicKey = (value = '') => tokenize(value).slice(0, 8).join(' ');

export const compactEvidenceRefs = (items = []) => ensureArray(items)
  .slice(0, 4)
  .map((item) => {
    if (typeof item === 'string') return { text: item.slice(0, 220) };
    return {
      sourceType: item?.sourceType || item?.type || '',
      projectTitle: item?.projectTitle || item?.title || '',
      text: normalizeText(item?.summary || item?.text || item?.evidence || '').slice(0, 220),
    };
  })
  .filter((item) => item.text || item.projectTitle || item.sourceType);

export const extractTextList = (...values) => unique(values.flatMap((value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      return item?.label || item?.name || item?.title || item?.skill || item?.requirement || item?.text || item?.summary || '';
    });
  }
  if (typeof value === 'object') {
    return [value.label, value.name, value.title, value.skill, value.requirement, value.text, value.summary].filter(Boolean);
  }
  return [value];
}));

export const buildModeCompatibility = (category = '') => {
  const normalizedCategory = normalizeKey(category);
  return {
    technical: ['technical', 'role_competency', 'closing', 'opening', 'motivation'].includes(normalizedCategory),
    behavioural: ['behavioural', 'behavioral', 'closing', 'opening', 'motivation'].includes(normalizedCategory),
    combined: true,
  };
};

export const normalizeCategory = (value = '') => {
  const key = normalizeKey(value);
  if (key === 'behavioral') return 'behavioural';
  if (key.includes('behaviour')) return 'behavioural';
  if (key.includes('technical')) return 'technical';
  if (key.includes('opening')) return 'opening';
  if (key.includes('motivation')) return 'motivation';
  if (key.includes('closing') || key.includes('wrap')) return 'closing';
  if (key.includes('role')) return 'role_competency';
  return key || 'experience';
};
