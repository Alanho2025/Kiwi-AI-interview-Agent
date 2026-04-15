
import { collectMappedPoints, fallbackPoint } from './bluepointShared.js';

const APPLICATION_MAPPINGS = [
  { label: 'Apply with CV', patterns: [/apply with your cv|include your cv|submit your cv/i] },
  { label: 'Cover Letter Required', patterns: [/cover letter/i] },
  { label: 'Academic Transcript Required', patterns: [/academic transcript/i] },
  { label: 'Apply Online', patterns: [/apply online/i, /hit apply/i] },
  { label: 'Reference Checks', patterns: [/reference checks?/i] },
  { label: 'Medical Screening', patterns: [/medical check|drug screening/i] },
  { label: 'NZ Work Rights Required', patterns: [/right to work in new zealand|work rights|citizenship|permanent residency/i] },
  { label: 'Recruitment Chat', patterns: [/schedule a chat|online chat/i] },
  { label: 'Application Deadline', patterns: [/applications close/i] },
  { label: 'Salary Expectation Question', patterns: [/expected salary/i] },
];

export const normalizeApplicationInstructionPoints = (item, evidenceMap = {}) => {
  const text = typeof item === 'string' ? item : item?.label || item?.text || '';
  const mapped = collectMappedPoints(text, APPLICATION_MAPPINGS, evidenceMap);
  if (mapped.length > 0) return mapped;
  const fallback = /apply/i.test(text) ? fallbackPoint(text, 5) : '';
  if (fallback) {
    evidenceMap[fallback] = [...new Set([...(evidenceMap[fallback] || []), text])];
    return [fallback];
  }
  return [];
};
