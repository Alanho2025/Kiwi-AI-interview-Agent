import { TECHNICAL_SKILL_FAMILIES, SOFT_SKILL_TAXONOMY } from './lexicons/jobDescriptionSkillTaxonomy.js';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildAliasRegex = (alias = '') => new RegExp(`(^|[^a-z0-9])${escapeRegex(alias.toLowerCase())}([^a-z0-9]|$)`, 'i');
const collectTexts = (...groups) => groups.flat().filter(Boolean).map((item) => typeof item === 'string' ? item : item.text || item.label || '').filter(Boolean);

const findMatches = (texts = [], taxonomy = [], family = 'softwareDevelopment') => {
  const matched = [];
  const seen = new Set();
  const haystack = texts.join('\n').toLowerCase();

  taxonomy.forEach(([canonical, aliases]) => {
    if (aliases.some((alias) => buildAliasRegex(alias).test(haystack))) {
      const key = canonical.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        matched.push({
          name: canonical,
          label: canonical,
          family,
          importance: 'core',
          category: family,
        });
      }
    }
  });

  return matched;
};

const groupTechnicalSkills = (texts = []) => ({
  softwareDevelopment: findMatches(texts, TECHNICAL_SKILL_FAMILIES.softwareDevelopment, 'softwareDevelopment'),
  data: findMatches(texts, TECHNICAL_SKILL_FAMILIES.data, 'data'),
  aiMl: findMatches(texts, TECHNICAL_SKILL_FAMILIES.aiMl, 'aiMl'),
  itInfrastructure: findMatches(texts, TECHNICAL_SKILL_FAMILIES.itInfrastructure, 'itInfrastructure'),
  commonEngineering: findMatches(texts, TECHNICAL_SKILL_FAMILIES.commonEngineering, 'commonEngineering'),
});

const extractSoftSkills = (texts = [], softSkillSignals = []) => {
  const haystack = `${texts.join('\n')}\n${softSkillSignals.map((item) => item.label || item.name || '').join('\n')}`.toLowerCase();
  const seen = new Set();
  const items = [];

  SOFT_SKILL_TAXONOMY.forEach(([canonical, aliases]) => {
    if (aliases.some((alias) => buildAliasRegex(alias).test(haystack))) {
      const key = canonical.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ name: canonical, label: canonical, category: 'soft', importance: 'core' });
      }
    }
  });

  return items;
};

export const extractJobDescriptionSkills = ({ sections = {}, requirementGroups = {}, aiSkills = {} }) => {
  const sourceTexts = collectTexts(
    sections.responsibilities,
    sections.qualifications,
    sections.softSkillPersona,
    requirementGroups.mustHaveRequirements,
    requirementGroups.niceToHaveRequirements,
    aiSkills.technicalSkillRequirements,
    aiSkills.softSkillRequirements,
  );

  const technicalSkills = groupTechnicalSkills(sourceTexts);
  const softSkills = extractSoftSkills(sourceTexts, requirementGroups.softSkillSignals);
  const technicalSkillRequirements = Object.values(technicalSkills).flat().map((item) => item.label);
  const softSkillRequirements = softSkills.map((item) => item.label);

  return {
    technicalSkills,
    softSkills,
    technicalSkillRequirements,
    softSkillRequirements,
  };
};
