const normalize = (value = '') => String(value || '').toLowerCase();
const containsKeyword = (items = [], keyword = '') =>
  items.some((item) => normalize(item).includes(normalize(keyword)));

const collectRequirementText = (rubric) => [
  ...(rubric.sections?.responsibilities || []),
  ...(rubric.sections?.mustHaveRequirements || []),
  ...(rubric.sections?.niceToHaveRequirements || []),
  ...(rubric.sections?.qualifications || []),
];

const collectBucketLabels = (items = []) => items.map((item) => item.label || item.name || String(item || ''));

export const scoreJdParseCase = (rubric, expected = {}) => {
  let earned = 0;
  let possible = 0;
  const checks = [];
  const requirementText = collectRequirementText(rubric);
  const dataSkills = collectBucketLabels(rubric.sections?.technicalSkills?.data || []);
  const infraSkills = collectBucketLabels(rubric.sections?.technicalSkills?.itInfrastructure || []);
  const commonEngineeringSkills = collectBucketLabels(rubric.sections?.technicalSkills?.commonEngineering || []);
  const softSkills = rubric.sections?.softSkills || [];

  const pushCheck = (label, passed) => {
    possible += 1;
    if (passed) earned += 1;
    checks.push({ label, passed });
  };

  if (expected.title) pushCheck('title', rubric.jobOverview?.title === expected.title);
  if (expected.companyName) pushCheck('companyName', rubric.jobOverview?.companyName === expected.companyName);
  if (expected.employmentType) pushCheck('employmentType', normalize(rubric.jobOverview?.employmentType) === normalize(expected.employmentType));
  if (expected.roleFamily) pushCheck('roleFamily', rubric.roleFamily === expected.roleFamily);
  if (expected.roleLevel) pushCheck('roleLevel', rubric.roleLevel === expected.roleLevel);

  for (const keyword of expected.responsibilityKeywords || []) {
    pushCheck(`responsibility:${keyword}`, containsKeyword(rubric.sections?.responsibilities || [], keyword));
  }
  for (const keyword of expected.mustHaveKeywords || []) {
    pushCheck(`mustHave:${keyword}`, containsKeyword(rubric.sections?.mustHaveRequirements || [], keyword) || containsKeyword(requirementText, keyword));
  }
  for (const keyword of expected.niceToHaveKeywords || []) {
    pushCheck(`niceToHave:${keyword}`, containsKeyword(rubric.sections?.niceToHaveRequirements || [], keyword));
  }
  for (const keyword of expected.benefitKeywords || []) {
    pushCheck(`benefit:${keyword}`, containsKeyword(rubric.sections?.benefits || [], keyword));
  }
  for (const keyword of expected.applicationKeywords || []) {
    pushCheck(`application:${keyword}`, containsKeyword(rubric.sections?.applicationInstructions || [], keyword));
  }
  for (const skill of expected.dataSkills || []) {
    pushCheck(`dataSkill:${skill}`, dataSkills.includes(skill));
  }
  for (const skill of expected.infrastructureSkills || []) {
    pushCheck(`infraSkill:${skill}`, infraSkills.includes(skill));
  }
  for (const skill of expected.commonEngineeringSkills || []) {
    pushCheck(`commonEngineering:${skill}`, commonEngineeringSkills.includes(skill));
  }
  for (const skill of expected.softSkills || []) {
    pushCheck(`softSkill:${skill}`, softSkills.includes(skill));
  }

  for (const keyword of expected.mustNotAppearInMustHave || []) {
    pushCheck(`mustNotAppearInMustHave:${keyword}`, !containsKeyword(rubric.sections?.mustHaveRequirements || [], keyword));
  }
  for (const keyword of expected.mustNotAppearInBenefits || []) {
    pushCheck(`mustNotAppearInBenefits:${keyword}`, !containsKeyword(rubric.sections?.benefits || [], keyword));
  }
  for (const keyword of expected.mustNotAppearInQualifications || []) {
    pushCheck(`mustNotAppearInQualifications:${keyword}`, !containsKeyword(rubric.sections?.qualifications || [], keyword));
  }
  for (const keyword of expected.mustNotAppearInDataSkills || []) {
    pushCheck(`mustNotAppearInDataSkills:${keyword}`, !dataSkills.some((item) => normalize(item) === normalize(keyword)));
  }

  return {
    earned,
    possible,
    score: possible ? Number((earned / possible).toFixed(2)) : 1,
    checks,
  };
};
