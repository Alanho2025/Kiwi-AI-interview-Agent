const ensureArray = (value) => (Array.isArray(value) ? value : []);
const unique = (items = []) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

export const buildCvSignals = (profile = {}) => {
  const skills = unique(ensureArray(profile.skills).map((item) => item?.label || item));
  const tools = unique(ensureArray(profile.tools));
  const projects = ensureArray(profile.projects).map((item) => item?.title || item?.summary || item?.name || item).filter(Boolean);
  const achievements = ensureArray(profile.achievements).map((item) => item?.summary || item?.text || item).filter(Boolean);

  const roleSignals = unique([
    ...ensureArray(profile.roleSignals),
    ...(skills.some((item) => /python|sql|data/i.test(item)) ? ['data_profile'] : []),
    ...(skills.some((item) => /react|node|javascript|typescript/i.test(item)) ? ['web_engineering'] : []),
    ...(skills.some((item) => /java|c#|api|backend|spring|dotnet/i.test(item)) ? ['backend_engineering'] : []),
  ]);

  return {
    roleSignals,
    capabilities: unique(ensureArray(profile.capabilities)),
    tools,
    skills,
    projectSignals: unique(projects.slice(0, 8)),
    achievementSignals: unique(achievements.slice(0, 8)),
  };
};
