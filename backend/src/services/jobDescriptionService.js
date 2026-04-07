import { callDeepSeek } from './deepseekService.js';
import { buildJdRubricSchema, buildRequirementItem } from './scoringSchemaService.js';
import { buildTaxonomyItem, canonicalizeRole, inferRoleLevel, mergeUniqueLabels } from './taxonomyService.js';

const ROLE_KEYWORDS = /engineer|developer|manager|designer|analyst|architect|consultant|specialist|intern|scientist|administrator/i;
const TECH_SKILL_PATTERN = /\b(react|node\.?js|typescript|javascript|python|java|aws|azure|gcp|docker|kubernetes|sql|testing|api|graphql|tailwind|html|css|excel|power bi|tableau|data analysis|machine learning|deep learning|hadoop|spark|statistics|pandas|numpy|tensorflow|pytorch)\b/gi;
const SOFT_SKILL_PATTERN = /\b(communication|stakeholder management|stakeholder communication|teamwork|collaboration|leadership|problem solving|adaptability|accountability|ownership|willingness to learn|learning mindset|attention to detail|time management|customer service)\b/gi;
const MACRO_CRITERIA_HINTS = [
  ['technical expertise', /technical|engineering|development|software|data|analytics|tool|platform|sql|python|cloud/i],
  ['communication', /communication|stakeholder|present|written|verbal/i],
  ['leadership', /lead|leadership|mentor|manage|ownership/i],
  ['experience', /experience|years|background|proven|track record/i],
];

const normalizeWhitespace = (text = '') =>
  text.replace(/\r/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const toLines = (text = '') => normalizeWhitespace(text).split('\n').map((line) => line.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
const unique = (items) => [...new Set((items || []).filter(Boolean))];
const stripHeadingPrefix = (value = '') => value.replace(/^(responsibilities|what this job does|must have|nice to have|preferred|bonus|qualifications|about you|requirements)\s*:\s*/i, '').trim();
const cleanLineLabel = (line = '') => line.replace(/^[^:]+:\s*/, '').trim();
const firstMatchingLine = (lines, pattern) => lines.find((line) => pattern.test(line)) || '';

const collectMatchingLines = (lines, pattern, limit = 4) => {
  const matches = [];
  for (let index = 0; index < lines.length && matches.length < limit; index += 1) {
    const line = lines[index];
    if (!pattern.test(line)) continue;
    const cleaned = stripHeadingPrefix(cleanLineLabel(line) || line);
    if (cleaned) matches.push(cleaned);
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
      if (cleaned && cleaned !== line) items.push(...cleaned.split(/[,;•]/).map((item) => stripHeadingPrefix(item.trim())));
      continue;
    }
    if (collecting && stopPattern.test(line)) break;
    if (collecting) items.push(...line.split(/[,;•]/).map((item) => stripHeadingPrefix(item.trim())));
    if (items.length >= limit) break;
  }
  return unique(items.filter((item) => item.split(/\s+/).length <= 14)).slice(0, limit);
};

const collectSkillWords = (text = '') => unique((text.match(TECH_SKILL_PATTERN) || []).map((item) => item.toLowerCase())).slice(0, 14);
const collectSoftSkillWords = (text = '') => unique((text.match(SOFT_SKILL_PATTERN) || []).map((item) => item.toLowerCase())).slice(0, 10);

const safeJsonParse = (text) => {
  const fencedMatch = text?.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1] || text || '';
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
  return JSON.parse(candidate);
};

export const extractSkillsWithAI = async (rawJD) => {
  try {
    const prompt = `You are a strict job-description parser. Extract only what is clearly stated. Return JSON only.\nSchema: {"technicalSkills": string[], "softSkills": string[], "macroCriteria": string[], "requirements": string[]}\nJob description:\n${rawJD.slice(0, 4000)}`;
    const response = await callDeepSeek(prompt, 'Return valid JSON only.');
    const parsed = safeJsonParse(response);
    return {
      technicalSkillRequirements: Array.isArray(parsed.technicalSkills) ? parsed.technicalSkills : [],
      softSkillRequirements: Array.isArray(parsed.softSkills) ? parsed.softSkills : [],
      macroCriteria: Array.isArray(parsed.macroCriteria) ? parsed.macroCriteria : [],
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
    };
  } catch (error) {
    console.warn('AI skill extraction failed:', error.message);
    return { technicalSkillRequirements: [], softSkillRequirements: [], macroCriteria: [], requirements: [] };
  }
};

