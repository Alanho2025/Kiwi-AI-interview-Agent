import { normalizeProjectsSection } from './cvProjectNormalizer.js';
import { extractAchievements } from './cvAchievementExtractor.js';
import { extractCapabilities } from './cvCapabilityExtractor.js';

const sectionByKey = (sections = [], key) => sections.find((section) => section.key === key)?.content || '';

const extractKeyCompetencies = (sections = []) => {
  const text = sectionByKey(sections, 'key_competencies') || sectionByKey(sections, 'skills') || '';
  return text.split('\n').map((line) => line.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
};

const extractSectionEntries = (text = '') => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);

const inferRoleSignals = ({ projects = [], achievements = [], hardSkills = [], capabilities = [] } = {}) => ({
  priorProfessionalMaturity: achievements.length > 0 ? 0.82 : 0.6,
  targetRoleReadiness: Math.min(0.92, 0.4 + (projects.length * 0.12) + (hardSkills.length * 0.03)),
  careerTransitionSignal: capabilities.includes('adaptability') || hardSkills.length >= 4 ? 0.8 : 0.45,
});

export const buildCvEvidenceProfile = (cvProfile = {}, normalizedText = '') => {
  const sections = Array.isArray(cvProfile.sections) ? cvProfile.sections : [];
  const personalStatement = sectionByKey(sections, 'personal_statement') || cvProfile.summary || '';
  const keyCompetencies = extractKeyCompetencies(sections);
  const experienceEntries = extractSectionEntries(sectionByKey(sections, 'experience') || cvProfile.experience || '');
  const projects = normalizeProjectsSection(sectionByKey(sections, 'projects') || cvProfile.projects || '');
  const educationEntries = extractSectionEntries(sectionByKey(sections, 'education') || cvProfile.education || '');
  const volunteerEntries = extractSectionEntries(sectionByKey(sections, 'volunteer') || '');
  const hardSkills = Array.isArray(cvProfile.skills) ? cvProfile.skills.map((item) => item.label) : [];
  const achievements = extractAchievements(normalizedText);
  const capabilityResult = extractCapabilities({
    sectionTexts: [personalStatement, keyCompetencies.join('\n'), experienceEntries.join('\n'), projects.map((item) => item.rawText).join('\n'), educationEntries.join('\n'), volunteerEntries.join('\n')],
    skillLabels: hardSkills,
  });

  const evidenceItems = [
    ...experienceEntries.map((text) => ({ sourceType: 'experience', text })),
    ...projects.flatMap((project) => [
      ...project.responsibilities.map((text) => ({ sourceType: 'project_responsibility', projectTitle: project.title, text })),
      ...project.outcomes.map((text) => ({ sourceType: 'project_outcome', projectTitle: project.title, text })),
    ]),
    ...keyCompetencies.map((text) => ({ sourceType: 'key_competency', text })),
    ...achievements.map((item) => ({ sourceType: 'achievement', text: item.text, achievementType: item.type })),
  ];

  return {
    schemaVersion: 'cv_evidence_profile_v1',
    candidateName: cvProfile.candidateName || 'Candidate',
    roleSignals: inferRoleSignals({
      projects,
      achievements,
      hardSkills,
      capabilities: capabilityResult.functionalCapabilities,
    }),
    sections: {
      personalStatement,
      keyCompetencies,
      experience: experienceEntries,
      projects,
      education: educationEntries,
      volunteer: volunteerEntries,
      certifications: extractSectionEntries(sectionByKey(sections, 'certifications') || cvProfile.certifications || ''),
      skills: hardSkills,
    },
    hardSkills,
    functionalCapabilities: capabilityResult.functionalCapabilities,
    behaviouralCapabilities: capabilityResult.behaviouralCapabilities,
    achievements,
    evidenceItems,
  };
};
