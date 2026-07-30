/**
 * File responsibility: Shared session setting rules.
 * Main responsibilities:
 * - Keep Home and Analyze page interview setup options in one source of truth.
 * - Sanitize saved session defaults before they enter UI or API payloads.
 * - Keep voice device checks separate from defaults so Analyze can run them only for Voice Session.
 */

export const HOME_SESSION_DEFAULTS_KEY = 'kiwi-home-session-defaults';
export const DEFAULT_ANALYZE_MODE = 'text';
export const SESSION_MODE_OPTIONS = Object.freeze({
  text: 'text',
  voice: 'voice',
});

export const seniorityOptions = ['Junior/Grad', 'Intermediate', 'Senior'];
export const focusOptions = ['Technical', 'Behavioral', 'Combined'];
export const focusDisplayOptions = [
  { value: 'Technical', label: 'Role-specific / Technical' },
  { value: 'Behavioral', label: 'Behavioral' },
  { value: 'Combined', label: 'Combined' },
];
export const getFocusAreaLabel = (value = '') => focusDisplayOptions.find((option) => option.value === value)?.label || value;
export const sessionModeOptions = [
  { value: SESSION_MODE_OPTIONS.text, label: 'Text session' },
  { value: SESSION_MODE_OPTIONS.voice, label: 'Voice session' },
];
export const controlModeOptions = [
  { value: 'question_limited', label: 'Question-limited' },
  { value: 'time_limited', label: 'Time-limited' },
];
export const questionLimitOptions = [8, 12, 15];
export const timeLimitOptions = [15, 30];

export const DEFAULT_SESSION_SETTINGS = Object.freeze({
  seniorityLevel: 'Junior/Grad',
  enableNZCultureFit: false,
  focusArea: 'Combined',
  controlMode: 'question_limited',
  questionLimit: 8,
  timeLimitMinutes: 15,
});

const allowedSessionModes = new Set(Object.values(SESSION_MODE_OPTIONS));
const allowedControlModes = new Set(controlModeOptions.map((option) => option.value));
const allowedQuestionLimits = new Set(questionLimitOptions);
const allowedTimeLimits = new Set(timeLimitOptions);

const normalizeSeniorityDisplay = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'advanced' || normalized === 'senior') return 'Senior';
  if (normalized === 'intermediate') return 'Intermediate';
  if (['junior', 'junior/grad', 'grad', 'graduate'].includes(normalized)) return 'Junior/Grad';
  return value;
};

export const sanitizeSessionMode = (value) => (allowedSessionModes.has(value) ? value : DEFAULT_ANALYZE_MODE);
export const isSupportedSessionMode = (value) => allowedSessionModes.has(value);

export const sanitizeSessionSettings = (input = {}) => ({
  seniorityLevel: seniorityOptions.includes(normalizeSeniorityDisplay(input?.seniorityLevel))
    ? normalizeSeniorityDisplay(input.seniorityLevel)
    : DEFAULT_SESSION_SETTINGS.seniorityLevel,
  enableNZCultureFit: Boolean(input?.enableNZCultureFit),
  focusArea: focusOptions.includes(input?.focusArea)
    ? input.focusArea
    : DEFAULT_SESSION_SETTINGS.focusArea,
  controlMode: allowedControlModes.has(input?.controlMode)
    ? input.controlMode
    : DEFAULT_SESSION_SETTINGS.controlMode,
  questionLimit: allowedQuestionLimits.has(Number(input?.questionLimit))
    ? Number(input.questionLimit)
    : DEFAULT_SESSION_SETTINGS.questionLimit,
  timeLimitMinutes: allowedTimeLimits.has(Number(input?.timeLimitMinutes))
    ? Number(input.timeLimitMinutes)
    : DEFAULT_SESSION_SETTINGS.timeLimitMinutes,
});

export const loadSessionDefaults = () => {
  try {
    const rawDefaults = window.localStorage.getItem(HOME_SESSION_DEFAULTS_KEY);
    return rawDefaults
      ? sanitizeSessionSettings(JSON.parse(rawDefaults))
      : sanitizeSessionSettings(DEFAULT_SESSION_SETTINGS);
  } catch (error) {
    console.error('Failed to load session defaults', error);
    return sanitizeSessionSettings(DEFAULT_SESSION_SETTINGS);
  }
};

export const saveSessionDefaults = (settings) => {
  const nextSettings = sanitizeSessionSettings(settings);
  window.localStorage.setItem(HOME_SESSION_DEFAULTS_KEY, JSON.stringify(nextSettings));
  return nextSettings;
};

export const resetSessionDefaults = () => saveSessionDefaults(DEFAULT_SESSION_SETTINGS);

export const settingsSummary = (settings = DEFAULT_SESSION_SETTINGS) => {
  const safeSettings = sanitizeSessionSettings(settings);
  const controlMode = safeSettings.controlMode === 'time_limited' ? 'Time-limited' : 'Question-limited';
  const limit = safeSettings.controlMode === 'time_limited'
    ? `${safeSettings.timeLimitMinutes} minutes total`
    : `${safeSettings.questionLimit} questions`;

  return {
    level: safeSettings.seniorityLevel,
    focus: getFocusAreaLabel(safeSettings.focusArea),
    nzContext: safeSettings.enableNZCultureFit ? 'On' : 'Off',
    controlMode,
    limit,
  };
};

export const buildSessionSetupPayload = (settings, sessionMode) => {
  const safeSettings = sanitizeSessionSettings(settings);
  return {
    deliveryMode: sanitizeSessionMode(sessionMode),
    controlMode: safeSettings.controlMode,
    questionLimit: safeSettings.questionLimit,
    timeLimitMinutes: safeSettings.timeLimitMinutes,
    questionType: safeSettings.focusArea,
    seniorityLevel: safeSettings.seniorityLevel,
    enableNZCultureFit: safeSettings.enableNZCultureFit,
  };
};
