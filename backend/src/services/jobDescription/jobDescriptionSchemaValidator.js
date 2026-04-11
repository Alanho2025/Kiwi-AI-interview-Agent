const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureObject = (value, fallback = {}) => (value && typeof value === 'object' && !Array.isArray(value) ? value : fallback);

export const validateJobDescriptionRubric = (rubric = {}) => ({
  ...rubric,
  roleSummary: ensureArray(rubric.roleSummary),
  responsibilities: ensureArray(rubric.responsibilities),
  qualifications: ensureArray(rubric.qualifications),
  technicalSkillRequirements: ensureArray(rubric.technicalSkillRequirements),
  softSkillRequirements: ensureArray(rubric.softSkillRequirements),
  mustHaveRequirements: ensureArray(rubric.mustHaveRequirements),
  niceToHaveExperience: ensureArray(rubric.niceToHaveExperience),
  interviewTargets: ensureObject(rubric.interviewTargets),
  metadata: ensureObject(rubric.metadata),
  sections: ensureObject(rubric.sections, {
    introduction: [], responsibilities: [], qualifications: [], mustHaveRequirements: [], niceToHaveRequirements: [], technicalSkills: {}, softSkills: [], benefits: [], companyContext: [], applicationInstructions: [],
  }),
  diagnostics: ensureObject(rubric.diagnostics, { warnings: [] }),
});
