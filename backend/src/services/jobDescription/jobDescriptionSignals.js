import { canonicalizeRoleTitle, inferRoleFamily, inferSeniority } from './jobDescriptionNormalizer.js';
import { ensureArray } from '../../utils/commonHelpers.js';


const pickTechnicalFocus = ({ requiredSkills = [], preferredSkills = [], interviewTargets = [] } = {}) => {
  const merged = [...ensureArray(requiredSkills), ...ensureArray(preferredSkills), ...ensureArray(interviewTargets)];
  return [...new Set(merged.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 8);
};

export const buildJobDescriptionSignals = (input = {}) => {
  const roleCanonical = canonicalizeRoleTitle(input.roleCanonical || input.roleTitle || input.title || '');
  const seniority = inferSeniority({
    seniority: input.seniority,
    title: input.roleTitle || input.title,
    rawText: [
      ...(ensureArray(input.experienceRequirements)),
      ...(ensureArray(input.behaviouralSignals)),
      ...(ensureArray(input.scoringHints)),
    ].join(' '),
  });
  const technicalFocus = pickTechnicalFocus(input);
  const roleFamily = inferRoleFamily({ roleFamily: input.roleFamily, roleCanonical, skills: technicalFocus });
  const interviewTargets = [...new Set([
    ...ensureArray(input.interviewTargets),
    ...ensureArray(input.requiredCapabilities),
    ...ensureArray(input.requiredSkills).slice(0, 4),
  ].map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 8);

  return {
    roleCanonical,
    roleFamily,
    seniority,
    technicalFocus,
    interviewTargets,
  };
};
