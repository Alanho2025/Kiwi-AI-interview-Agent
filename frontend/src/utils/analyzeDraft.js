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
    parseWarnings: Array.isArray(selectedCV.parseWarnings) ? selectedCV.parseWarnings : [],
    candidateName: selectedCV.candidateName || 'Candidate',
    topSkills: Array.isArray(selectedCV.topSkills) ? selectedCV.topSkills : [],
    summary: selectedCV.summary || '',
    warnings: Array.isArray(selectedCV.warnings) ? selectedCV.warnings : [],
    profile: selectedCV.profile || null,
    display: selectedCV.display || null,
  };
};

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
        rawJD: '',
        structuredJD: '',
        structuredJDRubric: null,
        summarizedRawJD: '',
        jdHumanReviewedRawJD: '',
        jdReviewStatus: 'unreviewed',
        settings: homeDefaults,
        sessionMode: DEFAULT_ANALYZE_MODE,
      };
    }

    const parsed = JSON.parse(savedDraft);

    return {
      selectedCV: sanitizeSelectedCv(parsed.selectedCV),
      rawJD: parsed.rawJD || '',
      structuredJD: parsed.structuredJD || '',
      structuredJDRubric: parsed.structuredJDRubric || null,
      summarizedRawJD: parsed.summarizedRawJD || '',
      jdHumanReviewedRawJD: parsed.jdHumanReviewedRawJD || '',
      jdReviewStatus: parsed.jdReviewStatus || 'unreviewed',
      settings: parsed.settings ? sanitizeSessionSettings(parsed.settings) : homeDefaults,
      sessionMode: sanitizeSessionMode(parsed.sessionMode),
    };
  } catch (error) {
    console.error('Failed to restore analyze draft', error);
    return {
      selectedCV: null,
      rawJD: '',
      structuredJD: '',
      structuredJDRubric: null,
      summarizedRawJD: '',
      jdHumanReviewedRawJD: '',
      jdReviewStatus: 'unreviewed',
      settings: homeDefaults,
      sessionMode: DEFAULT_ANALYZE_MODE,
    };
  }
};

export const persistAnalyzeDraft = (draft) => {
  window.localStorage.setItem(ANALYZE_DRAFT_KEY, JSON.stringify({
    ...draft,
    settings: sanitizeSessionSettings(draft.settings),
    sessionMode: sanitizeSessionMode(draft.sessionMode),
    selectedCV: sanitizeSelectedCv(draft.selectedCV),
  }));
};