const deriveMacroCriteria = (rawJD, aiCriteria = []) => {
  const base = aiCriteria.map((label) => buildTaxonomyItem(label, { type: 'macro' }));
  const heuristic = MACRO_CRITERIA_HINTS.filter(([, pattern]) => pattern.test(rawJD)).map(([label]) => buildTaxonomyItem(label, { type: 'macro' }));
  return mergeUniqueLabels(base, heuristic);
};

const deriveRequirementItems = ({ mustHaveRequirements, niceToHaveExperience, qualifications, aiRequirements = [] }) => {
  const hardRequirements = mustHaveRequirements.map((label) => buildRequirementItem({ label, type: 'hard', importance: 'high' }));
  const qualificationRequirements = qualifications.slice(0, 4).map((label) => buildRequirementItem({ label, type: 'soft', importance: 'medium' }));
  const preferredRequirements = niceToHaveExperience.slice(0, 4).map((label) => buildRequirementItem({ label, type: 'soft', importance: 'low' }));
  const aiDerivedRequirements = aiRequirements.slice(0, 8).map((label) => buildRequirementItem({ label, type: 'soft', importance: 'medium' }));
  return unique([...hardRequirements, ...qualificationRequirements, ...preferredRequirements, ...aiDerivedRequirements].map((item) => JSON.stringify(item))).map((value) => JSON.parse(value));
};

const buildInterviewTargets = ({ roleCanonical, roleFamily, technicalSkillRequirements, softSkillRequirements, requirements }) => ({
  roleCanonical,
  roleFamily,
  technicalFocus: technicalSkillRequirements.slice(0, 6),
  behaviouralFocus: unique([
    ...softSkillRequirements.slice(0, 4),
    ...requirements.filter((item) => item.type !== 'hard').map((item) => item.label).slice(0, 2),
  ]).slice(0, 6),
  experienceFocus: requirements.filter((item) => /experience|years|background|project|production|stakeholder/i.test(item.label)).map((item) => item.label).slice(0, 5),
  prioritySkills: technicalSkillRequirements.slice(0, 8),
});

