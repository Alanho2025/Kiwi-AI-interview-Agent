/**
 * File responsibility: Deterministic fallback helpers for JD safeguard agents.
 * Main responsibilities:
 * - Give mock tests and no-key development mode stable field-level critique behaviour.
 * - Keep common Seek-style JD section boundaries available when DeepSeek is disabled.
 */

import { unique, normalizeWhitespace } from './jobDescriptionShared.js';

const SECTION_MARKERS = [
  { key: 'roleContext', pattern: /^(?:about the role|the role)\s*:?$/i },
  { key: 'companyContext', pattern: /^(?:about us|about the company|company overview|about (?!the role).+)\s*:?$/i },
  { key: 'responsibilities', pattern: /^(?:the position includes the following duties|the position includes|duties|responsibilities|key responsibilities|what you(?:'|’)ll be doing|what you will be doing|what you(?:'|’)ll do|what you will do)\s*:?$/i },
  { key: 'coreRequirements', pattern: /^(?:we are seeking someone with|we are looking for someone with|what we(?:'|’)re looking for|what we are looking for|requirements|core requirements|must have|essential requirements|what you(?:'|’)ll bring|what you bring)\s*:?$/i },
  { key: 'bonusRequirements', pattern: /^(?:pluses|bonus|bonus requirements|nice to have|preferred|desirable)\s*:?$/i },
  { key: 'benefits', pattern: /^(?:benefits|what we offer|why join us|what(?:'|’)s in it for you)\s*:?$/i },
  { key: 'stop', pattern: /^(?:employer questions|application questions|your application will include|how to apply|apply now)\s*:?$/i },
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

const normalizeForCompare = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim();

const overlapsRawEnough = (parsedItems = [], rawItems = []) => {
  if (!rawItems.length) return true;
  const parsedText = normalizeForCompare(parsedItems.join(' '));
  return rawItems.some((item) => {
    const words = normalizeForCompare(item).split(' ').filter((word) => word.length > 3).slice(0, 5);
    return words.length > 0 && words.every((word) => parsedText.includes(word));
  });
};

const hasSyntheticTitleCaseDrift = (items = []) => items.some((item) => /\b(?:AND|TO|OF|IN|THE)\b/.test(item) || /\(e\.g$/i.test(item));
const hasSentenceLikeDrift = (items = []) => items.some((item) => String(item || '').split(/\s+/).length > 10 && /\b(?:where|you(?:'|’)ll|combine|deliver|outcomes|experience|technologies)\b/i.test(item));

export const extractSeekStyleSections = (rawJD = '') => {
  const lines = normalizeWhitespace(rawJD).split('\n').map((line) => line.trim());
  const sections = {
    companyContext: [],
    roleContext: [],
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
      current = marker.key === 'stop' ? null : marker.key;
      continue;
    }
    if (!current || shouldSkipSectionItem(line)) continue;
    sections[current].push(normalizeLine(line));
  }

  return {
    companyContext: unique(sections.companyContext),
    roleContext: unique(sections.roleContext),
    responsibilities: unique(sections.responsibilities),
    coreRequirements: unique(sections.coreRequirements),
    bonusRequirements: unique(sections.bonusRequirements),
    benefits: unique(sections.benefits),
  };
};

const valueLooksLikeRequirement = (value = '') => /\b(?:months?|years?|experience|proficiency|python|sql|linux|command[- ]line|problem solving|degree|qualification)\b/i.test(value);
const valueLooksLikeNonCompany = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text.split(/\s+/).length > 8) return true;
  return /\b(?:hands-on|role|where|you(?:'|’)ll|combine|skills|client engagement|solving|outcomes|pipeline|stakeholder)\b/i.test(text);
};

const includesAny = (items = [], patterns = []) => items.some((item) => patterns.some((pattern) => pattern.test(item)));

export const buildHeuristicJdParseReview = ({ rawJD = '', parsedJD = {} } = {}) => {
  const sections = extractSeekStyleSections(rawJD);
  const parsedSections = parsedJD.sections || {};
  const overview = parsedJD.jobOverview || {};
  const issues = [];
  const reparseInstructions = [];

  if (overview.companyName && (valueLooksLikeRequirement(overview.companyName) || valueLooksLikeNonCompany(overview.companyName))) {
    issues.push({
      field: 'jobOverview.companyName',
      severity: 'high',
      problem: 'The company field contains role description or requirement text instead of a company name.',
      action: 'Extract the company from explicit company evidence, or leave companyName empty if unavailable.',
    });
    reparseInstructions.push('Do not infer a company name from role description sentences. Extract a company only from explicit evidence such as About us or a sentence like "at CompanyName".');
  }

  if (/^as\s+(?:a|an|the)\s+/i.test(overview.title || '')) {
    issues.push({
      field: 'jobOverview.title',
      severity: 'high',
      problem: 'The role title includes a sentence prefix such as "As a".',
      action: 'Remove the sentence prefix and keep only the role title.',
    });
    reparseInstructions.push('Clean role title prefixes such as "As a", "As an", or "As the".');
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

  if (sections.responsibilities.length > 0 && (parsedSections.responsibilities || []).length > 0 && (!overlapsRawEnough(parsedSections.responsibilities || [], sections.responsibilities) || hasSyntheticTitleCaseDrift(parsedSections.responsibilities || []))) {
    issues.push({
      field: 'sections.responsibilities',
      severity: 'high',
      problem: 'Responsibilities were transformed into generic labels or broken fragments instead of preserving the JD duty lines.',
      action: 'Re-extract responsibilities from the original responsibilities section and preserve complete phrases.',
    });
    reparseInstructions.push('Preserve complete responsibility lines from the original JD. Do not convert responsibilities into generic labels.');
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

  if (sections.coreRequirements.length > 0 && (parsedSections.mustHaveRequirements || []).length === 0) {
    issues.push({
      field: 'sections.mustHaveRequirements',
      severity: 'high',
      problem: 'The core requirements section exists in the JD but was not extracted.',
      action: 'Extract items below requirements or seeking-someone-with headings.',
    });
    reparseInstructions.push('Extract core requirements from the section after requirements, what we are looking for, or we are seeking someone with.');
  }

  if (sections.coreRequirements.length > 0 && (parsedSections.mustHaveRequirements || []).length > 0 && (!overlapsRawEnough(parsedSections.mustHaveRequirements || [], sections.coreRequirements) || hasSyntheticTitleCaseDrift(parsedSections.mustHaveRequirements || []))) {
    issues.push({
      field: 'sections.mustHaveRequirements',
      severity: 'high',
      problem: 'Core requirements were transformed into short labels or broken fragments instead of preserving requirement lines.',
      action: 'Re-extract core requirements from the original requirements section and preserve complete phrases.',
    });
    reparseInstructions.push('Preserve complete core requirement lines from the original JD. Do not split at e.g. or parentheses.');
  }

  if (hasSentenceLikeDrift(parsedSections.benefits || [])) {
    issues.push({
      field: 'sections.benefits',
      severity: 'medium',
      problem: 'Benefits contain generic long company-description fragments rather than concise benefit items.',
      action: 'Extract only concrete benefits such as competitive remuneration, flexible working, wellbeing, learning, or growth.',
    });
    reparseInstructions.push('Keep benefits concise. Extract concrete offer items only.');
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
