/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: analyzeDraft should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

export const ANALYZE_DRAFT_KEY = 'kiwi-analyze-draft';
export const HOME_SESSION_DEFAULTS_KEY = 'kiwi-home-session-defaults';

export const DEFAULT_ANALYZE_SETTINGS = {
  seniorityLevel: 'Junior/Grad',
  enableNZCultureFit: false,
  focusArea: 'Combined',
};

const ALLOWED_SENIORITY = new Set(['Junior/Grad', 'Mid-level', 'Senior']);
const ALLOWED_FOCUS = new Set(['Technical', 'Behavioral', 'Combined']);


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
    candidateName: selectedCV.candidateName || 'Candidate',
    topSkills: Array.isArray(selectedCV.topSkills) ? selectedCV.topSkills : [],
    summary: selectedCV.summary || '',
    warnings: Array.isArray(selectedCV.warnings) ? selectedCV.warnings : [],
    profile: selectedCV.profile || null,
    display: selectedCV.display || null,
  };
};

/**
 * Purpose: Execute the main responsibility for sanitizeAnalyzeSettings.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const sanitizeAnalyzeSettings = (input) => ({
  seniorityLevel: ALLOWED_SENIORITY.has(input?.seniorityLevel)
    ? input.seniorityLevel
    : DEFAULT_ANALYZE_SETTINGS.seniorityLevel,
  enableNZCultureFit: Boolean(input?.enableNZCultureFit),
  focusArea: ALLOWED_FOCUS.has(input?.focusArea)
    ? input.focusArea
    : DEFAULT_ANALYZE_SETTINGS.focusArea,
});

/**
 * Purpose: Execute the main responsibility for resolveAnalyzeStep.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const resolveAnalyzeStep = (analysisStatus) => {
  if (analysisStatus === 'matching' || analysisStatus === 'summarizing') {
    return 2;
  }

  if (analysisStatus === 'success') {
    return 3;
  }

  return 1;
};

/**
 * Purpose: Execute the main responsibility for loadHomeSessionDefaults.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const loadHomeSessionDefaults = () => {
  try {
    const rawHomeDefaults = window.localStorage.getItem(HOME_SESSION_DEFAULTS_KEY);
    return rawHomeDefaults
      ? sanitizeAnalyzeSettings(JSON.parse(rawHomeDefaults))
      : DEFAULT_ANALYZE_SETTINGS;
  } catch (error) {
    console.error('Failed to restore homepage session defaults', error);
    return DEFAULT_ANALYZE_SETTINGS;
  }
};

/**
 * Purpose: Execute the main responsibility for loadAnalyzeDraft.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const loadAnalyzeDraft = () => {
  const homeDefaults = loadHomeSessionDefaults();

  try {
    const savedDraft = window.localStorage.getItem(ANALYZE_DRAFT_KEY);
    if (!savedDraft) {
      return {
        selectedCV: null,
        rawJD: '',
        structuredJD: '',
        structuredJDRubric: null,
        summarizedRawJD: '',
        settings: homeDefaults,
      };
    }

    const parsed = JSON.parse(savedDraft);
    return {
      selectedCV: sanitizeSelectedCv(parsed.selectedCV),
      rawJD: parsed.rawJD || '',
      structuredJD: parsed.structuredJD || '',
      structuredJDRubric: parsed.structuredJDRubric || null,
      summarizedRawJD: parsed.summarizedRawJD || '',
      settings: parsed.settings ? sanitizeAnalyzeSettings(parsed.settings) : homeDefaults,
    };
  } catch (error) {
    console.error('Failed to restore analyze draft', error);
    return {
      selectedCV: null,
      rawJD: '',
      structuredJD: '',
      structuredJDRubric: null,
      summarizedRawJD: '',
      settings: homeDefaults,
    };
  }
};

/**
 * Purpose: Execute the main responsibility for persistAnalyzeDraft.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const persistAnalyzeDraft = (draft) => {
  window.localStorage.setItem(ANALYZE_DRAFT_KEY, JSON.stringify({
    ...draft,
    selectedCV: sanitizeSelectedCv(draft.selectedCV),
  }));
};
