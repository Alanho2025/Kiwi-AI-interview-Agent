
import { collectMappedPoints, fallbackPoint } from './bluepointShared.js';

const BENEFIT_MAPPINGS = [
  { label: 'Hybrid Work', patterns: [/hybrid/i] },
  { label: 'Remote Work', patterns: [/remote/i, /flexible work/i] },
  { label: 'Annual Bonus', patterns: [/bonus/i] },
  { label: 'Learning Budget', patterns: [/learning budget/i, /development budget/i] },
  { label: 'Learning and Development', patterns: [/learning and development|training and development|professional development/i] },
  { label: 'Wellbeing Subsidy', patterns: [/wellbeing subsidy/i] },
  { label: 'Insurance', patterns: [/insurance|income protection/i] },
  { label: 'Mentoring Support', patterns: [/mentoring/i] },
  { label: 'Supportive Culture', patterns: [/supportive|collaborative culture|open-minded team/i] },
  { label: 'Career Growth', patterns: [/career growth|grow with/i] },
  { label: 'Social Club', patterns: [/social club|team lunches/i] },
  { label: 'Auckland Office', patterns: [/auckland/i] },
];

export const normalizeBenefitPoints = (item, evidenceMap = {}) => {
  const text = typeof item === 'string' ? item : item?.label || item?.text || '';
  const mapped = collectMappedPoints(text, BENEFIT_MAPPINGS, evidenceMap);
  if (mapped.includes('Learning Budget')) return mapped.filter((label) => label !== 'Learning and Development');
  if (mapped.length > 0) return mapped;
  const fallback = fallbackPoint(text, 5);
  if (fallback) {
    evidenceMap[fallback] = [...new Set([...(evidenceMap[fallback] || []), text])];
    return [fallback];
  }
  return [];
};
