import { TECHNICAL_SKILL_FAMILIES } from '../jobDescription/lexicons/jobDescriptionSkillTaxonomy.js';

const EXTRA_CV_SKILLS = [
  ['API Development', ['api development', 'api endpoints', 'rest endpoints', 'backend endpoints']],
  ['Data Analysis', ['data analysis', 'data analytics']],
  ['Reporting', ['reporting', 'reports']],
  ['Tailwind', ['tailwind', 'tailwind css']],
  ['Express', ['express', 'express.js']],
  ['Jest', ['jest']],
  ['Pytest', ['pytest']],
];

const normalizeAlias = (value = '') => String(value || '').trim().toLowerCase();

export const CV_TECHNICAL_SKILLS = Object.values(TECHNICAL_SKILL_FAMILIES)
  .flat()
  .concat(EXTRA_CV_SKILLS)
  .map(([label, aliases]) => ({
    label,
    aliases: [...new Set([label, ...(aliases || [])].map(normalizeAlias).filter(Boolean))],
  }));
