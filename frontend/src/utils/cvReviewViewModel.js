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


const buildProjectEvidenceText = (profile = {}) => {
  const directProjectText = getSectionText(profile, 'projects');

  // Prefer the canonical projects section when it exists. Do not merge generated
  // evidenceProfile rows back into the editable review field because reviewed CVs
  // rebuild evidenceProfile from this text. Re-merging generated evidence causes
  // repeated save cycles to multiply evidenceItems.
  if (directProjectText) {
    return directProjectText;
  }

  const projects = profile.evidenceProfile?.sections?.projects || [];

  return projects.map((project) => {
    const title = project.title || 'Project';
    const techStack = Array.isArray(project.techStack) && project.techStack.length
      ? `Tech stack: ${project.techStack.join(', ')}`
      : '';
    const responsibilities = Array.isArray(project.responsibilities) && project.responsibilities.length
      ? `Responsibilities: ${project.responsibilities.slice(0, 3).join(' ')}`
      : '';
    const outcomes = Array.isArray(project.outcomes) && project.outcomes.length
      ? `Outcomes: ${project.outcomes.slice(0, 2).join(' ')}`
      : '';

    return [title, techStack, responsibilities, outcomes].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n\n');
};


const buildFallbackAnalysis = (reviewProfile = {}) => {
  const strongestEvidence = [
    reviewProfile.experienceEvidence && { label: 'Experience evidence', text: truncate(reviewProfile.experienceEvidence) },
    reviewProfile.projectEvidence && { label: 'Project evidence', text: truncate(reviewProfile.projectEvidence) },
    reviewProfile.educationCredentials && { label: 'Education and credentials', text: truncate(reviewProfile.educationCredentials) },
  ].filter(Boolean);

  return {
    candidateIntro: reviewProfile.candidateSummary || 'Review the parsed CV fields before matching.',
    careerDirection: reviewProfile.coreSkills?.length ? `Likely direction: ${reviewProfile.coreSkills.slice(0, 4).join(', ')}` : '',
    strongestEvidence,
    jdRelevantEvidence: [],
    transferableCompetencies: reviewProfile.keyCompetencies || [],
    weakOrMissingEvidence: strongestEvidence.length ? [] : ['No strong CV evidence was extracted yet.'],
    suggestedInterviewHooks: [
      'self introduction and career direction',
      ...(reviewProfile.coreSkills || []).slice(0, 4),
      ...(reviewProfile.keyCompetencies || []).slice(0, 3),
    ],
  };
};

export const buildCvReviewFormModel = (selectedCV = {}) => {
  const profile = selectedCV.profile || {};
  const display = selectedCV.display || {};
  const keyCompetenciesText = getSectionText(profile, 'keyCompetencies') || getSectionText(profile, 'key_competencies');

  return {
    candidateSummary: display.summary || profile.summary || profile.personalStatement || selectedCV.summary || '',
    coreSkills: normalizeList(display.topSkills || selectedCV.topSkills || profile.skills),
    experienceEvidence: getSectionText(profile, 'experience'),
    projectEvidence: buildProjectEvidenceText(profile),
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
  const cvAnalysis = profile.cvAnalysis || buildFallbackAnalysis(reviewProfile);

  return {
    confidence: Number.isFinite(parseConfidence) ? parseConfidence : 0,
    warnings: Array.isArray(warnings) ? warnings : [],
    reviewProfile,
    cvAnalysis,
    fields: CV_REVIEW_FIELDS
      .map((field) => ({
        label: field.label,
        value: Array.isArray(reviewProfile[field.key])
          ? reviewProfile[field.key].join(', ')
          : reviewProfile[field.key],
      }))
      .map((field) => ({ ...field, value: truncate(field.value) })),
  };
};
