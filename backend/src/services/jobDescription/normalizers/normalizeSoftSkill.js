
import { collectMappedPoints } from './bluepointShared.js';

const SOFT_MAPPINGS = [
  { label: 'Communication', patterns: [/communication/i] },
  { label: 'Collaboration', patterns: [/collabor/i, /team/i] },
  { label: 'Problem Solving', patterns: [/problem.solv/i] },
  { label: 'Adaptability', patterns: [/adaptable|switching gears/i] },
  { label: 'Ownership', patterns: [/ownership|self-driven|autonom/i] },
  { label: 'Curiosity', patterns: [/curious|curiosity|inquisitive/i] },
  { label: 'Organisation', patterns: [/organi[sz]ed|methodical|priorit/i] },
  { label: 'Learning Mindset', patterns: [/learning|growth mindset/i] },
  { label: 'Strategic Thinking', patterns: [/strategic/i] },
];

export const normalizeSoftSkillPoints = (items = [], evidenceMap = {}) => {
  const labels = [];
  for (const item of items || []) {
    const text = typeof item === 'string' ? item : item?.label || item?.name || item?.text || '';
    labels.push(...collectMappedPoints(text, SOFT_MAPPINGS, evidenceMap));
  }
  return [...new Set(labels)];
};
