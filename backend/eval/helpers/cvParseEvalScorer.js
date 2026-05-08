import { containsInText, includesNormalized } from './evalShared.js';

const sectionKeys = (profile) => (profile.sections || []).map((section) => section.key);
const skillLabels = (profile) => (profile.skills || []).map((item) => item.label || item);
const achievementTexts = (profile) => (profile.evidenceProfile?.achievements || []).map((item) => item.text || '');
const capabilityLabels = (profile) => profile.evidenceProfile?.functionalCapabilities || [];
const warningTexts = (profile) => profile.warnings || [];
const cvAnalysis = (profile) => profile.cvAnalysis || {};
const strongestEvidenceTexts = (profile) => (cvAnalysis(profile).strongestEvidence || []).map((item) => `${item.label || ''} ${item.text || item.evidence || ''}`);
const interviewHookTexts = (profile) => cvAnalysis(profile).suggestedInterviewHooks || [];
const weakEvidenceTexts = (profile) => cvAnalysis(profile).weakOrMissingEvidence || [];

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

  for (const keyword of expected.candidateIntroKeywords || []) push(`candidateIntro:${keyword}`, containsInText(cvAnalysis(profile).candidateIntro, keyword), 1);
  for (const keyword of expected.careerDirectionKeywords || []) push(`careerDirection:${keyword}`, containsInText(cvAnalysis(profile).careerDirection, keyword), 1);
  for (const keyword of expected.strongestEvidenceKeywords || []) push(`strongestEvidence:${keyword}`, strongestEvidenceTexts(profile).some((text) => containsInText(text, keyword)), 2);
  for (const keyword of expected.interviewHookKeywords || []) push(`interviewHook:${keyword}`, includesNormalized(interviewHookTexts(profile), keyword), 1);
  for (const keyword of expected.weakEvidenceKeywords || []) push(`weakEvidence:${keyword}`, weakEvidenceTexts(profile).some((text) => containsInText(text, keyword)), 1);
  for (const keyword of expected.absentWeakEvidenceKeywords || []) push(`no-weakEvidence:${keyword}`, !weakEvidenceTexts(profile).some((text) => containsInText(text, keyword)), 1);

  return {
    earned,
    possible,
    score: possible ? Number((earned / possible).toFixed(2)) : 1,
    checks,
  };
};
