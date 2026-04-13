const ensureArray = (value) => (Array.isArray(value) ? value : []);
const asText = (item) => typeof item === 'string' ? item : item?.text || item?.label || item?.summary || '';
const unique = (items = []) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

const filterEvidence = (items = [], predicate) => unique(ensureArray(items).map(asText).filter((text) => predicate(text.toLowerCase())));

export const normalizeCvEvidence = (profile = {}) => {
  const evidenceProfile = profile.evidenceProfile || {};
  const projects = ensureArray(profile.projects).map(asText);
  const achievements = ensureArray(profile.achievements).map(asText);
  const workHistory = ensureArray(profile.workHistory).map(asText);
  const allItems = [...projects, ...achievements, ...workHistory, ...ensureArray(evidenceProfile.functionalCapabilities), ...ensureArray(evidenceProfile.achievements)];

  return {
    quantifiedEvidence: unique([
      ...ensureArray(evidenceProfile.quantifiedEvidence),
      ...filterEvidence(allItems, (text) => /\d|%|percent|reduced|improved|increased|decreased/.test(text)),
    ]),
    leadershipEvidence: unique([
      ...ensureArray(evidenceProfile.leadershipEvidence),
      ...filterEvidence(allItems, (text) => /led|managed|mentored|coordinated|owned/.test(text)),
    ]),
    deliveryEvidence: unique([
      ...ensureArray(evidenceProfile.deliveryEvidence),
      ...filterEvidence(allItems, (text) => /deployed|delivered|launched|shipped|production/.test(text)),
    ]),
    technicalDepthEvidence: unique([
      ...ensureArray(evidenceProfile.technicalDepthEvidence),
      ...filterEvidence(allItems, (text) => /built|implemented|designed|optimized|debugged|architecture|api|backend|database/.test(text)),
    ]),
  };
};
