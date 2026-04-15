const normalize = (value = '') => String(value || '').toLowerCase();
const containsKeyword = (items = [], keyword = '') => items.some((item) => normalize(item).includes(normalize(keyword)));
const toLabels = (items = []) => items.map((item) => item.label || item.name || String(item || ''));
const flattenSkills = (technicalSkills = {}) => Object.fromEntries(Object.entries(technicalSkills).map(([key, value]) => [key, toLabels(value)]));

const collectRequirementText = (rubric) => [
  ...(rubric.sections?.responsibilities || []),
  ...(rubric.sections?.mustHaveRequirements || []),
  ...(rubric.sections?.niceToHaveRequirements || []),
  ...(rubric.sections?.qualifications || []),
];

const partialMatch = (labels = [], expected = '') => labels.some((label) => normalize(label) === normalize(expected) || normalize(label).includes(normalize(expected)) || normalize(expected).includes(normalize(label)));
const average = (values = []) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1;

const toLegacyShape = (expected = {}) => {
  const skills = {};
  if (expected.dataSkills?.length) skills.data = expected.dataSkills;
  if (expected.softwareDevelopmentSkills?.length) skills.softwareDevelopment = expected.softwareDevelopmentSkills;
  if (expected.aiSkills?.length) skills.aiMl = expected.aiSkills;
  if (expected.infrastructureSkills?.length) skills.itInfrastructure = expected.infrastructureSkills;
  if (expected.commonEngineeringSkills?.length) skills.commonEngineering = expected.commonEngineeringSkills;

  return {
    title: expected.title,
    companyName: expected.companyName,
    employmentType: expected.employmentType,
    roleFamily: expected.roleFamily,
    roleLevel: expected.roleLevel === 'intern' ? 'graduate' : expected.roleLevel,
    skills,
    requirements: {
      mustHaveKeywords: [
        ...(expected.responsibilityKeywords || []),
        ...(expected.mustHaveKeywords || []),
      ],
      niceToHaveKeywords: expected.niceToHaveKeywords || [],
    },
    benefitKeywords: expected.benefitKeywords || [],
    applicationKeywords: expected.applicationKeywords || [],
    guards: {
      mustNotAppearInMustHave: expected.mustNotAppearInMustHave || [],
      mustNotAppearInBenefits: expected.mustNotAppearInBenefits || [],
      mustNotAppearInQualifications: expected.mustNotAppearInQualifications || [],
    },
    softSkills: expected.softSkills || [],
  };
};

export const scoreJdParseCase = (rubric, inputExpected = {}, weights = {}) => {
  const expected = inputExpected.requirements || inputExpected.skills || inputExpected.guards || inputExpected.weights ? inputExpected : toLegacyShape(inputExpected);

  let earned = 0;
  let possible = 0;
  const fieldScores = {};
  const failedChecks = [];
  const checks = [];
  const requirementText = collectRequirementText(rubric);
  const skills = flattenSkills(rubric.sections?.technicalSkills || {});

  const addField = (field, score, weight = 0) => {
    const rounded = Number(score.toFixed(2));
    fieldScores[field] = rounded;
    earned += rounded * weight;
    possible += weight;
    checks.push({ label: field, passed: rounded >= 1, score: rounded });
    if (rounded < 1) failedChecks.push(field);
  };

  const exact = (actual, want) => normalize(actual) === normalize(want) ? 1 : 0;
  if (expected.title) addField('title', exact(rubric.jobOverview?.title, expected.title), weights.title || 0.1);
  if (expected.companyName) addField('companyName', exact(rubric.jobOverview?.companyName, expected.companyName), weights.companyName || 0.08);
  if (expected.employmentType) addField('employmentType', exact(rubric.jobOverview?.employmentType, expected.employmentType), weights.employmentType || 0.04);
  if (expected.roleFamily) addField('roleFamily', exact(rubric.roleFamily, expected.roleFamily), weights.roleFamily || 0.12);
  if (expected.roleLevel) addField('roleLevel', exact(rubric.roleLevel, expected.roleLevel), weights.roleLevel || 0.08);

  const skillFamilies = expected.skills || {};
  const skillChecks = [];
  for (const [family, expectedItems] of Object.entries(skillFamilies)) {
    for (const item of expectedItems) skillChecks.push(partialMatch(skills[family] || [], item) ? 1 : 0);
  }
  if (expected.softSkills?.length) {
    const soft = rubric.sections?.softSkills || [];
    for (const item of expected.softSkills) skillChecks.push(partialMatch(soft, item) ? 1 : 0);
  }
  if (skillChecks.length) addField('skills', average(skillChecks), weights.skills || 0.24);

  const requirementChecks = [];
  for (const item of expected.requirements?.mustHaveKeywords || []) requirementChecks.push(containsKeyword(requirementText, item) ? 1 : 0);
  for (const item of expected.requirements?.niceToHaveKeywords || []) requirementChecks.push(containsKeyword(rubric.sections?.niceToHaveRequirements || [], item) ? 1 : 0);
  if (requirementChecks.length) addField('requirements', average(requirementChecks), weights.requirements || 0.2);

  const benefitChecks = (expected.benefitKeywords || []).map((item) => containsKeyword(rubric.sections?.benefits || [], item) ? 1 : 0);
  if (benefitChecks.length) addField('benefits', average(benefitChecks), weights.benefits || 0.08);

  const applicationChecks = (expected.applicationKeywords || []).map((item) => containsKeyword(rubric.sections?.applicationInstructions || [], item) ? 1 : 0);
  if (applicationChecks.length) addField('application', average(applicationChecks), weights.application || 0.05);

  const guardChecks = [];
  for (const item of expected.guards?.mustNotAppearInMustHave || []) guardChecks.push(!containsKeyword(rubric.sections?.mustHaveRequirements || [], item) ? 1 : 0);
  for (const item of expected.guards?.mustNotAppearInBenefits || []) guardChecks.push(!containsKeyword(rubric.sections?.benefits || [], item) ? 1 : 0);
  for (const item of expected.guards?.mustNotAppearInQualifications || []) guardChecks.push(!containsKeyword(rubric.sections?.qualifications || [], item) ? 1 : 0);
  if (guardChecks.length) addField('noiseControl', average(guardChecks), weights.noiseControl || 0.05);

  const criticalFields = ['title', 'companyName', 'roleFamily', 'roleLevel', 'skills', 'requirements'].filter((key) => fieldScores[key] !== undefined);
  const criticalScore = criticalFields.length ? Number((criticalFields.reduce((sum, key) => sum + fieldScores[key], 0) / criticalFields.length).toFixed(2)) : 1;
  const score = possible ? Number((earned / possible).toFixed(2)) : 1;

  return {
    score,
    criticalScore,
    earned: Number(earned.toFixed(2)),
    possible: Number(possible.toFixed(2)),
    fieldScores,
    failedChecks,
    checks,
  };
};
