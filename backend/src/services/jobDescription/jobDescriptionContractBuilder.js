import { buildJobDescriptionSignals } from './jobDescriptionSignals.js';
import { splitRequiredAndPreferred } from './jobDescriptionNormalizer.js';
import { ensureArray, unique } from '../../utils/commonHelpers.js';


const readRubricRequirements = (rubric = {}) => ensureArray(rubric.requirements)
  .map((item) => ({
    label: item?.label || item?.requirement || item?.text,
    type: item?.type || '',
    importance: item?.importance || '',
  }))
  .filter((item) => item.label);

const readNormalizedSection = (parsedJd = {}, key = '') => ensureArray(parsedJd.sections?.[key] || parsedJd.normalized?.[key] || parsedJd[key]);
const readRawSection = (parsedJd = {}, key = '') => ensureArray(parsedJd.rawSections?.[key]);

const filterEducation = (items = []) => unique(items.filter((item) => /degree|bachelor|master|phd|qualification|tertiary/i.test(String(item || ''))));
const filterExperience = (items = []) => unique(items.filter((item) => /experience|year|years/i.test(String(item || ''))));

export const buildNormalizedJdRubric = (parsedJd = {}, session = {}) => {
  const rubricRequirements = readRubricRequirements(parsedJd);
  const explicitPreferred = unique([
    ...readNormalizedSection(parsedJd, 'niceToHaveRequirements'),
    ...ensureArray(parsedJd.niceToHaveExperience),
    ...readRawSection(parsedJd, 'niceToHaveRequirements'),
    ...rubricRequirements.filter((item) => item.type === 'soft').map((item) => item.label),
  ]);
  const explicitRequired = unique([
    ...readNormalizedSection(parsedJd, 'mustHaveRequirements'),
    ...ensureArray(parsedJd.mustHaveRequirements),
    ...ensureArray(parsedJd.technicalSkillRequirements),
    ...rubricRequirements.filter((item) => item.type === 'hard').map((item) => item.label),
  ]);

  const requirementSplit = splitRequiredAndPreferred({
    requirements: rubricRequirements.map((item) => item.label),
    mustHaveRequirements: explicitRequired,
    niceToHaveRequirements: explicitPreferred,
    requiredSkills: ensureArray(parsedJd.technicalSkillRequirements),
    preferredSkills: readNormalizedSection(parsedJd, 'niceToHaveRequirements'),
  });

  const preferredSkills = unique([
    ...readNormalizedSection(parsedJd, 'niceToHaveRequirements'),
    ...readRawSection(parsedJd, 'niceToHaveRequirements'),
    ...requirementSplit.preferred.map((item) => item.label),
  ]);
  const preferredNormalized = new Set(preferredSkills.map((item) => String(item || '').toLowerCase()));
  const requiredSkills = unique([
    ...ensureArray(parsedJd.technicalSkillRequirements),
    ...readNormalizedSection(parsedJd, 'mustHaveRequirements'),
    ...requirementSplit.required.map((item) => item.label),
  ].filter((item) => !preferredNormalized.has(String(item || '').toLowerCase())));
  const requiredCapabilities = unique([
    ...ensureArray(parsedJd.softSkillRequirements),
    ...ensureArray(parsedJd.macroCriteria).map((item) => item?.label),
  ]);
  const preferredCapabilities = unique(ensureArray(parsedJd.microCriteria).map((item) => item?.label).filter(Boolean));

  const combinedQualifications = unique([
    ...readNormalizedSection(parsedJd, 'qualifications'),
    ...ensureArray(parsedJd.qualifications),
    ...readRawSection(parsedJd, 'qualifications'),
  ]);

  const contract = {
    roleTitle: session.targetRole || parsedJd.title || parsedJd.jobTitle || parsedJd.jobOverview?.title || 'Target Role',
    roleCanonical: parsedJd.roleCanonical || session.targetRole || parsedJd.title || parsedJd.jobTitle || parsedJd.jobOverview?.title || 'general_role',
    roleFamily: parsedJd.roleFamily || parsedJd.roleFamilyDetail?.primary || '',
    seniority: parsedJd.roleLevel || parsedJd.seniority || 'unknown',
    requiredSkills,
    preferredSkills,
    requiredCapabilities,
    preferredCapabilities,
    experienceRequirements: filterExperience(combinedQualifications),
    educationRequirements: filterEducation(combinedQualifications),
    behaviouralSignals: unique(ensureArray(parsedJd.softSkillRequirements)),
    technicalFocus: unique(ensureArray(parsedJd.technicalSkillRequirements)),
    domainContext: unique([parsedJd.roleFamily, ...(parsedJd.roleSummary || [])]),
    scoringHints: unique(ensureArray(parsedJd.roleSummary).concat(readNormalizedSection(parsedJd, 'mustHaveRequirements').slice(0, 3))),
    interviewTargets: unique(ensureArray(parsedJd.interviewTargets)),
    sourceMeta: {
      rubricSchemaVersion: parsedJd.schemaVersion || 'jd_rubric_v1',
      sourceLength: parsedJd.metadata?.sourceLength || 0,
      parserConfidence: parsedJd.metadata?.parserSelfConfidence || parsedJd.metadata?.confidence || 0,
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
