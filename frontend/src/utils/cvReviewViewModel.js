export const CV_REVIEW_FIELDS = [
  { key: 'candidateSummary', label: 'Candidate summary' },
  { key: 'coreSkills', label: 'Core skills' },
  { key: 'experienceEvidence', label: 'Experience evidence' },
  { key: 'projectEvidence', label: 'Project evidence' },
  { key: 'educationCredentials', label: 'Education and credentials' },
  { key: 'keyCompetencies', label: 'Key competencies' },
];

const normalizeList = (items = []) => (Array.isArray(items) ? items : [])
  .map((item) => (typeof item === 'string' ? item : item?.label || item?.name || item?.title || ''))
  .map((item) => item.trim())
  .filter(Boolean);

const splitListText = (value = '') => String(value || '')
  .split(/\n|,/)
  .map((line) => line.replace(/^[-•*]\s*/, '').trim())
  .filter(Boolean);

const getSectionText = (profile = {}, key) => {
  const directValue = String(profile[key] || '').trim();
  if (directValue) return directValue;

  const section = (profile.sections || []).find((item) => item.key === key);
  return String(section?.content || '').trim();
};

const truncate = (value = '', maxLength = 260) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
};

export const buildCvReviewFormModel = (selectedCV = {}) => {
  const profile = selectedCV.profile || {};
  const display = selectedCV.display || {};
  const keyCompetenciesText = getSectionText(profile, 'keyCompetencies') || getSectionText(profile, 'key_competencies');

  return {
    candidateSummary: display.summary || profile.summary || profile.personalStatement || selectedCV.summary || '',
    coreSkills: normalizeList(display.topSkills || selectedCV.topSkills || profile.skills),
    experienceEvidence: getSectionText(profile, 'experience'),
    projectEvidence: getSectionText(profile, 'projects'),
    educationCredentials: [getSectionText(profile, 'education'), getSectionText(profile, 'certifications')].filter(Boolean).join('\n'),
    keyCompetencies: splitListText(keyCompetenciesText),
  };
};

export const buildReviewedCvProfilePayload = (reviewProfile = {}) => ({
  candidateSummary: String(reviewProfile.candidateSummary || '').trim(),
  coreSkills: normalizeList(reviewProfile.coreSkills),
  experienceEvidence: String(reviewProfile.experienceEvidence || '').trim(),
  projectEvidence: String(reviewProfile.projectEvidence || '').trim(),
  educationCredentials: String(reviewProfile.educationCredentials || '').trim(),
  keyCompetencies: normalizeList(reviewProfile.keyCompetencies),
});

export const buildCvReviewViewModel = (selectedCV = {}) => {
  const profile = selectedCV.profile || {};
  const display = selectedCV.display || {};
  const parseConfidence = Number(selectedCV.parseConfidence ?? profile.confidence ?? display.parseConfidence ?? 0);
  const warnings = selectedCV.parseWarnings || selectedCV.warnings || display.warnings || profile.warnings || [];
  const reviewProfile = buildCvReviewFormModel(selectedCV);

  return {
    confidence: Number.isFinite(parseConfidence) ? parseConfidence : 0,
    warnings: Array.isArray(warnings) ? warnings : [],
    reviewProfile,
    fields: CV_REVIEW_FIELDS
      .map((field) => ({
        label: field.label,
        value: Array.isArray(reviewProfile[field.key])
          ? reviewProfile[field.key].join(', ')
          : reviewProfile[field.key],
      }))
      .map((field) => ({ ...field, value: truncate(field.value) }))
  };
};
