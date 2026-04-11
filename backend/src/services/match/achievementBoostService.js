export const computeAchievementBoost = ({ label, evidenceProfile = {} }) => {
  const lower = String(label || '').toLowerCase();
  const achievements = Array.isArray(evidenceProfile.achievements) ? evidenceProfile.achievements : [];
  const relevant = achievements.filter((item) => {
    if (/process|improvement|optimization|optimisation|delivery|impact|ownership|analysis/.test(lower)) return true;
    if (/technical|engineering|problem|quality|testing/.test(lower) && /delivery|quantified/.test(item.category)) return true;
    return false;
  });
  return {
    boost: relevant.length ? Math.min(0.22, 0.08 + relevant.length * 0.05) : 0,
    evidence: relevant.slice(0, 2).map((item) => item.text),
  };
};
