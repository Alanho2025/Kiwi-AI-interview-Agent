/**
 * File responsibility: Analyze page draft persistence.
 * Main responsibilities:
 * - Restore CV, JD, and analysis draft content between page visits.
 * - Reuse the shared session settings source so Home and Analyze stay aligned.
 * - Keep microphone and speaker checks out of draft defaults because they run inside Voice Session.
 */

import {
  DEFAULT_ANALYZE_MODE,
  DEFAULT_SESSION_SETTINGS,
  loadSessionDefaults,
  sanitizeSessionMode,
  sanitizeSessionSettings,
} from './sessionSettings.js';

export const ANALYZE_DRAFT_KEY = 'kiwi-analyze-draft';
export { DEFAULT_ANALYZE_MODE, DEFAULT_SESSION_SETTINGS as DEFAULT_ANALYZE_SETTINGS, sanitizeSessionMode as sanitizeAnalyzeMode, sanitizeSessionSettings as sanitizeAnalyzeSettings };

const MAX_RAW_JD_DRAFT_LENGTH = 50000;
const MAX_STRUCTURED_JD_DRAFT_LENGTH = 20000;
const MAX_SUMMARY_DRAFT_LENGTH = 10000;
const MAX_REVIEW_DRAFT_LENGTH = 50000;
const MAX_OBJECT_STRING_LENGTH = 10000;

const truncateText = (value = '', maxLength = 10000) => {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const compactObject = (value, maxStringLength = MAX_OBJECT_STRING_LENGTH) => {
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => compactObject(item, maxStringLength));
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? truncateText(value, maxStringLength) : value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .slice(0, 100)
      .map(([key, entryValue]) => [key, compactObject(entryValue, maxStringLength)])
  );
};

const sanitizeSelectedCv = (selectedCV) => {
  if (!selectedCV || typeof selectedCV !== 'object') {
    return null;
  }

  return {
    id: selectedCV.id || null,
    name: selectedCV.name || '',
    size: selectedCV.size || '',
    updated: selectedCV.updated || '',
    type: selectedCV.type || '',
    parseStatus: selectedCV.parseStatus || 'pending',
    profileStatus: selectedCV.profileStatus || 'pending',
    parseConfidence: Number.isFinite(Number(selectedCV.parseConfidence)) ? Number(selectedCV.parseConfidence) : null,
    parseWarnings: Array.isArray(selectedCV.parseWarnings) ? selectedCV.parseWarnings.slice(0, 20) : [],
    candidateName: selectedCV.candidateName || 'Candidate',
    topSkills: Array.isArray(selectedCV.topSkills) ? selectedCV.topSkills.slice(0, 100) : [],
    summary: truncateText(selectedCV.summary || '', MAX_SUMMARY_DRAFT_LENGTH),
    warnings: Array.isArray(selectedCV.warnings) ? selectedCV.warnings.slice(0, 20) : [],
  };
};

const sanitizeCvReviewProfile = (profile) => {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  return {
    candidateSummary: truncateText(profile.candidateSummary || '', MAX_SUMMARY_DRAFT_LENGTH),
    coreSkills: Array.isArray(profile.coreSkills) ? profile.coreSkills.slice(0, 100) : [],
    experienceEvidence: truncateText(profile.experienceEvidence || '', MAX_SUMMARY_DRAFT_LENGTH),
    projectEvidence: truncateText(profile.projectEvidence || '', MAX_SUMMARY_DRAFT_LENGTH),
    educationCredentials: truncateText(profile.educationCredentials || '', MAX_SUMMARY_DRAFT_LENGTH),
    certifications: truncateText(profile.certifications || profile.certificationsCredentials || '', MAX_SUMMARY_DRAFT_LENGTH),
    keyCompetencies: Array.isArray(profile.keyCompetencies) ? profile.keyCompetencies.slice(0, 100) : [],
  };
};

const sanitizeJdRubricDraft = (rubric) => {
  if (!rubric || typeof rubric !== 'object') {
    return null;
  }

  return {
    ...rubric,
    title: rubric.title || rubric.jobTitle || '',
    jobTitle: rubric.jobTitle || rubric.title || '',
    company: rubric.company || rubric.companyName || '',
    roleCanonical: rubric.roleCanonical || '',
    roleFamily: rubric.roleFamily || '',
    roleLevel: rubric.roleLevel || '',
    jobOverview: compactObject(rubric.jobOverview || {}),
    sections: compactObject(rubric.sections || {}),
    normalized: compactObject(rubric.normalized || {}),
    requirements: Array.isArray(rubric.requirements) ? compactObject(rubric.requirements) : [],
    interviewTargets: compactObject(rubric.interviewTargets || {}),
    behaviouralSignals: Array.isArray(rubric.behaviouralSignals) ? rubric.behaviouralSignals : [],
    universalRoleProfile: compactObject(rubric.universalRoleProfile || {}),
    weights: compactObject(rubric.weights || {}),
    metadata: compactObject(rubric.metadata || {}),
    safeguard: compactObject(rubric.safeguard || {}),
    roleFit: compactObject(rubric.roleFit || {}),
  };
};

