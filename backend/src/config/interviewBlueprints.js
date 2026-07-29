const SENIORITY_BLUEPRINTS = {
  junior: {
    level: 'junior',
    freshTurnAnchors: [1, 4, 7, 10, 13],
    maxFollowUpsPerTopic: 2,
    openingStyle: 'warm_direct',
    strategy: { opening: 1, followUp: 3, technical: 2, behavioural: 2 },
  },
  intermediate: {
    level: 'intermediate',
    freshTurnAnchors: [1, 4, 7, 10, 13],
    maxFollowUpsPerTopic: 2,
    openingStyle: 'warm_relevant',
    strategy: { opening: 1, followUp: 3, technical: 2, behavioural: 2 },
  },
  senior: {
    level: 'senior',
    freshTurnAnchors: [1, 4, 7, 10, 13],
    maxFollowUpsPerTopic: 2,
    openingStyle: 'executive_structured',
    strategy: { opening: 1, followUp: 2, technical: 3, behavioural: 2 },
  },
};

const QUESTION_LIMITS = new Set([8, 12, 15]);
const TIME_LIMITS = new Set([15, 30]);

export const normalizeSeniorityLevelKey = (value = 'junior') => {
  const normalized = String(value || 'junior').trim().toLowerCase();
  if (['junior', 'junior/grad', 'grad', 'graduate'].includes(normalized)) return 'junior';
  if (['intermediate', 'mid', 'mid-level', 'midlevel'].includes(normalized)) return 'intermediate';
  if (['advanced', 'advance', 'senior'].includes(normalized)) return 'senior';
  return 'junior';
};

export const normalizeFocusAreaKey = (value = 'combined') => {
  const normalized = String(value || 'combined').trim().toLowerCase();
  if (normalized === 'technical') return 'technical';
  if (['behavioral', 'behavioural'].includes(normalized)) return 'behavioral';
  return 'combined';
};

export const normalizeControlMode = (value = 'question_limited') => (
  String(value || '').trim().toLowerCase() === 'time_limited' ? 'time_limited' : 'question_limited'
);

export const normalizeQuestionLimit = (value = 8) => {
  const parsed = Number(value);
  return QUESTION_LIMITS.has(parsed) ? parsed : 8;
};

export const normalizeTimeLimitMinutes = (value = 15) => {
  const parsed = Number(value);
  return TIME_LIMITS.has(parsed) ? parsed : 15;
};

export const resolveTimeLimitedQuestionCount = (minutes = 15) => (normalizeTimeLimitMinutes(minutes) === 30 ? 15 : 8);

export const buildInterviewModeKey = ({ seniorityLevel = 'junior', focusArea = 'combined', controlMode = 'question_limited' } = {}) => `${normalizeSeniorityLevelKey(seniorityLevel)}_${normalizeFocusAreaKey(focusArea)}_${normalizeControlMode(controlMode)}`;

export const resolveInterviewBlueprint = (level = 'junior') => SENIORITY_BLUEPRINTS[normalizeSeniorityLevelKey(level)] || SENIORITY_BLUEPRINTS.junior;

const resolveQuestionTargets = ({ focusAreaKey, totalQuestions }) => {
  const probeSlots = Math.max(1, Number(totalQuestions || 8) - 2);
  if (focusAreaKey === 'technical') {
    return { minTechnicalQuestions: probeSlots, minBehaviouralQuestions: 0 };
  }
  if (focusAreaKey === 'behavioral') {
    return { minTechnicalQuestions: 0, minBehaviouralQuestions: probeSlots };
  }
  return {
    minTechnicalQuestions: Math.ceil(probeSlots / 2),
    minBehaviouralQuestions: Math.floor(probeSlots / 2),
  };
};

export const resolveInterviewModeConfig = ({
  seniorityLevel = 'junior',
  focusArea = 'combined',
  questionType = null,
  controlMode = 'question_limited',
  questionLimit = 8,
  timeLimitMinutes = 15,
} = {}) => {
  const blueprint = resolveInterviewBlueprint(seniorityLevel);
  const normalizedFocusArea = normalizeFocusAreaKey(questionType || focusArea);
  const normalizedControlMode = normalizeControlMode(controlMode);
  const normalizedTimeLimitMinutes = normalizeTimeLimitMinutes(timeLimitMinutes);
  const totalQuestions = normalizedControlMode === 'time_limited'
    ? resolveTimeLimitedQuestionCount(normalizedTimeLimitMinutes)
    : normalizeQuestionLimit(questionLimit);
  const timeLimitSeconds = normalizedControlMode === 'time_limited' ? normalizedTimeLimitMinutes * 60 : null;
  const targets = resolveQuestionTargets({ focusAreaKey: normalizedFocusArea, totalQuestions });

  return {
    ...blueprint,
    totalQuestions,
    controlMode: normalizedControlMode,
    questionLimit: totalQuestions,
    timeLimitMinutes: normalizedControlMode === 'time_limited' ? normalizedTimeLimitMinutes : null,
    timeLimitSeconds,
    seniorityKey: blueprint.level,
    focusAreaKey: normalizedFocusArea,
    interviewModeKey: buildInterviewModeKey({ seniorityLevel, focusArea: normalizedFocusArea, controlMode: normalizedControlMode }),
    allowedSections: normalizedFocusArea === 'technical'
      ? ['opening', 'technical', 'wrap_up']
      : normalizedFocusArea === 'behavioral'
        ? ['opening', 'behavioural', 'wrap_up']
        : ['opening', 'technical', 'behavioural', 'wrap_up'],
    ...targets,
  };
};

export const interviewBlueprints = SENIORITY_BLUEPRINTS;
