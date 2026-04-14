const SENIORITY_BLUEPRINTS = {
  junior: {
    level: 'junior',
    totalQuestions: 8,
    freshTurnAnchors: [1, 4, 7],
    maxFollowUpsPerTopic: 2,
    openingStyle: 'warm_direct',
    strategy: { opening: 1, followUp: 3, technical: 2, behavioural: 2 },
  },
  intermediate: {
    level: 'intermediate',
    totalQuestions: 8,
    freshTurnAnchors: [1, 4, 7],
    maxFollowUpsPerTopic: 2,
    openingStyle: 'warm_relevant',
    strategy: { opening: 1, followUp: 3, technical: 2, behavioural: 2 },
  },
  advanced: {
    level: 'advanced',
    totalQuestions: 8,
    freshTurnAnchors: [1, 4, 7],
    maxFollowUpsPerTopic: 2,
    openingStyle: 'executive_structured',
    strategy: { opening: 1, followUp: 2, technical: 3, behavioural: 2 },
  },
};

export const normalizeSeniorityLevelKey = (value = 'junior') => {
  const normalized = String(value || 'junior').trim().toLowerCase();
  if (['junior', 'junior/grad', 'grad', 'graduate'].includes(normalized)) return 'junior';
  if (['intermediate', 'mid', 'mid-level', 'midlevel'].includes(normalized)) return 'intermediate';
  if (['advanced', 'advance', 'senior'].includes(normalized)) return 'advanced';
  return 'junior';
};

export const normalizeFocusAreaKey = (value = 'combined') => {
  const normalized = String(value || 'combined').trim().toLowerCase();
  if (normalized === 'technical') return 'technical';
  if (['behavioral', 'behavioural'].includes(normalized)) return 'behavioral';
  return 'combined';
};

export const buildInterviewModeKey = ({ seniorityLevel = 'junior', focusArea = 'combined' } = {}) => `${normalizeSeniorityLevelKey(seniorityLevel)}_${normalizeFocusAreaKey(focusArea)}`;

export const resolveInterviewBlueprint = (level = 'junior') => SENIORITY_BLUEPRINTS[normalizeSeniorityLevelKey(level)] || SENIORITY_BLUEPRINTS.junior;

export const resolveInterviewModeConfig = ({ seniorityLevel = 'junior', focusArea = 'combined' } = {}) => {
  const blueprint = resolveInterviewBlueprint(seniorityLevel);
  const normalizedFocusArea = normalizeFocusAreaKey(focusArea);
  const technicalTarget = blueprint.level === 'advanced' ? 3 : 2;
  const behaviouralTarget = 2;
  const combinedTechnicalTarget = blueprint.level === 'junior' ? 1 : 2;
  return {
    ...blueprint,
    seniorityKey: blueprint.level,
    focusAreaKey: normalizedFocusArea,
    interviewModeKey: buildInterviewModeKey({ seniorityLevel, focusArea }),
    allowedSections: normalizedFocusArea === 'technical'
      ? ['opening', 'technical', 'wrap_up']
      : normalizedFocusArea === 'behavioral'
        ? ['opening', 'behavioural', 'wrap_up']
        : ['opening', 'technical', 'behavioural', 'wrap_up'],
    minTechnicalQuestions: normalizedFocusArea === 'behavioral' ? 0 : normalizedFocusArea === 'combined' ? combinedTechnicalTarget : technicalTarget,
    minBehaviouralQuestions: normalizedFocusArea === 'technical' ? 0 : normalizedFocusArea === 'combined' ? 1 : behaviouralTarget,
  };
};

export const interviewBlueprints = SENIORITY_BLUEPRINTS;
