import crypto from 'crypto';

const normalizeFingerprintText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

export const buildCompanyValuesJdFingerprint = ({ rawJD = '', jdRubric = {} } = {}) => {
  const overview = jdRubric?.jobOverview || {};
  const parts = [
    rawJD,
    overview.title || jdRubric?.title || jdRubric?.jobTitle || '',
    overview.companyName || '',
    overview.location || '',
  ].map(normalizeFingerprintText);

  return crypto
    .createHash('sha256')
    .update(parts.join('\n'))
    .digest('hex');
};

export const extractCompanyValuesContextFromJd = ({ rawJD = '', jdRubric = {}, companyWebsiteUrl = '' } = {}) => {
  const overview = jdRubric?.jobOverview || {};
  return {
    jdFingerprint: buildCompanyValuesJdFingerprint({ rawJD, jdRubric }),
    companyName: String(overview.companyName || jdRubric?.companyName || '').trim(),
    location: String(overview.location || jdRubric?.location || '').trim(),
    websiteUrl: String(companyWebsiteUrl || overview.companyWebsiteUrl || jdRubric?.companyWebsiteUrl || '').trim(),
    jdText: String(rawJD || '').trim(),
  };
};
