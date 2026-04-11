const toLabels = (items = []) => items.map((item) => item.label || item.name || item.text || '').filter(Boolean);

export const buildJobDescriptionInterviewTargets = ({ roleFamily, groupedTechnicalSkills, softSkills, requirementGroups, title }) => {
  const technicalFocus = [
    ...toLabels(groupedTechnicalSkills.softwareDevelopment),
    ...toLabels(groupedTechnicalSkills.data),
    ...toLabels(groupedTechnicalSkills.aiMl),
    ...toLabels(groupedTechnicalSkills.itInfrastructure),
    ...toLabels(groupedTechnicalSkills.commonEngineering),
  ].slice(0, 8);

  const behaviouralFocus = toLabels(softSkills).slice(0, 6);
  const motivationFocus = [
    /graduate|intern|junior/i.test(title || '') ? 'growth mindset' : null,
    roleFamily === 'software_development' ? 'interest in building reliable software' : null,
    roleFamily === 'data' ? 'interest in solving problems with data' : null,
    roleFamily === 'ai_ml' ? 'interest in applied AI systems' : null,
    roleFamily === 'it_infrastructure' ? 'interest in reliable operational support' : null,
  ].filter(Boolean);

  const gapFocusCandidates = [
    ...toLabels(requirementGroups.niceToHaveRequirements),
    ...toLabels(requirementGroups.mustHaveRequirements).slice(0, 4),
  ].slice(0, 6);

  return {
    technicalFocus,
    behaviouralFocus,
    motivationFocus,
    gapFocusCandidates,
    prioritySkills: technicalFocus.slice(0, 6),
    experienceFocus: toLabels(requirementGroups.responsibilities).slice(0, 5),
  };
};
