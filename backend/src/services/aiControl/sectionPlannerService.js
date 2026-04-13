const SECTIONS = [
  'introduction',
  'motivation',
  'experience',
  'behavioural',
  'technical',
  'reflection_close',
];

const SECTION_TARGETS = {
  introduction: ['self_intro'],
  motivation: ['motivation', 'role_fit'],
  experience: ['project', 'experience', 'ownership'],
  behavioural: ['teamwork', 'problem_solving'],
  technical: ['technical_depth', 'system_design', 'api_security'],
  reflection_close: ['growth', 'candidate_questions'],
};

const SECTION_ORDER = Object.fromEntries(SECTIONS.map((key, index) => [key, index]));

const normalizeTopics = (value = []) => (Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : []);

export const inferInterviewSection = ({ currentStage = '', currentTopic = '', coverageState = {}, dynamicSlotState = {} } = {}) => {
  const stage = String(currentStage || '').toLowerCase();
  const topic = String(currentTopic || '').toLowerCase();
  if (stage.includes('opening') || topic.includes('self_intro')) return 'introduction';
  if (topic.includes('motivation') || topic.includes('role_fit')) return 'motivation';
  if (stage.includes('behaviour') || topic.includes('team') || topic.includes('problem')) return 'behavioural';
  if (stage.includes('technical') || topic.includes('security') || topic.includes('design')) return 'technical';
  if (stage.includes('experience') || topic.includes('project') || topic.includes('ownership')) return 'experience';
  if (stage.includes('wrap') || topic.includes('candidate_questions')) return 'reflection_close';

  const missingTopics = normalizeTopics(coverageState.missingTopics);
  const activeSlots = normalizeTopics(dynamicSlotState.activeSlotTopics);
  if (missingTopics.some((item) => item.includes('motivation'))) return 'motivation';
  if (missingTopics.some((item) => item.includes('team') || item.includes('problem'))) return 'behavioural';
  if (activeSlots.some((item) => item.includes('security') || item.includes('design'))) return 'technical';
  return 'experience';
};

export const buildSectionState = ({ currentSection = 'introduction', coverageState = {}, dynamicSlotState = {} } = {}) => {
  const sectionKey = SECTIONS.includes(currentSection) ? currentSection : 'experience';
  const targetTopics = SECTION_TARGETS[sectionKey] || [];
  const coveredTopics = normalizeTopics(coverageState.coveredTopics);
  const missingTopics = normalizeTopics(coverageState.missingTopics);
  const relevantDynamicSlots = normalizeTopics(dynamicSlotState.activeSlotTopics).filter((item) =>
    targetTopics.some((target) => item.includes(target) || target.includes(item))
  );
  const coveredTargetCount = targetTopics.filter((item) => coveredTopics.includes(item)).length;
  const sectionCoverageScore = targetTopics.length ? Number((coveredTargetCount / targetTopics.length).toFixed(2)) : 0;
  const missingTopicsInSection = targetTopics.filter((item) => missingTopics.includes(item));
  const isSectionComplete = sectionCoverageScore >= 0.67 && missingTopicsInSection.length === 0 && coveredTargetCount > 0;
  return {
    sectionKey,
    targetTopics,
    missingTopicsInSection,
    relevantDynamicSlots,
    sectionCoverageScore,
    isSectionComplete,
    nextSectionKey: SECTIONS[SECTION_ORDER[sectionKey] + 1] || 'reflection_close',
  };
};
