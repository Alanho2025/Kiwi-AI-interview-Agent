import { JdQuestionFilter } from '../../db/models/jdQuestionFilterModel.js';
import { ensureArray, normalizeKey, unique } from '../../utils/commonHelpers.js';
import { getCvQuestionSeeds } from './cvQuestionSeedService.js';
import { extractTextList, questionRetentionDate } from './questionArtifactHelpers.js';

const decisionScoreThresholds = {
  suppressConfidence: 0.35,
  boostMatchScore: 1,
};

const buildJdProfile = ({ jdRubric = {}, analysisResult = {} } = {}) => {
  const hints = analysisResult?.matchingDetails?.questionPlanHints || {};
  const parsedJd = analysisResult?.parsedJdProfile || jdRubric || {};
  const requirements = ensureArray(analysisResult?.requirementChecks)
    .concat(ensureArray(parsedJd.mustHaveRequirements))
    .concat(ensureArray(parsedJd.microCriteria));
  const prioritySkills = unique([
    ...extractTextList(parsedJd.technicalSkillRequirements, parsedJd.softSkillRequirements),
    ...extractTextList(parsedJd.prioritySkills, parsedJd.requiredSkills),
    ...extractTextList(hints.mustProbeSkills, hints.priorityTopics),
    ...ensureArray(analysisResult?.matchingDetails?.topMatchedSkills),
  ]);

  return {
    roleCanonical: parsedJd.roleCanonical || hints.roleCanonical || analysisResult.jobTitle || '',
    roleFamily: parsedJd.roleFamily || '',
    roleLevel: parsedJd.roleLevel || parsedJd.seniority || '',
    companyName: parsedJd.companyName || parsedJd.jobOverview?.companyName || analysisResult.companyName || '',
    mustHaveRequirements: requirements.slice(0, 20),
    prioritySkills: prioritySkills.slice(0, 20),
    behaviouralFocus: unique([
      ...extractTextList(parsedJd.behaviouralFocus, parsedJd.softSkillRequirements),
      ...extractTextList(hints.mustProbeBehavioural),
    ]).slice(0, 12),
    companyValues: extractTextList(parsedJd.companyValues, parsedJd.values).slice(0, 12),
    cultureFitDimensions: extractTextList(parsedJd.cultureFitDimensions, parsedJd.workplaceCulture).slice(0, 12),
  };
};

const countTagMatches = (seed = {}, jdProfile = {}) => {
  const jdTokens = new Set(jdProfile.prioritySkills.flatMap((skill) => normalizeKey(skill).split(/\s+/)).filter(Boolean));
  const seedTokens = new Set([
    ...ensureArray(seed.skillTags),
    seed.topic,
    seed.evidenceSummary,
  ].flatMap((value) => normalizeKey(value).split(/\s+/)).filter(Boolean));

  let matches = 0;
  seedTokens.forEach((token) => {
    if (jdTokens.has(token)) matches += 1;
  });
  return matches;
};

const shouldAdapt = (seed = {}, jdProfile = {}) => {
  const topicKey = normalizeKey(seed.topic);
  return jdProfile.prioritySkills.some((skill) => {
    const skillKey = normalizeKey(skill);
    return skillKey && !topicKey.includes(skillKey) && countTagMatches(seed, { ...jdProfile, prioritySkills: [skill] }) > 0;
  });
};

const buildAdaptedText = (seed = {}, jdProfile = {}) => {
  const prioritySkill = jdProfile.prioritySkills.find((skill) => countTagMatches(seed, { ...jdProfile, prioritySkills: [skill] }) > 0);
  if (!prioritySkill) return seed.draftQuestion || seed.fallbackText;
  if (seed.category === 'behavioural') {
    return `Tell me about a time you showed ${seed.topic} in a situation relevant to ${prioritySkill}. What did you do, and what changed afterwards?`;
  }
  return `Tell me about one example where your ${seed.topic} experience connects to ${prioritySkill}. What did you personally own, and how did you validate the result?`;
};