const buildSafeAnalyzeDraft = (draft = {}) => ({
  selectedCV: sanitizeSelectedCv(draft.selectedCV),
  structuredCVProfile: sanitizeCvReviewProfile(draft.structuredCVProfile),
  rawJD: truncateText(draft.rawJD || '', MAX_RAW_JD_DRAFT_LENGTH),
  companyWebsiteUrl: truncateText(draft.companyWebsiteUrl || '', 1000),
  userCompanyContext: truncateText(draft.userCompanyContext || '', MAX_SUMMARY_DRAFT_LENGTH),
  structuredJD: truncateText(draft.structuredJD || '', MAX_STRUCTURED_JD_DRAFT_LENGTH),
  structuredJDRubric: sanitizeJdRubricDraft(draft.structuredJDRubric),
  summarizedRawJD: truncateText(draft.summarizedRawJD || '', MAX_SUMMARY_DRAFT_LENGTH),
  cvHumanReviewedFileId: draft.cvHumanReviewedFileId || '',
  cvReviewStatus: draft.cvReviewStatus || 'unreviewed',
  jdHumanReviewedRawJD: truncateText(draft.jdHumanReviewedRawJD || '', MAX_REVIEW_DRAFT_LENGTH),
  jdReviewStatus: draft.jdReviewStatus || 'unreviewed',
  settings: sanitizeSessionSettings(draft.settings),
  sessionMode: sanitizeSessionMode(draft.sessionMode),
});

const buildMinimalAnalyzeDraft = (draft = {}) => ({
  selectedCV: sanitizeSelectedCv(draft.selectedCV),
  structuredCVProfile: null,
  rawJD: truncateText(draft.rawJD || draft.summarizedRawJD || '', 2000),
  companyWebsiteUrl: truncateText(draft.companyWebsiteUrl || '', 1000),
  userCompanyContext: truncateText(draft.userCompanyContext || '', 1000),
  structuredJD: '',
  structuredJDRubric: null,
  summarizedRawJD: truncateText(draft.summarizedRawJD || '', 1000),
  cvHumanReviewedFileId: draft.cvHumanReviewedFileId || '',
  cvReviewStatus: draft.cvReviewStatus || 'unreviewed',
  jdHumanReviewedRawJD: '',
  jdReviewStatus: draft.jdReviewStatus || 'unreviewed',
  settings: sanitizeSessionSettings(draft.settings),
  sessionMode: sanitizeSessionMode(draft.sessionMode),
});

export const resolveAnalyzeStep = (analysisStatus) => {
  if (analysisStatus === 'matching' || analysisStatus === 'summarizing') {
    return 2;
  }

  if (analysisStatus === 'success') {
    return 3;
  }

  return 1;
};

export const loadAnalyzeDraft = () => {
  const homeDefaults = loadSessionDefaults();

  try {
    const savedDraft = window.localStorage.getItem(ANALYZE_DRAFT_KEY);
    if (!savedDraft) {
      return {
        selectedCV: null,
        structuredCVProfile: null,
        rawJD: '',
        companyWebsiteUrl: '',
        userCompanyContext: '',
        structuredJD: '',
        structuredJDRubric: null,
        summarizedRawJD: '',
        cvHumanReviewedFileId: '',
        cvReviewStatus: 'unreviewed',
        jdHumanReviewedRawJD: '',
        jdReviewStatus: 'unreviewed',
        settings: homeDefaults,
        sessionMode: DEFAULT_ANALYZE_MODE,
      };
    }

    const parsed = JSON.parse(savedDraft);

    return {
      selectedCV: sanitizeSelectedCv(parsed.selectedCV),
      structuredCVProfile: sanitizeCvReviewProfile(parsed.structuredCVProfile),
      rawJD: parsed.rawJD || '',
      companyWebsiteUrl: parsed.companyWebsiteUrl || '',
      userCompanyContext: parsed.userCompanyContext || '',
      structuredJD: parsed.structuredJD || '',
      structuredJDRubric: parsed.structuredJDRubric || null,
      summarizedRawJD: parsed.summarizedRawJD || '',
      cvHumanReviewedFileId: parsed.cvHumanReviewedFileId || '',
      cvReviewStatus: parsed.cvReviewStatus || 'unreviewed',
      jdHumanReviewedRawJD: parsed.jdHumanReviewedRawJD || '',
      jdReviewStatus: parsed.jdReviewStatus || 'unreviewed',
      settings: parsed.settings ? sanitizeSessionSettings(parsed.settings) : homeDefaults,
      sessionMode: sanitizeSessionMode(parsed.sessionMode),
    };
  } catch (error) {
    console.error('Failed to restore analyze draft', error);
    try {
      window.localStorage.removeItem(ANALYZE_DRAFT_KEY);
    } catch {
      // Ignore cleanup failure.
    }
    return {
      selectedCV: null,
      structuredCVProfile: null,
      rawJD: '',
      companyWebsiteUrl: '',
      userCompanyContext: '',
      structuredJD: '',
      structuredJDRubric: null,
      summarizedRawJD: '',
      cvHumanReviewedFileId: '',
      cvReviewStatus: 'unreviewed',
      jdHumanReviewedRawJD: '',
      jdReviewStatus: 'unreviewed',
      settings: homeDefaults,
      sessionMode: DEFAULT_ANALYZE_MODE,
    };
  }
};

export const persistAnalyzeDraft = (draft) => {
  try {
    window.localStorage.setItem(ANALYZE_DRAFT_KEY, JSON.stringify(buildSafeAnalyzeDraft(draft)));
  } catch (error) {
    console.warn('Analyze draft exceeded localStorage quota. Falling back to a compact draft.', error);
    try {
      window.localStorage.removeItem(ANALYZE_DRAFT_KEY);
      window.localStorage.setItem(ANALYZE_DRAFT_KEY, JSON.stringify(buildMinimalAnalyzeDraft(draft)));
    } catch (fallbackError) {
      console.warn('Failed to persist compact analyze draft. Continuing without local draft persistence.', fallbackError);
      try {
        window.localStorage.removeItem(ANALYZE_DRAFT_KEY);
      } catch {
        // Ignore cleanup failure.
      }
    }
  }
};
