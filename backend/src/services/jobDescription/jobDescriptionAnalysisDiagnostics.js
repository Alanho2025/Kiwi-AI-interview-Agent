export const buildJobDescriptionDiagnostics = ({ sections = {}, requirementGroups = {}, technicalSkills = {}, softSkills = [], aiSkills = {} }) => {
  const sectionCoverage = {
    responsibilities: (sections.responsibilities || []).length > 0,
    qualifications: (sections.qualifications || []).length > 0,
    benefits: (sections.benefits || []).length > 0,
    companyContext: (sections.companyContext || []).length > 0,
    applicationInstructions: (sections.applicationInstructions || []).length > 0,
  };

  const warnings = [];
  if (!sectionCoverage.responsibilities) warnings.push('Responsibilities could not be confidently extracted.');
  if (!sectionCoverage.qualifications) warnings.push('Qualifications could not be confidently extracted.');
  if ((requirementGroups.niceToHaveRequirements || []).length === 0) warnings.push('No clear bonus or nice-to-have requirements were detected.');
  if (Object.values(technicalSkills).flat().length === 0) warnings.push('No grouped technical skills were detected.');
  if (!(aiSkills.technicalSkillRequirements || []).length && !(aiSkills.softSkillRequirements || []).length) warnings.push('AI enhancement was unavailable or returned no extra skill signals.');

  const extractedCounts = {
    responsibilities: (sections.responsibilities || []).length,
    qualifications: (sections.qualifications || []).length,
    mustHaveRequirements: (requirementGroups.mustHaveRequirements || []).length,
    niceToHaveRequirements: (requirementGroups.niceToHaveRequirements || []).length,
    technicalSkills: Object.values(technicalSkills).flat().length,
    softSkills: softSkills.length,
    benefits: (sections.benefits || []).length,
  };

  const coverageCount = Object.values(sectionCoverage).filter(Boolean).length;
  const confidence = Math.max(0.45, Math.min(0.96, 0.45 + coverageCount * 0.08 + Math.min(0.16, extractedCounts.technicalSkills * 0.01)));

  return {
    analysisMode: warnings.some((item) => item.includes('AI enhancement')) ? 'heuristic_only' : 'hybrid',
    confidence: Number(confidence.toFixed(2)),
    warnings,
    sectionCoverage,
    extractedCounts,
    missingSections: Object.entries(sectionCoverage).filter(([, present]) => !present).map(([key]) => key),
    parserVersion: 'jd-parser-v2',
  };
};
