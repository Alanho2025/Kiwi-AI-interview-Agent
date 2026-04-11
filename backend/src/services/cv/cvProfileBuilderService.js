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

const COMMON_SKILLS = [
  'python', 'java', 'javascript', 'typescript', 'react', 'node', 'express', 'sql', 'postgresql', 'mongodb',
  'aws', 'docker', 'git', 'html', 'css', 'tailwind', 'machine learning', 'data analysis', 'power bi',
  'excel', 'api', 'rest', 'agile', 'scrum', 'testing', 'pytest', 'jest', 'pandas', 'numpy', 'spark',
];

const normalizeText = (text = '') => String(text || '').replace(/\s+/g, ' ').trim();
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

const extractSkillItems = (text = '') => {
  const lowerText = text.toLowerCase();
  return COMMON_SKILLS.filter((skill) => lowerText.includes(skill)).map((skill) => ({
    label: skill,
    sourceType: 'keyword_match',
    confidence: 0.7,
  }));
};

const sectionTextByKey = (sections = [], key) => sections.find((section) => section.key === key)?.content || '';

const buildEvidenceMap = (sections = [], skillItems = []) => skillItems.map((skill) => {
  const sourceSection = sections.find((section) => section.content.toLowerCase().includes(skill.label)) || null;
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

export const buildCvProfile = (text = '') => {
  const normalizedText = normalizeLineBreaks(text);
  const sections = extractCvSections(normalizedText);
  const skillItems = extractSkillItems(normalizedText);
  const evidenceMap = buildEvidenceMap(sections, skillItems);
  const contact = extractContactInfo(normalizedText);

  return {
    schemaVersion: 'cv_profile_v1',
    candidateName: extractCandidateName(normalizedText),
    rawLength: normalizedText.length,
    tokenCount: normalizedText.split(/\s+/).filter(Boolean).length,
    contact,
    summary: sectionTextByKey(sections, 'summary').slice(0, 500),
    experience: sectionTextByKey(sections, 'experience').slice(0, 1200),
    education: sectionTextByKey(sections, 'education').slice(0, 800),
    projects: sectionTextByKey(sections, 'projects').slice(0, 1000),
    certifications: sectionTextByKey(sections, 'certifications').slice(0, 500),
    skills: skillItems,
    sections,
    evidenceMap,
    warnings: buildWarnings(sections, skillItems),
    confidence: skillItems.length ? 0.72 : 0.48,
  };
};
