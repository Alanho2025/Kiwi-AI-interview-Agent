import { containsInText, includesNormalized } from './evalShared.js';

const sectionKeys = (profile) => (profile.sections || []).map((section) => section.key);
const skillLabels = (profile) => (profile.skills || []).map((item) => item.label || item);
const achievementTexts = (profile) => (profile.evidenceProfile?.achievements || []).map((item) => item.text || '');
const capabilityLabels = (profile) => profile.evidenceProfile?.functionalCapabilities || [];
const warningTexts = (profile) => profile.warnings || [];

export const scoreCvParseCase = (profile, expected = {}) => {
  let earned = 0;
  let possible = 0;
  const checks = [];

  const push = (label, passed, weight = 1) => {
    possible += weight;
    if (passed) earned += weight;
    checks.push({ label, passed, weight });
  };

  if (expected.candidateName) push('candidateName', containsInText(profile.candidateName, expected.candidateName), 2);
  if (expected.email) push('email', containsInText(profile.contact?.email, expected.email), 2);
  if (expected.location) push('location', containsInText(profile.contact?.location, expected.location), 1);

  for (const key of expected.requiredSections || []) push(`section:${key}`, sectionKeys(profile).includes(key), 1);
  for (const skill of expected.requiredSkills || []) push(`skill:${skill}`, includesNormalized(skillLabels(profile), skill), 1);
  for (const snippet of expected.achievementKeywords || []) push(`achievement:${snippet}`, achievementTexts(profile).some((text) => containsInText(text, snippet)), 1);
  for (const capability of expected.capabilityKeywords || []) push(`capability:${capability}`, includesNormalized(capabilityLabels(profile), capability), 1);
  for (const warning of expected.requiredWarnings || []) push(`warning:${warning}`, warningTexts(profile).some((text) => containsInText(text, warning)), 1);
  for (const warning of expected.absentWarnings || []) push(`no-warning:${warning}`, !warningTexts(profile).some((text) => containsInText(text, warning)), 1);

  return {
    earned,
    possible,
    score: possible ? Number((earned / possible).toFixed(2)) : 1,
    checks,
  };
};
