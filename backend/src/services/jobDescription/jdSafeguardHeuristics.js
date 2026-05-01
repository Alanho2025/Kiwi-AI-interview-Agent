/**
 * File responsibility: Deterministic fallback helpers for JD safeguard agents.
 * Main responsibilities:
 * - Give mock tests and no-key development mode stable field-level critique behaviour.
 * - Keep common Seek-style JD section boundaries available when DeepSeek is disabled.
 */

import { unique, normalizeWhitespace } from './jobDescriptionShared.js';

const SECTION_MARKERS = [
  { key: 'responsibilities', pattern: /^(?:the position includes the following duties|the position includes|duties|responsibilities|key responsibilities|what you(?:'|’)ll do|what you will do)\s*:?$/i },
  { key: 'coreRequirements', pattern: /^(?:we are seeking someone with|we are looking for someone with|requirements|core requirements|must have|essential requirements|what you(?:'|’)ll bring|what you bring)\s*:?$/i },
  { key: 'bonusRequirements', pattern: /^(?:pluses|bonus|bonus requirements|nice to have|preferred|desirable)\s*:?$/i },
  { key: 'benefits', pattern: /^(?:benefits|what we offer|why join us|what(?:'|’)s in it for you)\s*:?$/i },
];

const OVERVIEW_PATTERNS = [
  /^location\s*:\s*(.+)$/i,
  /^employment type\s*:\s*(.+)$/i,
  /^job type\s*:\s*(.+)$/i,
  /^contract type\s*:\s*(.+)$/i,
  /^salary\s*:\s*(.+)$/i,
  /^company\s*:\s*(.+)$/i,
];

const normalizeLine = (line = '') => line.replace(/^[•\-*]\s*/, '').trim();
const isBlank = (line = '') => !String(line || '').trim();
const isOverviewLine = (line = '') => OVERVIEW_PATTERNS.some((pattern) => pattern.test(line));
const markerForLine = (line = '') => SECTION_MARKERS.find((marker) => marker.pattern.test(normalizeLine(line)));

const shouldSkipSectionItem = (line = '') => {
  const text = normalizeLine(line);
  return !text || isOverviewLine(text) || Boolean(markerForLine(text));
};

export const extractSeekStyleSections = (rawJD = '') => {
  const lines = normalizeWhitespace(rawJD).split('\n').map((line) => line.trim());
  const sections = {
    responsibilities: [],
    coreRequirements: [],
    bonusRequirements: [],
    benefits: [],
  };
  let current = null;

  for (const line of lines) {
    if (isBlank(line)) continue;
    const marker = markerForLine(line);
    if (marker) {
      current = marker.key;
      continue;
    }
    if (!current || shouldSkipSectionItem(line)) continue;
    sections[current].push(normalizeLine(line));
  }

  return {
    responsibilities: unique(sections.responsibilities),
    coreRequirements: unique(sections.coreRequirements),
    bonusRequirements: unique(sections.bonusRequirements),
    benefits: unique(sections.benefits),
  };
};

const valueLooksLikeRequirement = (value = '') => /\b(?:months?|years?|experience|proficiency|python|sql|linux|command[- ]line|problem solving|degree|qualification)\b/i.test(value);
const hasCompanyEvidence = (rawJD = '') => /^company\s*:/im.test(rawJD) || /\b(?:about us|about the company)\b/i.test(rawJD);

const includesAny = (items = [], patterns = []) => items.some((item) => patterns.some((pattern) => pattern.test(item)));

export const buildHeuristicJdParseReview = ({ rawJD = '', parsedJD = {} } = {}) => {
  const sections = extractSeekStyleSections(rawJD);
  const parsedSections = parsedJD.sections || {};
  const overview = parsedJD.jobOverview || {};
  const issues = [];
  const reparseInstructions = [];

  if (overview.companyName && valueLooksLikeRequirement(overview.companyName) && !hasCompanyEvidence(rawJD)) {
    issues.push({
      field: 'jobOverview.companyName',
      severity: 'high',
      problem: 'The company field contains requirement text instead of an explicit company name.',
      action: 'Set companyName to an empty value or Not specified.',
    });
    reparseInstructions.push('Do not infer a company name. If the JD has no explicit company name, leave companyName empty.');
  }

  if (sections.responsibilities.length > 0 && (parsedSections.responsibilities || []).length === 0) {
    issues.push({
      field: 'sections.responsibilities',
      severity: 'high',
      problem: 'The duties or responsibilities section exists in the JD but was not extracted.',
      action: 'Extract the items below the duties/responsibilities heading.',
    });
    reparseInstructions.push('Extract responsibilities from the section after duties/responsibilities style headings.');
  }

  if (sections.bonusRequirements.length > 0 && (parsedSections.niceToHaveRequirements || []).length === 0) {
    issues.push({
      field: 'sections.niceToHaveRequirements',
      severity: 'high',
      problem: 'The Pluses, preferred, or nice-to-have section exists but was not extracted.',
      action: 'Move those items into niceToHaveRequirements.',
    });
    reparseInstructions.push('Extract pluses, preferred, nice-to-have, or bonus items into niceToHaveRequirements.');
  }

  const bonusPatterns = sections.bonusRequirements.map((item) => new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  if (bonusPatterns.length > 0 && includesAny(parsedSections.mustHaveRequirements || [], bonusPatterns)) {
    issues.push({
      field: 'sections.mustHaveRequirements',
      severity: 'high',
      problem: 'Bonus requirements were included as core requirements.',
      action: 'Remove pluses from mustHaveRequirements and keep them under niceToHaveRequirements.',
    });
    reparseInstructions.push('Do not include Pluses section items in core requirements.');
  }

  if ((parsedSections.mustHaveRequirements || []).some((item) => /\bOR\b|\bIN\b|\bOF\b/.test(item) && item === item.replace(/[a-z]/g, ''))) {
    issues.push({
      field: 'sections.mustHaveRequirements',
      severity: 'medium',
      problem: 'Requirement phrases appear to be split or title-cased incorrectly around OR/IN/OF.',
      action: 'Preserve the original requirement phrase from the JD.',
    });
    reparseInstructions.push('Preserve complete requirement phrases. Do not split phrases around or, in, or of.');
  }

  if (sections.coreRequirements.length > 0 && (parsedSections.mustHaveRequirements || []).length === 0) {
    issues.push({
      field: 'sections.mustHaveRequirements',
      severity: 'high',
      problem: 'The core requirements section exists in the JD but was not extracted.',
      action: 'Extract items below requirements or seeking-someone-with headings.',
    });
    reparseInstructions.push('Extract core requirements from the section after requirements or we are seeking someone with.');
  }

  return {
    verdict: issues.some((item) => item.severity === 'high') ? 'revise' : 'pass',
    confidence: issues.length ? 0.64 : 0.92,
    blockOutput: issues.length > 0,
    blockMatch: issues.length > 0,
    issues,
    reparseInstructions: unique(reparseInstructions),
    extractedSections: sections,
    reasoning: issues.length ? 'Heuristic safeguard found field-level JD parse drift.' : 'No major field-level drift found.',
  };
};
