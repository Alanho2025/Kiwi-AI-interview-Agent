import crypto from 'crypto';

export const normalizeTextForHash = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const stableSortObject = (value) => {
  if (Array.isArray(value)) return value.map(stableSortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      const entry = value[key];
      if (entry !== undefined) acc[key] = stableSortObject(entry);
      return acc;
    }, {});
};

export const sha256Text = (value = '') => crypto
  .createHash('sha256')
  .update(normalizeTextForHash(value))
  .digest('hex');

export const sha256Json = (value = {}) => crypto
  .createHash('sha256')
  .update(JSON.stringify(stableSortObject(value || {})))
  .digest('hex');

export const buildCvHash = (cvInput = {}) => {
  const rawText = typeof cvInput === 'string' ? cvInput : cvInput.normalizedText || cvInput.rawText || '';
  const profileHash = cvInput?.cvProfile ? sha256Json(cvInput.cvProfile) : '';
  return sha256Text(`${rawText}::${profileHash}`);
};

export const buildJdHash = ({ rawJD = '', jdRubric = null } = {}) => sha256Text(`${rawJD || ''}::${jdRubric ? sha256Json(jdRubric) : ''}`);

export const buildMatchSettingsHash = (settings = {}) => sha256Json({
  matchEngine: settings.matchEngine || 'default',
  enableNZCultureFit: Boolean(settings.enableNZCultureFit),
  interviewType: settings.interviewType || settings.focusArea || 'combined',
  rubricVersion: settings.rubricVersion || 'v1',
  parserVersion: settings.parserVersion || 'v1',
  safeguardVersion: settings.safeguardVersion || 'v2_disjunctive_degree_fix',
});

export const buildMatchCacheKey = ({ userId = '', cvHash = '', jdHash = '', settingsHash = '' } = {}) => sha256Text(`${userId || 'anonymous'}:${cvHash}:${jdHash}:${settingsHash}`);
