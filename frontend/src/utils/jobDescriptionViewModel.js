const flattenTechnicalGroups = (technicalSkills = {}) =>
  Object.entries(technicalSkills || {})
    .map(([groupKey, items]) => ({
      groupKey,
      items: (items || []).map((item) => item.label || item.name || item).filter(Boolean),
    }))
    .filter((group) => group.items.length > 0);

const groupLabels = {
  softwareDevelopment: 'Software Development',
  data: 'Data',
  aiMl: 'AI / ML',
  itInfrastructure: 'IT / Infrastructure',
  commonEngineering: 'Common Engineering',
};

export const buildJobDescriptionViewModel = (rubric = {}) => {
  const sections = rubric.sections || {};
  const diagnostics = rubric.diagnostics || {};
  const technicalGroups = flattenTechnicalGroups(sections.technicalSkills || {});

  return {
    title: rubric.jobOverview?.title || rubric.title || 'Target Role',
    overviewItems: [
      rubric.jobOverview?.companyName ? `Company: ${rubric.jobOverview.companyName}` : null,
      rubric.jobOverview?.location ? `Location: ${rubric.jobOverview.location}` : null,
      rubric.jobOverview?.contractType ? `Contract type: ${rubric.jobOverview.contractType}` : null,
      rubric.jobOverview?.employmentType ? `Employment type: ${rubric.jobOverview.employmentType}` : null,
      rubric.roleFamily ? `Role family: ${rubric.roleFamily}` : null,
      rubric.roleLevel ? `Role level: ${rubric.roleLevel}` : null,
    ].filter(Boolean),
    responsibilities: sections.responsibilities || rubric.roleSummary || [],
    coreRequirements: sections.mustHaveRequirements || rubric.mustHaveRequirements || [],
    bonusRequirements: sections.niceToHaveRequirements || rubric.niceToHaveExperience || [],
    qualifications: sections.qualifications || rubric.qualifications || [],
    technicalGroups: technicalGroups.map((group) => ({
      ...group,
      title: groupLabels[group.groupKey] || group.groupKey,
    })),
    softSkills: sections.softSkills || rubric.softSkillRequirements || [],
    benefits: sections.benefits || [],
    applicationInstructions: sections.applicationInstructions || [],
    analysisMode: diagnostics.analysisMode || rubric.metadata?.analysisMode || 'heuristic_only',
    confidence: diagnostics.confidence ?? rubric.metadata?.confidence ?? 0,
    warnings: diagnostics.warnings || [],
    missingSections: diagnostics.missingSections || [],
  };
};
