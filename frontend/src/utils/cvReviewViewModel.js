const normalizeList = (items = []) => (Array.isArray(items) ? items : [])
  .map((item) => (typeof item === 'string' ? item : item?.label || item?.name || item?.title || ''))
  .map((item) => item.trim())
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

export const buildCvReviewViewModel = (selectedCV = {}) => {
  const profile = selectedCV.profile || {};
  const display = selectedCV.display || {};
  const parseConfidence = Number(selectedCV.parseConfidence ?? profile.confidence ?? display.parseConfidence ?? 0);
  const warnings = selectedCV.parseWarnings || selectedCV.warnings || display.warnings || profile.warnings || [];

  return {
    confidence: Number.isFinite(parseConfidence) ? parseConfidence : 0,
    warnings: Array.isArray(warnings) ? warnings : [],
    fields: [
      {
        label: 'Candidate summary',
        value: display.summary || profile.summary || profile.personalStatement || selectedCV.summary || '',
      },
      {
        label: 'Core skills',
        value: normalizeList(display.topSkills || selectedCV.topSkills || profile.skills).join(', '),
      },
      {
        label: 'Experience evidence',
        value: getSectionText(profile, 'experience'),
      },
      {
        label: 'Project evidence',
        value: getSectionText(profile, 'projects'),
      },
      {
        label: 'Education and credentials',
        value: [getSectionText(profile, 'education'), getSectionText(profile, 'certifications')].filter(Boolean).join(' '),
      },
      {
        label: 'Key competencies',
        value: getSectionText(profile, 'keyCompetencies') || getSectionText(profile, 'key_competencies'),
      },
    ]
      .map((field) => ({ ...field, value: truncate(field.value) }))
      .filter((field) => field.value),
  };
};
