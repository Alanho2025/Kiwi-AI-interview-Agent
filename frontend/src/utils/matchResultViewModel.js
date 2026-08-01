import { isJobDescriptionSectionHeading } from './jobDescriptionSectionHeadingGuard.js';

const decisionCopy = {
  strong_match: {
    label: 'Strong match',
    tone: 'success',
    summary: 'Your CV gives you a strong starting point for this interview. Focus on making the strongest evidence concrete.',
  },
  moderate_match: {
    label: 'Partial match',
    tone: 'info',
    summary: 'Your CV has relevant evidence, but the interview should make the role-critical examples more specific.',
  },
  borderline: {
    label: 'Partial match',
    tone: 'warning',
    summary: 'There is some relevant evidence, but several role-critical areas need clearer examples.',
  },
  weak_match: {
    label: 'Needs more evidence',
    tone: 'warning',
    summary: 'The CV does not yet show enough clear evidence for several important parts of this role.',
  },
  not_qualified: {
    label: 'Needs more evidence',
    tone: 'danger',
    summary: 'Important requirements do not yet have clear work or project evidence in the CV.',
  },
  manual_review: {
    label: 'Needs more evidence',
    tone: 'warning',
    summary: 'The available CV evidence needs closer validation before it can support this role confidently.',
  },
};

const QUALIFICATION_TOPIC_PATTERN = /\b(?:academic|bachelor'?s?|degree|diploma|doctorate|education|master'?s?|phd|qualification|tertiary|university)\b/i;

const normalizeKey = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const cleanText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const extractNoteField = (item = {}, field) => {
  const match = String(item?.notes || item?.detail || '').match(new RegExp(`${field}=([^;]+)`, 'i'));
  return cleanText(match?.[1]);
};

const getRequirementByLabel = (requirements = [], label = '') => {
  const normalizedLabel = normalizeKey(label);
  return requirements.find((item) => {
    const key = normalizeKey(item?.label);
    return key && normalizedLabel && (key === normalizedLabel || key.includes(normalizedLabel) || normalizedLabel.includes(key));
  }) || null;
};

const isQualificationRequirement = (requirement = {}) => ['education', 'qualification'].includes(requirement?.category)
  || QUALIFICATION_TOPIC_PATTERN.test(requirement?.label || '');

const isQualificationTopic = ({ item = {}, requirement = null } = {}) => isQualificationRequirement(requirement || {})
  || QUALIFICATION_TOPIC_PATTERN.test(item.roleIntent || item.label || '');

const sectionLabel = (section = '') => {
  const normalizedSection = String(section || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (['experience', 'workexperience', 'employment', 'workhistory', 'career'].includes(normalizedSection)) return 'Work experience';
  if (['project', 'projects'].includes(normalizedSection)) return 'Project';
  return '';
};

const findCvExample = (sourceEvidence = []) => {
  const evidence = sourceEvidence.find((item) => sectionLabel(item?.sourceTrace?.section));
  if (!evidence) return null;

  const text = cleanText(evidence.text);
  if (!text) return null;

  return {
    text,
    source: sectionLabel(evidence.sourceTrace?.section),
    title: cleanText(evidence.title),
  };
};

const topicPriority = (topic) => {
  if (topic.needsEvidence && topic.priority === 'high') return 0;
  if (topic.priority === 'high') return 1;
  if (topic.classification === 'direct') return 2;
  return 3;
};

const buildTopic = ({ item = {}, requirement = null }) => {
  const example = findCvExample(item.sourceEvidence);
  const requirementStatus = requirement?.status || item.requirementStatus || 'not_mapped';
  const needsEvidence = !example || ['not_met', 'inferred'].includes(requirementStatus) || item.classification === 'gap';
  const missingEvidence = extractNoteField(requirement, 'missingEvidence');
  const interviewerProbe = extractNoteField(requirement, 'interviewProbe');
  const topic = cleanText(item.roleIntent || item.label || requirement?.label);

  return {
    id: item.roleIntentId || item.id || requirement?.id || topic,
    topic,
    priority: item.priority || requirement?.importance || 'medium',
    classification: item.classification || (requirementStatus === 'not_met' ? 'gap' : 'adjacent'),
    example,
    needsEvidence,
    evidenceLimit: example
      ? cleanText(item.limitation) || missingEvidence || 'No material evidence gap was identified for this topic.'
      : 'The CV does not provide a direct example for this topic.',
    followUp: interviewerProbe || `Can you walk me through a specific example of ${topic}?`,
  };
};

const buildTopicCandidates = (analysisResult = {}) => {
  const requirements = Array.isArray(analysisResult.requirementChecks) ? analysisResult.requirementChecks : [];
  const roleEvidenceMap = analysisResult.roleEvidenceMap || analysisResult.matchingDetails?.roleEvidenceMap || {};
  const candidates = (roleEvidenceMap.items || [])
    .map((item) => ({ item, requirement: getRequirementByLabel(requirements, item.roleIntent || item.label) }))
    .filter(({ item, requirement }) => !isJobDescriptionSectionHeading(item.roleIntent || item.label)
      && !isQualificationTopic({ item, requirement }))
    .map(({ item, requirement }) => buildTopic({ item, requirement }));

  const seen = new Set(candidates.map((topic) => normalizeKey(topic.topic)).filter(Boolean));
  requirements.forEach((requirement) => {
    const key = normalizeKey(requirement?.label);
    if (!key || seen.has(key) || isJobDescriptionSectionHeading(requirement.label) || isQualificationRequirement(requirement)) return;
    candidates.push(buildTopic({ item: { label: requirement.label, priority: requirement.importance }, requirement }));
    seen.add(key);
  });

  return candidates
    .filter((topic) => topic.topic)
    .sort((left, right) => topicPriority(left) - topicPriority(right));
};

const selectPreparationTopics = (candidates = []) => {
  const selected = [];
  let evidenceGapCount = 0;

  candidates.forEach((topic) => {
    if (selected.length >= 5 || (topic.needsEvidence && evidenceGapCount >= 2)) return;
    selected.push(topic);
    if (topic.needsEvidence) evidenceGapCount += 1;
  });

  return selected;
};

const hasTwoHighPriorityTopicsWithoutDirectExample = (topics = []) => topics
  .filter((topic) => !topic.example && String(topic.priority).toLowerCase() === 'high')
  .length >= 2;

const resolvePreparationDecision = (decisionKey, topics) => {
  if (decisionKey === 'strong_match' && hasTwoHighPriorityTopicsWithoutDirectExample(topics)) {
    return decisionCopy.moderate_match;
  }
  return decisionCopy[decisionKey] || decisionCopy.manual_review;
};

export const buildMatchResultViewModel = (analysisResult = {}) => {
  const decisionKey = analysisResult?.decision?.label || 'manual_review';
  const topics = selectPreparationTopics(buildTopicCandidates(analysisResult));
  const decision = resolvePreparationDecision(decisionKey, topics);

  return {
    decision,
    topics,
    topicShortfall: topics.length > 0 && topics.length < 3,
  };
};
