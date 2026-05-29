import { CvQuestionSeed } from '../../db/models/cvQuestionSeedModel.js';
import { ensureArray, normalizeKey, normalizeText, unique } from '../../utils/commonHelpers.js';
import {
  compactEvidenceRefs,
  extractTextList,
  questionRetentionDate,
  stableQuestionId,
  clampWeight,
} from './questionArtifactHelpers.js';

const seedLimit = (settings = {}) => Math.min(Math.max(Number(settings.cvQuestionSeedLimit || 12), 4), 20);

const normalizeSkillTags = (items = []) => unique(ensureArray(items).map((item) => {
  if (typeof item === 'string') return item;
  return item?.label || item?.name || item?.skill || item?.topic || '';
}));

const buildSeed = ({
  userId,
  cvFileId,
  sourceType,
  topic,
  category,
  questionIntent,
  draftQuestion,
  evidenceSummary = '',
  evidenceRefs = [],
  expectedSignal = [],
  skillTags = [],
  projectTags = [],
  riskTags = [],
  priorityWeight = 0.5,
  confidence = 0.6,
  metadata = {},
}) => {
  const seedId = stableQuestionId('cvseed', [userId, cvFileId, sourceType, topic, category, questionIntent]);
  return {
    userId,
    cvFileId,
    seedId,
    schemaVersion: 'v1',
    sourceStage: 'cv_parse',
    sourceType,
    topic,
    category,
    competency: topic,
    questionIntent,
    draftQuestion,
    fallbackText: draftQuestion,
    evidenceRefs: compactEvidenceRefs(evidenceRefs),
    evidenceSummary,
    expectedSignal,
    riskTags,
    skillTags: normalizeSkillTags(skillTags),
    projectTags: normalizeSkillTags(projectTags),
    priorityWeight: clampWeight(priorityWeight),
    confidence: clampWeight(confidence),
    status: 'active',
    generationMethod: 'deterministic',
    metadata,
    retentionUntil: questionRetentionDate(),
  };
};

const extractProjectSeeds = ({ userId, cvFileId, evidenceProfile = {}, cvProfile = {} }) => {
  const projects = ensureArray(evidenceProfile.sections?.projects || cvProfile.projects).slice(0, 4);
  return projects.map((project, index) => {
    const title = normalizeText(project.title || project.projectTitle || project.name || `project ${index + 1}`);
    const skills = normalizeSkillTags(project.skills || project.skillTags || project.technologies || project.techStack || cvProfile.skills);
    const topic = skills[0] || title;
    return buildSeed({
      userId,
      cvFileId,
      sourceType: 'cv_project',
      topic,
      category: 'technical',
      questionIntent: 'validate_ownership',
      draftQuestion: `Tell me about one project where you used ${topic}. What did you personally own, and what result came from it?`,
      evidenceSummary: normalizeText(project.summary || project.description || title),
      evidenceRefs: [project],
      expectedSignal: ['personal_ownership', 'technical_depth', 'result_or_impact'],
      skillTags: skills,
      projectTags: [title],
      priorityWeight: 0.75,
      confidence: project.confidence || evidenceProfile.confidence || cvProfile.confidence || 0.65,
    });
  });
};

const extractCapabilitySeeds = ({ userId, cvFileId, evidenceProfile = {}, cvProfile = {} }) => {
  const capabilities = ensureArray(evidenceProfile.functionalCapabilities || cvProfile.capabilities).slice(0, 6);
  return capabilities.map((capability) => {
    const topic = normalizeText(capability.label || capability.name || capability.skill || capability.topic || capability);
    return buildSeed({
      userId,
      cvFileId,
      sourceType: 'cv_skill',
      topic,
      category: 'technical',
      questionIntent: 'validate_depth',
      draftQuestion: `Tell me about a concrete example where you used ${topic}. What decision or trade-off did you handle yourself?`,
      evidenceSummary: normalizeText(capability.summary || capability.evidence || topic),
      evidenceRefs: capability.evidenceItems || capability.evidenceRefs || [capability],
      expectedSignal: ['technical_depth', 'tradeoff', 'validation_method'],
      skillTags: [topic, ...(capability.relatedSkills || [])],
      priorityWeight: 0.68,
      confidence: capability.confidence || cvProfile.confidence || 0.6,
    });
  });
};

const extractBehaviouralSeeds = ({ userId, cvFileId, evidenceProfile = {}, cvProfile = {} }) => {
  const behaviours = ensureArray(evidenceProfile.behaviouralCapabilities || cvProfile.behaviouralCapabilities)
    .concat(['teamwork', 'communication', 'ownership'])
    .slice(0, 5);
  return behaviours.map((capability) => {
    const topic = normalizeText(capability.label || capability.name || capability.topic || capability);
    return buildSeed({
      userId,
      cvFileId,
      sourceType: 'cv_behavioural',
      topic,
      category: 'behavioural',
      questionIntent: 'behavioural_star',
      draftQuestion: `Tell me about a time you showed ${topic}. What was the situation, what did you do, and what changed afterwards?`,
      evidenceSummary: normalizeText(capability.summary || topic),
      evidenceRefs: capability.evidenceItems || capability.evidenceRefs || [capability],
      expectedSignal: ['situation', 'personal_action', 'result_or_impact'],
      skillTags: [topic],
      priorityWeight: 0.55,
      confidence: capability.confidence || 0.55,
    });
  });
};

