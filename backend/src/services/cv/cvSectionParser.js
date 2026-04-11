/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: cvSectionParser should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

const SECTION_LABELS = [
  { key: 'summary', patterns: [/^summary$/i, /^profile$/i, /^professional summary$/i, /^about me$/i] },
  { key: 'experience', patterns: [/^experience$/i, /^work experience$/i, /^employment$/i, /^professional experience$/i] },
  { key: 'projects', patterns: [/^projects$/i, /^project experience$/i] },
  { key: 'education', patterns: [/^education$/i, /^academic background$/i, /^qualifications$/i] },
  { key: 'skills', patterns: [/^skills$/i, /^technical skills$/i, /^core skills$/i, /^competencies$/i] },
  { key: 'certifications', patterns: [/^certifications$/i, /^certificates$/i, /^licenses$/i] },
  { key: 'achievements', patterns: [/^achievements$/i, /^awards$/i, /^accomplishments$/i] },
];

const normalizeLine = (line = '') => String(line || '').replace(/\s+/g, ' ').trim();

const findSectionKey = (line = '') => {
  const normalized = normalizeLine(line);
  return SECTION_LABELS.find((section) => section.patterns.some((pattern) => pattern.test(normalized)))?.key || null;
};

const buildFallbackSection = (text = '') => ({
  key: 'full_text',
  title: 'Full Text',
  content: text.trim(),
  lineCount: text.split('\n').filter((line) => line.trim()).length,
});

export const extractCvSections = (text = '') => {
  const lines = String(text || '').split('\n');
  const sections = [];
  let currentSection = null;

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (!line) {
      continue;
    }

    const sectionKey = findSectionKey(line);
    if (sectionKey) {
      currentSection = {
        key: sectionKey,
        title: line,
        contentLines: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      currentSection = {
        key: 'header',
        title: 'Header',
        contentLines: [],
      };
      sections.push(currentSection);
    }

    currentSection.contentLines.push(line);
  }

  const normalizedSections = sections
    .map((section) => ({
      key: section.key,
      title: section.title,
      content: section.contentLines.join('\n').trim(),
      lineCount: section.contentLines.length,
    }))
    .filter((section) => section.title || section.content);

  return normalizedSections.length ? normalizedSections : [buildFallbackSection(text)];
};
