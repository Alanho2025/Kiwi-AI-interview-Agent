const ROLE_KEYWORDS = /engineer|developer|manager|designer|analyst|architect|consultant|specialist|intern/i;
const TECH_SKILL_PATTERN = /\b(react|node\.?js|typescript|javascript|python|java|aws|azure|gcp|docker|kubernetes|sql|testing|communication|leadership|agile|api|graphql|tailwind|html|css|excel|power bi|tableau|data analysis|machine learning)\b/gi;
const SOFT_SKILL_PATTERN = /\b(communication|stakeholder management|stakeholder communication|teamwork|collaboration|leadership|problem solving|adaptability|accountability|ownership|willingness to learn|learning mindset|attention to detail|time management)\b/gi;

const normalizeWhitespace = (text) =>
  text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const toLines = (text) =>
  normalizeWhitespace(text)
    .split('\n')
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);

const unique = (items) => [...new Set(items.filter(Boolean))];
const stripHeadingPrefix = (value) => value.replace(/^(responsibilities|what this job does|must have|nice to have|preferred|bonus|qualifications|about you)\s*:\s*/i, '').trim();

const firstMatchingLine = (lines, pattern) => lines.find((line) => pattern.test(line)) || '';

const cleanLineLabel = (line) => line.replace(/^[^:]+:\s*/, '').trim();

const collectMatchingLines = (lines, pattern, limit = 4) => {
  const matches = [];

  for (let index = 0; index < lines.length && matches.length < limit; index += 1) {
    const line = lines[index];
    if (!pattern.test(line)) {
      continue;
    }

    if (/:\s*$/.test(line) && lines[index + 1]) {
      matches.push(stripHeadingPrefix(`${cleanLineLabel(line) || line} ${lines[index + 1]}`.trim()));
      index += 1;
      continue;
    }

    matches.push(stripHeadingPrefix(cleanLineLabel(line) || line));
  }

  return unique(matches);
};

const collectSectionItems = (lines, headings, stopPattern, limit = 8) => {
  const items = [];
  let collecting = false;

  for (const line of lines) {
    if (headings.test(line)) {
      collecting = true;
      const cleaned = cleanLineLabel(line);
      if (cleaned && cleaned !== line) {
        items.push(...cleaned.split(/[,;•]/).map((item) => stripHeadingPrefix(item.trim())));
      }
      continue;
    }

    if (collecting && stopPattern.test(line)) {
      break;
    }

    if (collecting) {
      items.push(...line.split(/[,;•]/).map((item) => stripHeadingPrefix(item.trim())));
      if (items.length >= limit) {
        break;
      }
    }
  }

  return unique(items.filter((item) => item.split(/\s+/).length <= 12)).slice(0, limit);
};

const collectSkillWords = (text) => {
  const matches = text.match(TECH_SKILL_PATTERN) || [];
  return unique(matches.map((item) => item.toLowerCase())).slice(0, 12);
};

const collectSoftSkillWords = (text) => {
  const matches = text.match(SOFT_SKILL_PATTERN) || [];
  return unique(matches.map((item) => item.toLowerCase())).slice(0, 10);
};

const collectKeywords = (text) => {
  const lines = toLines(text);
  const candidates = [];

  for (const line of lines) {
    if (!/responsib|qualif|must|required|essential|preferred|bonus|experience|skills|knowledge|familiar/i.test(line)) {
      continue;
    }

    const cleaned = cleanLineLabel(line) || line;
    candidates.push(...cleaned.split(/[,;•]/).map((item) => item.trim()));
  }

  return unique(
    candidates
      .map((item) => stripHeadingPrefix(item))
      .filter((item) => item.length >= 4 && item.length <= 60)
  ).slice(0, 18);
};

export const buildStructuredJobDescriptionRubric = (rawJD) => {
  const lines = toLines(rawJD);
  const title =
    firstMatchingLine(lines.slice(0, 8), ROLE_KEYWORDS) ||
    cleanLineLabel(firstMatchingLine(lines, /job title|role title|position title/i)) ||
    'Target Role';

  const responsibilities = unique([
    ...collectMatchingLines(lines, /responsib|you will|what you will do|about the role|day to day/i, 4),
    ...collectSectionItems(lines, /responsib|you will|what you will do|about the role|day to day/i, /qualif|requirements|must|preferred|skills|about you/i, 6),
  ]).slice(0, 6);

  const qualifications = unique([
    ...collectMatchingLines(lines, /qualif|degree|background|proven|experience in|experience with/i, 4),
    ...collectSectionItems(lines, /qualif|about you|what you bring/i, /responsib|requirements|must|preferred|skills/i, 6),
  ]).slice(0, 6);

  const mustHaveRequirements = unique([
    ...collectMatchingLines(lines, /must|required|essential/i, 5),
    ...collectSectionItems(lines, /must|required|essential/i, /preferred|bonus|nice to have|desirable/i, 8),
  ]).slice(0, 8);

  const niceToHaveExperience = unique([
    ...collectMatchingLines(lines, /nice to have|preferred|bonus|desirable/i, 5),
    ...collectSectionItems(lines, /nice to have|preferred|bonus|desirable/i, /application|benefits|how to apply/i, 6),
  ]).slice(0, 6);

  const softSkillRequirements = unique([
    ...collectSoftSkillWords(rawJD),
    ...qualifications.flatMap((item) => collectSoftSkillWords(item)),
    ...mustHaveRequirements.flatMap((item) => collectSoftSkillWords(item)),
  ]).slice(0, 10);

  const technicalSkillRequirements = unique([
    ...collectSkillWords(rawJD),
    ...mustHaveRequirements.flatMap((item) => collectSkillWords(item)),
    ...qualifications.flatMap((item) => collectSkillWords(item)),
  ]).filter((item) => !softSkillRequirements.includes(item)).slice(0, 12);

  const neededSkills = unique([
    ...technicalSkillRequirements,
    ...softSkillRequirements,
  ]);

  const roleSummary = responsibilities.length > 0
    ? responsibilities
    : ['Review the original JD text for the detailed role scope.'];

  return {
    title,
    responsibilities,
    roleSummary,
    qualifications,
    neededSkills,
    softSkillRequirements,
    technicalSkillRequirements,
    mustHaveRequirements,
    niceToHaveExperience,
    keywords: collectKeywords(rawJD),
    sourceLength: rawJD.length,
  };
};

const formatList = (items, fallback) => (items.length > 0 ? items.join('; ') : fallback);

export const formatStructuredJobDescription = (rubric) => [
  `1. Job Title: ${rubric.title}`,
  `2. What this job does: ${formatList(rubric.roleSummary, 'Review the original JD for the detailed role scope.')}`,
  `3. Qualifications: ${formatList(rubric.qualifications, 'No explicit qualification section was clearly detected in the JD.')}`,
  `4. Related skill requirements: Technical - ${formatList(rubric.technicalSkillRequirements, 'No clear technical skills detected.')}; Soft - ${formatList(rubric.softSkillRequirements, 'No clear soft-skill expectations detected.')}`,
].join('\n');
