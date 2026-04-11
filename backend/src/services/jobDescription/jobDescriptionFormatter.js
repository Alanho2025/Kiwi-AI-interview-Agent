import { unique } from './jobDescriptionShared.js';

const formatList = (items = []) => (items.length ? items.map((item) => `• ${item}`).join('\n') : 'N/A');
const flattenTechnicalSkills = (technicalSkills = {}) => unique(Object.values(technicalSkills).flat().map((item) => item.label || item.name));

export const formatStructuredJobDescription = (rubric) => {
  const overview = rubric.jobOverview || {};
  const sectionView = rubric.sections || {};
  const technicalSkills = flattenTechnicalSkills(sectionView.technicalSkills || {});
  const softSkills = sectionView.softSkills || rubric.softSkillRequirements || [];

  return `# ${overview.title || rubric.title || 'Target Role'}\n\n## Job Overview\n${formatList([
    overview.companyName && `Company: ${overview.companyName}`,
    overview.location && `Location: ${overview.location}`,
    overview.contractType && `Contract type: ${overview.contractType}`,
    overview.employmentType && `Employment type: ${overview.employmentType}`,
  ].filter(Boolean))}\n\n## What This Role Does\n${formatList(sectionView.responsibilities || rubric.roleSummary || [])}\n\n## Core Requirements\n${formatList(sectionView.mustHaveRequirements || rubric.mustHaveRequirements || [])}\n\n## Bonus Requirements\n${formatList(sectionView.niceToHaveRequirements || rubric.niceToHaveExperience || [])}\n\n## Technical Skills\n${formatList(technicalSkills)}\n\n## Soft Skills\n${formatList(softSkills)}\n\n## Benefits\n${formatList(sectionView.benefits || [])}\n\n## Application Notes\n${formatList(sectionView.applicationInstructions || [])}`;
};
