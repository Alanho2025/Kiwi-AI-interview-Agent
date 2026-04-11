export const buildTransitionProfile = ({ evidenceProfile = {}, parsedCvProfile = {} }) => {
  const roleSignals = evidenceProfile.roleSignals || {};
  const hardSkillCount = (evidenceProfile.hardSkills || []).length;
  const projectCount = (evidenceProfile.sections?.projects || []).length;
  const achievementCount = (evidenceProfile.achievements || []).length;
  return {
    priorProfessionalMaturity: roleSignals.priorProfessionalMaturity ?? 0.6,
    targetRoleReadiness: roleSignals.targetRoleReadiness ?? Math.min(0.9, 0.35 + projectCount * 0.12 + hardSkillCount * 0.03),
    careerTransitionSignal: roleSignals.careerTransitionSignal ?? 0.45,
    technicalReadiness: Math.min(100, 35 + hardSkillCount * 4 + projectCount * 8),
    transferableStrength: Math.min(100, 30 + (evidenceProfile.functionalCapabilities || []).length * 7 + achievementCount * 6),
    commercialExperience: Math.min(100, parsedCvProfile.experience ? 62 : 35),
    growthPotential: Math.min(100, 45 + (evidenceProfile.behaviouralCapabilities || []).length * 8 + projectCount * 6),
  };
};
