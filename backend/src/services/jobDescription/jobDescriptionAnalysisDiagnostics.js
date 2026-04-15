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
  const extractionCoverage = Number((coverageCount / Object.keys(sectionCoverage).length).toFixed(2));
  const ambiguityScore = Number(Math.max(0, Math.min(1, 1 - ((warnings.length * 0.12) + ((sections.applicationInstructions || []).length > 6 ? 0.1 : 0)))).toFixed(2));
  const parserSelfConfidence = Number(Math.max(0.45, Math.min(0.98, 0.5 + coverageCount * 0.07 + Math.min(0.2, extractedCounts.technicalSkills * 0.012) - Math.min(0.15, warnings.length * 0.03))).toFixed(2));

  return {
    analysisMode: warnings.some((item) => item.includes('AI enhancement')) ? 'heuristic_only' : 'hybrid',
    confidence: parserSelfConfidence,
    parserSelfConfidence,
    extractionCoverage,
    ambiguityScore,
    warnings,
    sectionCoverage,
    extractedCounts,
    missingSections: Object.entries(sectionCoverage).filter(([, present]) => !present).map(([key]) => key),
    parserVersion: 'jd-parser-v3',
  };
};
