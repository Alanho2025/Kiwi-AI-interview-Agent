export const buildStatusMessage = (type, title, message) => ({ type, title, message });

export const JD_CONFIDENCE_THRESHOLD = 0.9;

export const normalizeJDText = (value = '') => String(value || '').trim();

export const formatList = (items = []) => (items?.length ? items.map((item) => `• ${typeof item === 'string' ? item : item?.label || item?.name || item}`).join('\n') : 'N/A');

export const flattenTechnicalSkills = (technicalSkills = {}) => Object.values(technicalSkills || {}).flat().map((item) => item?.label || item?.name || item).filter(Boolean);

export const formatStructuredJobDescription = (rubric = {}) => {
  const overview = rubric.jobOverview || {};
  const sections = rubric.sections || {};
  const technicalSkills = flattenTechnicalSkills(sections.technicalSkills);

  return `# ${overview.title || rubric.title || 'Target Role'}\n\n## Job Overview\n${formatList([
    overview.companyName && `Company: ${overview.companyName}`,
    overview.companyWebsiteUrl && `Company website: ${overview.companyWebsiteUrl}`,
    overview.location && `Location: ${overview.location}`,
    overview.contractType && `Contract type: ${overview.contractType}`,
    overview.employmentType && `Employment type: ${overview.employmentType}`,
  ].filter(Boolean))}\n\n## What This Role Does\n${formatList(sections.responsibilities || rubric.roleSummary || [])}\n\n## Core Requirements\n${formatList(sections.mustHaveRequirements || rubric.mustHaveRequirements || [])}\n\n## Bonus Requirements\n${formatList(sections.niceToHaveRequirements || rubric.niceToHaveExperience || [])}\n\n## Technical Skills\n${formatList(technicalSkills)}\n\n## Soft Skills\n${formatList(sections.softSkills || rubric.softSkillRequirements || [])}\n\n## Benefits\n${formatList(sections.benefits || [])}\n\n## Application Notes\n${formatList(sections.applicationInstructions || [])}`;
};

export const getJDParseConfidence = (rubric) => {
  const confidence = Number(rubric?.diagnostics?.confidence ?? rubric?.metadata?.confidence ?? 0);
  return Number.isFinite(confidence) ? confidence : 0;
};

export const isNonEmptyObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length);
export const firstNonEmptyObject = (...values) => values.find(isNonEmptyObject) || null;

export const ANALYZE_TOUR_STEPS = [
  {
    target: '#tour-analyze-cv',
    content: 'Start by uploading a CV or choosing a recent one. Then review the parsed CV fields before moving to the JD step.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#tour-analyze-workflow',
    content: 'Use this preparation pipeline to move through CV review, JD review, session setup, device check for voice mode, and the final match result.',
    placement: 'bottom',
  },
  {
    target: '#tour-analyze-actions',
    content: 'Use this control panel for the current next step. It keeps the primary action and its status in one compact place.',
    placement: 'top',
    spotlightClicks: true,
  }
];

export const WORKFLOW_STEP_IDS = {
  CV_UPLOAD: 'cv_upload',
  CV_REVIEW: 'cv_review',
  JD_INPUT: 'jd_input',
  JD_REVIEW: 'jd_review',
  SESSION_SETUP: 'session_setup',
  MATCH_RESULT: 'match_result',
};

export const resolveDraftWorkflowStep = (draft = {}) => {
  const selectedCvId = draft.selectedCV?.id;
  const hasSelectedCV = Boolean(selectedCvId);
  const isDraftCvVerified = Boolean(
    hasSelectedCV
    && draft.cvReviewStatus === 'verified'
    && draft.cvHumanReviewedFileId === selectedCvId
  );
  const rawJDText = normalizeJDText(draft.rawJD);
  const hasDraftJDSummary = Boolean(
    draft.structuredJD
    && draft.structuredJDRubric
    && rawJDText
    && rawJDText === normalizeJDText(draft.summarizedRawJD)
  );
  const isDraftJDVerified = Boolean(hasDraftJDSummary && draft.jdReviewStatus === 'verified');

  if (!hasSelectedCV) return WORKFLOW_STEP_IDS.CV_UPLOAD;
  if (!isDraftCvVerified) return WORKFLOW_STEP_IDS.CV_REVIEW;
  if (!rawJDText) return WORKFLOW_STEP_IDS.JD_INPUT;
  if (!isDraftJDVerified) return hasDraftJDSummary ? WORKFLOW_STEP_IDS.JD_REVIEW : WORKFLOW_STEP_IDS.JD_INPUT;
  return WORKFLOW_STEP_IDS.SESSION_SETUP;
};
