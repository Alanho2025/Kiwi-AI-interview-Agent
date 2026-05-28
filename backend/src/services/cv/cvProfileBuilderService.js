/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: cvProfileBuilderService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { extractCvSections } from './cvSectionParser.js';
import { buildCvEvidenceProfile } from './cvEvidenceProfileBuilder.js';
import { buildCvAnalysis } from './cvAnalysisBuilderService.js';
import { CV_TECHNICAL_SKILLS } from './cvSkillTaxonomy.js';
import { normalizeTextWithSpaces } from '../../utils/commonHelpers.js';

const normalizeText = normalizeTextWithSpaces;
const normalizeLineBreaks = (text = '') => String(text || '').replace(/\r/g, '');

const extractCandidateName = (text = '') => {
  const firstLine = normalizeLineBreaks(text)
    .split('\n')
    .map((line) => normalizeText(line))
    .find(Boolean) || '';

  if (/^[A-Za-z][A-Za-z' -]{1,60}$/.test(firstLine) && firstLine.split(/\s+/).length <= 4) {
    return firstLine;
  }

  return 'Candidate';
};

const extractContactInfo = (text = '') => ({
  email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '',
  phone: text.match(/(?:\+?\d[\d\s()-]{7,}\d)/)?.[0] || '',
  location: text.match(/\b(?:Auckland|Wellington|Christchurch|Hamilton|New Zealand|NZ|Sydney|Melbourne|Taiwan)\b/i)?.[0] || '',
});

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const skillPattern = (alias = '') => {
  if (alias === 'node.js' || alias === 'node js') return /(^|[^a-z0-9+#.])node(?:\.js)?([^a-z0-9+#.]|$)/i;
  if (alias === 'api' || alias === 'apis') return /(^|[^a-z0-9+#.])apis?([^a-z0-9+#.]|$)/i;
  return new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(alias)}([^a-z0-9+#.]|$)`, 'i');
};

const extractSkillItems = (text = '') => {
  return CV_TECHNICAL_SKILLS
    .map((skill) => {
      const matchedIndexes = skill.aliases
        .map((alias) => text.search(skillPattern(alias)))
        .filter((index) => index >= 0);
      return matchedIndexes.length
        ? { skill, firstIndex: Math.min(...matchedIndexes) }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map(({ skill }) => skill)
    .map((skill) => ({
      label: skill.label,
      sourceType: 'taxonomy_keyword_match',
      confidence: 0.7,
    }));
};

const sectionTextByKey = (sections = [], key) => sections.find((section) => section.key === key)?.content || '';

const buildEvidenceMap = (sections = [], skillItems = []) => skillItems.map((skill) => {
  const sourceSection = sections.find((section) => section.content.toLowerCase().includes(String(skill.label || '').toLowerCase())) || null;
  return {
    label: skill.label,
    sourceSection: sourceSection?.key || 'full_text',
    sourceSnippet: sourceSection?.content.slice(0, 180) || '',
    confidence: skill.confidence,
  };
});

const buildWarnings = (sections = [], skillItems = []) => {
  const warnings = [];

  if (!sections.some((section) => section.key === 'experience')) {
    warnings.push('No clear experience section was detected from the uploaded CV.');
  }

  if (!sections.some((section) => section.key === 'skills')) {
    warnings.push('No dedicated skills section was detected, so skill extraction may be partial.');
  }

  if (!skillItems.length) {
    warnings.push('No common technical skills were confidently extracted from the current CV text.');
  }

  return warnings;
};

export const buildCvProfile = (text = '', options = {}) => {
  const normalizedText = normalizeLineBreaks(text);
  const sections = extractCvSections(normalizedText);
  const skillItems = extractSkillItems(normalizedText);
  const evidenceMap = buildEvidenceMap(sections, skillItems);
  const contact = extractContactInfo(normalizedText);

  const profile = {
    schemaVersion: 'cv_profile_v1',
    candidateName: extractCandidateName(normalizedText),
    rawLength: normalizedText.length,
    tokenCount: normalizedText.split(/\s+/).filter(Boolean).length,
    contact,
    personalStatement: sectionTextByKey(sections, 'personal_statement').slice(0, 800),
    summary: (sectionTextByKey(sections, 'summary') || sectionTextByKey(sections, 'personal_statement')).slice(0, 500),
    experience: sectionTextByKey(sections, 'experience').slice(0, 1200),
    education: sectionTextByKey(sections, 'education').slice(0, 800),
    projects: sectionTextByKey(sections, 'projects').slice(0, 1000),
    certifications: sectionTextByKey(sections, 'certifications').slice(0, 500),
    keyCompetencies: sectionTextByKey(sections, 'key_competencies').slice(0, 1000),
    volunteer: sectionTextByKey(sections, 'volunteer').slice(0, 600),
    skills: skillItems,
    sections,
    evidenceMap,
    parserMetadata: {
      ...(options.parserMetadata || {}),
      openSourceTools: {
        ...(options.parserMetadata?.openSourceTools || {}),
        ...(options.nlpSignals ? { spaCy: { enabled: true, used: true, model: options.nlpSignals.model } } : {}),
      },
    },
    warnings: buildWarnings(sections, skillItems),
    confidence: skillItems.length ? 0.72 : 0.48,
  };

  const evidenceProfile = buildCvEvidenceProfile(profile, normalizedText, {
    nlpSignals: options.nlpSignals,
  });

  return {
    ...profile,
    evidenceProfile,
    cvAnalysis: buildCvAnalysis({ cvProfile: profile, evidenceProfile, normalizedText }),
  };
};
