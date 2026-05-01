import { collectMappedPoints, fallbackPoint } from './bluepointShared.js';

const BENEFIT_MAPPINGS = [
  { label: 'Competitive Remuneration', patterns: [/competitive remuneration|competitive salary|competitive pay/i] },
  { label: 'Flexible Working Arrangements', patterns: [/flexible working|flexible work/i] },
  { label: 'Wellbeing Initiatives', patterns: [/wellbeing initiatives?|well-being initiatives?|work-life balance/i] },
  { label: 'High-impact Projects', patterns: [/high-impact projects?|challenging projects?/i] },
  { label: 'Modern Tools and Technologies', patterns: [/modern tools|cutting edge|cutting-edge/i] },
  { label: 'Learning and Growth', patterns: [/learning, growth|learning and growth|learning|growth|develop your technical capability/i] },
  { label: 'Cross-industry Exposure', patterns: [/work across industries|across industries/i] },
  { label: 'Hybrid Work', patterns: [/hybrid/i] },
  { label: 'Remote Work', patterns: [/remote/i] },
  { label: 'Annual Bonus', patterns: [/bonus/i] },
  { label: 'Learning Budget', patterns: [/learning budget/i, /development budget/i] },
  { label: 'Insurance', patterns: [/insurance|income protection/i] },
  { label: 'Mentoring Support', patterns: [/mentoring/i] },
  { label: 'Supportive Culture', patterns: [/supportive|collaborative culture|collaborative and supportive|supportive environment|open-minded team/i] },
  { label: 'Career Growth', patterns: [/career growth|grow with/i] },
  { label: 'Social Club', patterns: [/social club|team lunches/i] },
  { label: 'Auckland Office', patterns: [/auckland/i] },
];

const shouldUseFallback = (text = '') => {
  if (!text || text.split(/\s+/).length > 12) return false;
  if (/\b(?:at|you(?:'|’)ll|we foster|opportunity to work|play a key role)\b/i.test(text)) return false;
  return true;
};

export const normalizeBenefitPoints = (item, evidenceMap = {}) => {
  const text = typeof item === 'string' ? item : item?.label || item?.text || '';
  const mapped = collectMappedPoints(text, BENEFIT_MAPPINGS, evidenceMap);
  if (mapped.includes('Learning Budget')) return mapped.filter((label) => label !== 'Learning and Growth');
  if (mapped.length > 0) return mapped;
  if (!shouldUseFallback(text)) return [];
  const fallback = fallbackPoint(text, 5);
  if (fallback) {
    evidenceMap[fallback] = [...new Set([...(evidenceMap[fallback] || []), text])];
    return [fallback];
  }
  return [];
};
