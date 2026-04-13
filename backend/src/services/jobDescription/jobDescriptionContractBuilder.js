import { buildJobDescriptionSignals } from './jobDescriptionSignals.js';
import { splitRequiredAndPreferred } from './jobDescriptionNormalizer.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const unique = (items = []) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

const readRubricRequirements = (rubric = {}) => ensureArray(rubric.requirements).map((item) => item?.label || item?.requirement || item?.text).filter(Boolean);

export const buildNormalizedJdRubric = (parsedJd = {}, session = {}) => {
  const requirementSplit = splitRequiredAndPreferred({
    requirements: readRubricRequirements(parsedJd),
    mustHaveRequirements: parsedJd.mustHaveRequirements,
    niceToHaveRequirements: parsedJd.niceToHaveExperience,
    requiredSkills: parsedJd.requiredSkills || parsedJd.technicalSkillRequirements,
    preferredSkills: parsedJd.preferredSkills,
  });

  const requiredSkills = unique([
    ...requirementSplit.required.map((item) => item.label),
    ...ensureArray(parsedJd.technicalSkillRequirements),
    ...ensureArray(parsedJd.mustHaveRequirements),
  ]);
  const preferredSkills = unique([
    ...requirementSplit.preferred.map((item) => item.label),
    ...ensureArray(parsedJd.niceToHaveExperience),
  ]);
  const requiredCapabilities = unique([
    ...ensureArray(parsedJd.softSkillRequirements),
    ...ensureArray(parsedJd.macroCriteria).map((item) => item?.label),
  ]);
  const preferredCapabilities = unique(ensureArray(parsedJd.microCriteria).map((item) => item?.label).filter(Boolean));

  const contract = {
    roleTitle: session.targetRole || parsedJd.title || parsedJd.jobTitle || 'Target Role',
    roleCanonical: parsedJd.roleCanonical || session.targetRole || parsedJd.title || parsedJd.jobTitle || 'general_role',
    roleFamily: parsedJd.roleFamily || '',
    seniority: parsedJd.roleLevel || parsedJd.seniority || 'unknown',
    requiredSkills,
    preferredSkills,
    requiredCapabilities,
    preferredCapabilities,
    experienceRequirements: unique(ensureArray(parsedJd.qualifications).filter((item) => /experience|year|years/i.test(String(item || '')))),
    educationRequirements: unique(ensureArray(parsedJd.qualifications).filter((item) => /degree|bachelor|master|phd|qualification/i.test(String(item || '')))),
    behaviouralSignals: unique(ensureArray(parsedJd.softSkillRequirements)),
    technicalFocus: unique(ensureArray(parsedJd.technicalSkillRequirements)),
    domainContext: unique([parsedJd.roleFamily, ...(parsedJd.roleSummary || [])]),
    scoringHints: unique(ensureArray(parsedJd.roleSummary).concat(ensureArray(parsedJd.mustHaveRequirements).slice(0, 3))),
    interviewTargets: unique(ensureArray(parsedJd.interviewTargets)),
    sourceMeta: {
      rubricSchemaVersion: parsedJd.schemaVersion || 'jd_rubric_v1',
      sourceLength: parsedJd.metadata?.sourceLength || 0,
      parserConfidence: parsedJd.metadata?.confidence || 0,
    },
  };

  const signals = buildJobDescriptionSignals(contract);
  return {
    ...contract,
    roleCanonical: signals.roleCanonical,
    roleFamily: signals.roleFamily,
    seniority: signals.seniority,
    technicalFocus: signals.technicalFocus,
    interviewTargets: signals.interviewTargets,
  };
};