export const buildStructuredJobDescriptionRubric = async (rawJD) => {
  const lines = toLines(rawJD);
  const title = firstMatchingLine(lines.slice(0, 8), ROLE_KEYWORDS) || cleanLineLabel(firstMatchingLine(lines, /job title|role title|position title/i)) || 'Target Role';
  const roleInfo = canonicalizeRole(title, rawJD);
  const roleLevel = inferRoleLevel(rawJD);

  const responsibilities = unique([
    ...collectMatchingLines(lines, /responsib|you will|what you will do|about the role|day to day|primary responsibilities/i, 5),
    ...collectSectionItems(lines, /responsib|you will|what you will do|about the role|day to day|primary responsibilities/i, /qualif|requirements|must|preferred|skills|about you/i, 8),
  ]).slice(0, 8);
  const qualifications = unique([
    ...collectMatchingLines(lines, /qualif|degree|background|proven|experience in|experience with/i, 5),
    ...collectSectionItems(lines, /qualif|about you|what you bring/i, /responsib|requirements|must|preferred|skills/i, 8),
  ]).slice(0, 8);
  const mustHaveRequirements = unique([
    ...collectMatchingLines(lines, /must|required|essential/i, 6),
    ...collectSectionItems(lines, /must|required|essential/i, /preferred|bonus|nice to have|desirable/i, 8),
  ]).slice(0, 10);
  const niceToHaveExperience = unique([
    ...collectMatchingLines(lines, /nice to have|preferred|bonus|desirable/i, 5),
    ...collectSectionItems(lines, /nice to have|preferred|bonus|desirable/i, /application|benefits|how to apply/i, 6),
  ]).slice(0, 8);

  const aiSkills = await extractSkillsWithAI(rawJD);
  const technicalSkillRequirements = unique([...aiSkills.technicalSkillRequirements, ...collectSkillWords(rawJD)]).slice(0, 14);
  const softSkillRequirements = unique([...aiSkills.softSkillRequirements, ...collectSoftSkillWords(rawJD)]).filter((item) => !technicalSkillRequirements.includes(item)).slice(0, 10);

  const macroCriteria = deriveMacroCriteria(rawJD, aiSkills.macroCriteria);
  const microCriteria = mergeUniqueLabels(
    technicalSkillRequirements.map((label) => ({ label, type: 'micro', category: 'technical', weight: 1 })),
    softSkillRequirements.map((label) => ({ label, type: 'micro', category: 'behavioural', weight: 1 }))
  );
  const requirements = deriveRequirementItems({ mustHaveRequirements, niceToHaveExperience, qualifications, aiRequirements: aiSkills.requirements });
  const weights = {
    macro: Object.fromEntries((macroCriteria.length > 0 ? macroCriteria : deriveMacroCriteria(rawJD)).map((item) => [item.label, 1])),
    micro: Object.fromEntries(microCriteria.map((item) => [item.label, 1])),
    overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
  };
  const interviewTargets = buildInterviewTargets({
    roleCanonical: roleInfo.roleCanonical,
    roleFamily: roleInfo.roleFamily,
    technicalSkillRequirements,
    softSkillRequirements,
    requirements,
  });

  return buildJdRubricSchema({
    title,
    roleSummary: responsibilities.length > 0 ? responsibilities : ['Review the original JD text for the detailed role scope.'],
    responsibilities,
    qualifications,
    keywords: unique([...technicalSkillRequirements, ...softSkillRequirements, roleInfo.roleCanonical]),
    macroCriteria,
    microCriteria,
    requirements,
    weights,
    technicalSkillRequirements,
    softSkillRequirements,
    mustHaveRequirements,
    niceToHaveExperience,
    roleCanonical: roleInfo.roleCanonical,
    roleFamily: roleInfo.roleFamily,
    roleLevel,
    interviewTargets,
    metadata: {
      sourceLength: rawJD.length,
      confidence: rawJD.length > 150 ? 0.84 : 0.64,
      criteriaCount: macroCriteria.length + microCriteria.length,
      roleCanonical: roleInfo.roleCanonical,
      roleFamily: roleInfo.roleFamily,
      roleLevel,
    },
  });
};

const formatList = (items, fallback) => (Array.isArray(items) && items.length > 0 ? items.join('; ') : fallback);

export const formatStructuredJobDescription = (rubric) => [
  `1. Job Title: ${rubric.title || rubric.jobTitle || 'Target Role'}`,
  `2. Canonical Role: ${rubric.roleCanonical || rubric.metadata?.roleCanonical || 'target_role'}`,
  `3. Role Family / Level: ${(rubric.roleFamily || rubric.metadata?.roleFamily || 'general')} / ${(rubric.roleLevel || rubric.metadata?.roleLevel || 'mid')}`,
  `4. Role Summary: ${formatList(rubric.roleSummary, 'Review the original JD for the detailed role scope.')}`,
  `5. Macro Criteria: ${formatList((rubric.macroCriteria || []).map((item) => item.label), 'No clear macro criteria detected.')}`,
  `6. Micro Criteria: ${formatList((rubric.microCriteria || []).map((item) => item.label), 'No clear micro criteria detected.')}`,
  `7. Requirements: ${formatList((rubric.requirements || []).map((item) => `${item.label} [${item.type}]`), 'No explicit requirements detected.')}`,
  `8. Interview Targets: ${formatList(rubric.interviewTargets?.prioritySkills || [], 'No explicit priority interview targets detected.')}`,
].join('\n');