const extractAchievementSeeds = ({ userId, cvFileId, evidenceProfile = {}, cvProfile = {} }) => {
  const achievements = extractTextList(evidenceProfile.quantifiedEvidence, cvProfile.achievements).slice(0, 3);
  return achievements.map((achievement) => buildSeed({
    userId,
    cvFileId,
    sourceType: 'cv_achievement',
    topic: 'measurable impact',
    category: 'experience',
    questionIntent: 'validate_result',
    draftQuestion: 'Pick one measurable result from your CV. What did you do personally, and how was the result measured?',
    evidenceSummary: achievement,
    evidenceRefs: [achievement],
    expectedSignal: ['personal_action', 'measurement', 'impact'],
    riskTags: ['result_validation'],
    priorityWeight: 0.62,
    confidence: cvProfile.confidence || 0.58,
  }));
};

const extractTransitionSeed = ({ userId, cvFileId, evidenceProfile = {}, cvProfile = {} }) => {
  const careerDirection = normalizeText(evidenceProfile.careerDirection || cvProfile.cvAnalysis?.careerDirection || '');
  const hasTransitionSignal = careerDirection || normalizeKey(cvProfile.summary || '').includes('transition');
  if (!hasTransitionSignal) return [];
  return [buildSeed({
    userId,
    cvFileId,
    sourceType: 'cv_transition',
    topic: careerDirection || 'career transition',
    category: 'experience',
    questionIntent: 'career_transition_story',
    draftQuestion: 'Walk me through your career direction. What evidence from your recent work best supports this move?',
    evidenceSummary: careerDirection || cvProfile.summary || '',
    expectedSignal: ['motivation', 'transferable_evidence', 'role_fit'],
    riskTags: ['career_transition'],
    priorityWeight: 0.5,
    confidence: 0.55,
  })];
};

const deduplicateSeeds = (seeds = []) => {
  const seen = new Set();
  return seeds.filter((seed) => {
    const projectKey = seed.sourceType === 'cv_project' ? normalizeKey(seed.projectTags?.[0] || '') : '';
    const key = [normalizeKey(seed.topic), normalizeKey(seed.category), normalizeKey(seed.questionIntent), projectKey].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return normalizeText(seed.draftQuestion);
  });
};

export const buildCvQuestionSeedCandidates = ({ userId, cvFileId, cvProfile = {}, settings = {} } = {}) => {
  const evidenceProfile = cvProfile?.evidenceProfile || {};
  const seeds = deduplicateSeeds([
    ...extractProjectSeeds({ userId, cvFileId, evidenceProfile, cvProfile }),
    ...extractCapabilitySeeds({ userId, cvFileId, evidenceProfile, cvProfile }),
    ...extractBehaviouralSeeds({ userId, cvFileId, evidenceProfile, cvProfile }),
    ...extractAchievementSeeds({ userId, cvFileId, evidenceProfile, cvProfile }),
    ...extractTransitionSeed({ userId, cvFileId, evidenceProfile, cvProfile }),
  ]);

  if (seeds.length) return seeds.slice(0, seedLimit(settings));

  return [buildSeed({
    userId,
    cvFileId,
    sourceType: 'cv_experience',
    topic: 'candidate background',
    category: 'experience',
    questionIntent: 'risk_probe',
    draftQuestion: 'Tell me about one recent piece of work from your CV. What did you own, and what result came from it?',
    evidenceSummary: normalizeText(cvProfile.summary || '').slice(0, 240),
    expectedSignal: ['specific_example', 'personal_ownership', 'result_or_impact'],
    priorityWeight: 0.45,
    confidence: cvProfile.confidence || 0.45,
  })];
};

export const generateCvQuestionSeeds = async ({ userId, cvFileId, cvProfile = {}, settings = {} } = {}) => {
  if (!userId || !cvFileId) return [];
  const seeds = buildCvQuestionSeedCandidates({ userId, cvFileId, cvProfile, settings });
  await CvQuestionSeed.updateMany({ userId, cvFileId }, { status: 'superseded' });
  for (const seed of seeds) {
    await CvQuestionSeed.findOneAndUpdate(
      { userId, cvFileId, seedId: seed.seedId },
      seed,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  return seeds;
};

export const getCvQuestionSeeds = async ({ userId, cvFileId, status = 'active' } = {}) => {
  if (!userId || !cvFileId) return [];
  const query = { userId, cvFileId };
  if (status) query.status = status;
  return CvQuestionSeed.find(query).sort({ priorityWeight: -1, createdAt: 1 }).lean();
};

export const deleteOrExpireCvQuestionSeeds = async ({ userId, cvFileId } = {}) => {
  if (!userId || !cvFileId) return { modifiedCount: 0 };
  return CvQuestionSeed.updateMany(
    { userId, cvFileId, status: { $ne: 'expired' } },
    { status: 'expired', retentionUntil: new Date() }
  );
};