const decideSeed = (seed = {}, jdProfile = {}, analysisResult = {}) => {
  const confidence = Number(seed.confidence || 0);
  const matchCount = countTagMatches(seed, jdProfile);
  const priorityTopicKeys = ensureArray(analysisResult?.matchingDetails?.questionPlanHints?.priorityTopics).map(normalizeKey);
  const isPriorityTopic = priorityTopicKeys.some((topic) => topic && normalizeKey(seed.topic).includes(topic));
  const isBehavioural = normalizeKey(seed.category).includes('behaviour');

  if (confidence < decisionScoreThresholds.suppressConfidence && matchCount === 0 && !isBehavioural) {
    return { decision: 'suppress', reason: 'Low confidence CV seed with no JD priority match.', scoreDelta: -0.35 };
  }
  if (matchCount >= decisionScoreThresholds.boostMatchScore || isPriorityTopic) {
    const adapt = shouldAdapt(seed, jdProfile);
    return {
      decision: adapt ? 'adapt' : 'boost',
      reason: adapt ? 'JD priority changes the angle for this CV evidence.' : 'CV seed matches JD priority skills or planned topics.',
      scoreDelta: adapt ? 0.25 : 0.2,
      adaptedQuestionText: adapt ? buildAdaptedText(seed, jdProfile) : null,
    };
  }
  if (isBehavioural) {
    return { decision: 'keep', reason: 'Behavioural seed remains useful for STAR-style evidence.', scoreDelta: 0.05 };
  }
  return { decision: 'keep', reason: 'CV seed remains generally relevant but is not a top JD priority.', scoreDelta: 0 };
};

export const applyJdFilterToCvSeeds = ({ cvSeeds = [], jdProfile = {}, analysisResult = {} } = {}) => {
  const decisions = ensureArray(cvSeeds).map((seed) => ({
    seedId: seed.seedId,
    topic: seed.topic,
    category: seed.category,
    sourceType: seed.sourceType,
    ...decideSeed(seed, jdProfile, analysisResult),
  }));

  return {
    decisions,
    boostedSeedIds: decisions.filter((item) => item.decision === 'boost').map((item) => item.seedId),
    suppressedSeedIds: decisions.filter((item) => item.decision === 'suppress').map((item) => item.seedId),
    adaptedSeedIds: decisions.filter((item) => item.decision === 'adapt').map((item) => item.seedId),
    keptSeedIds: decisions.filter((item) => item.decision === 'keep').map((item) => item.seedId),
  };
};

export const buildJdQuestionFilter = async ({
  userId,
  cvFileId,
  jdFingerprint = '',
  jdRubric = {},
  analysisResult = {},
  matchAnalysisId = null,
} = {}) => {
  if (!userId || !cvFileId) return null;
  const cvSeeds = await getCvQuestionSeeds({ userId, cvFileId, status: 'active' });
  const jdProfile = buildJdProfile({ jdRubric, analysisResult });
  const filter = applyJdFilterToCvSeeds({ cvSeeds, jdProfile, analysisResult });
  const document = {
    userId,
    jdFingerprint: jdFingerprint || analysisResult?.parsedJdProfile?.metadata?.jdFingerprint || '',
    matchAnalysisId,
    schemaVersion: 'v1',
    ...jdProfile,
    boostedSeedIds: filter.boostedSeedIds,
    suppressedSeedIds: filter.suppressedSeedIds,
    adaptedSeedIds: filter.adaptedSeedIds,
    keptSeedIds: filter.keptSeedIds,
    filterDecisions: filter.decisions,
    retentionUntil: questionRetentionDate(),
  };

  return JdQuestionFilter.findOneAndUpdate(
    { userId, matchAnalysisId: matchAnalysisId || null, jdFingerprint: document.jdFingerprint },
    document,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

export const getJdQuestionFilter = async ({ userId, matchAnalysisId = null, jdFingerprint = '' } = {}) => {
  if (!userId) return null;
  if (!matchAnalysisId && !jdFingerprint) return null;
  const query = { userId };
  if (matchAnalysisId) query.matchAnalysisId = matchAnalysisId;
  else query.jdFingerprint = jdFingerprint || '';
  return JdQuestionFilter.findOne(query).sort({ updatedAt: -1 }).lean();
};

export const buildJdQuestionFilterProfile = buildJdProfile;
