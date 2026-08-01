import { InterviewQuestionPoolItem } from '../../db/models/interviewQuestionPoolItemModel.js';
import { CompanyValuesProfile } from '../../db/models/companyValuesProfileModel.js';
import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';
import { buildQuestionPoolFromAnalysis } from '../session/sessionShared.js';
import { validatePreparedQuestionPool } from '../schemaValidationService.js';
import { getCvQuestionSeeds } from './cvQuestionSeedService.js';
import { getJdQuestionFilter } from './jdQuestionFilterService.js';
import { buildAssessmentKey, buildQuestionFingerprint } from './questionDeduplicationService.js';
import { buildRoleFitQuestionPool } from './roleSpecificPracticePlannerService.js';
import { applyUserInterviewMemoryQuestionPolicy } from '../aiControl/userInterviewMemoryService.js';
import {
  getSessionQuestionSet,
  getSessionQuestionSetItems,
  persistSessionQuestionSet,
} from './sessionQuestionSetService.js';
import {
  buildCatalogQuestionSnapshots,
  resolveCatalogSelectionContext,
  resolveScenarioEligibility,
  SCENARIO_COVERAGE_SLOT,
} from './questionCatalogSelectionService.js';
import { isJobDescriptionSectionHeading } from '../jobDescription/jobDescriptionSectionHeadingGuard.js';
import {
  buildModeCompatibility,
  clampWeight,
  normalizeCategory,
  questionRetentionDate,
  stableQuestionId,
} from './questionArtifactHelpers.js';
const BEHAVIOURAL_QUESTION_TEMPLATES = [
  (topic) =>
    `Tell me about a time you demonstrated ${topic}. What did you personally do, and what was the outcome?`,

  (topic) =>
    `Can you walk me through a situation where you needed to demonstrate ${topic}? What was your role, and how did it turn out?`,

  (topic) =>
    `Describe a real example where you demonstrated ${topic}. What actions did you take, and what changed as a result?`,

  (topic) =>
    `Think of a situation where ${topic} was important. How did you approach it, and what was the result?`,
];

const TECHNICAL_QUESTION_TEMPLATES = [
  (topic) =>
    `Tell me about a project involving ${topic}. What did you personally implement, and how did you validate it?`,

  (topic) =>
    `Can you describe a practical example involving ${topic}? What approach did you take, and how did you know it worked?`,

  (topic) =>
    `Walk me through a piece of work involving ${topic}. What technical decisions did you make, and how did you test the result?`,

  (topic) =>
    `What is the strongest example from your experience involving ${topic}? What did you build or change, and how did you evaluate it?`,
];
const stableStringHash = (value = '') => {
  let hash = 0;

  for (const char of String(value)) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }

  return Math.abs(hash);
};

const selectQuestionTemplate = ({
  templates = [],
  sessionId = '',
  topic = '',
  questionIntent = '',
} = {}) => {
  if (!templates.length) return null;

  const seed = `${sessionId}:${questionIntent}:${normalizeKey(topic)}`;
  const index = stableStringHash(seed) % templates.length;

  return templates[index];
};
const sourcePriority = {
  match_gap: 6,
  match_validation: 5,
  jd_filter: 4,
  jd_requirement: 4,
  cv_seed: 3,
  common_template: 2,
  catalog: 4,
  scenario_policy: 4,
  fallback: 1,
};

const REQUIREMENT_STATUS_POLICY = Object.freeze({
  not_met: { rank: 0, priorityWeight: 0.88, riskWeight: 0.92 },
  inferred: { rank: 1, priorityWeight: 0.74, riskWeight: 0.76 },
  partial: { rank: 2, priorityWeight: 0.64, riskWeight: 0.64 },
  met: { rank: 3, priorityWeight: 0.44, riskWeight: 0.4 },
});

const REQUIREMENT_IMPORTANCE_RANK = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
});

export const resolveCanonicalRequirementStatus = (value = '') => {
  const status = normalizeKey(value);
  return REQUIREMENT_STATUS_POLICY[status] ? status : 'not_met';
};

const resolveRequirementSelectionPriority = (requirement = {}, originalIndex = 0) => {
  const canonicalStatus = resolveCanonicalRequirementStatus(requirement.status);
  const statusPolicy = REQUIREMENT_STATUS_POLICY[canonicalStatus];
  const importance = normalizeKey(requirement.importance || 'medium');
  const importanceRank = REQUIREMENT_IMPORTANCE_RANK[importance] ?? REQUIREMENT_IMPORTANCE_RANK.medium;
  const isMustHave = Boolean(requirement.mustHave || requirement.type === 'hard');
  const importanceBoost = importanceRank <= REQUIREMENT_IMPORTANCE_RANK.high ? 0.03 : 0;
  const mustHaveBoost = isMustHave ? 0.05 : 0;

  return {
    canonicalStatus,
    statusRank: statusPolicy.rank,
    isMustHave,
    importance,
    importanceRank,
    originalIndex,
    priorityWeight: Math.min(1, statusPolicy.priorityWeight + mustHaveBoost + importanceBoost),
    riskWeight: Math.min(1, statusPolicy.riskWeight + mustHaveBoost),
  };
};

const compareRequirementSelectionPriority = (left, right) => (
  left.statusRank - right.statusRank
  || Number(right.isMustHave) - Number(left.isMustHave)
  || left.importanceRank - right.importanceRank
  || left.originalIndex - right.originalIndex
);

const isVoiceDeliveryMode = (value = '') => normalizeKey(value) === 'voice';

const resolveRoleDomain = (analysisResult = {}) => analysisResult?.parsedJdProfile?.universalRoleProfile?.roleDomain
  || analysisResult?.parsedJdProfile?.roleDomain
  || analysisResult?.parsedJdProfile?.metadata?.universalRoleProfile?.roleDomain
  || analysisResult?.matchingDetails?.rubric?.universalRoleProfile?.roleDomain
  || analysisResult?.scoreBreakdown?.semanticDimensions?.roleDomain
  || 'general';

const resolveQuestionFamily = ({ category = '', questionIntent = '', questionFamily = '' } = {}) => {
  if (questionFamily) return questionFamily;
  const normalizedCategory = normalizeCategory(category);
  const normalizedIntent = normalizeKey(questionIntent);
  if (normalizedCategory === 'behavioural' || normalizedIntent.includes('behaviour')) return 'behavioural';
  if (normalizedCategory === 'opening' || normalizedIntent.includes('self_intro')) return 'self_intro';
  if (normalizedCategory === 'motivation' || normalizedIntent.includes('motivation')) return 'motivation';
  if (normalizedCategory === 'closing') return 'conversation';
  return 'role_specific';
};

const resolveEvidenceMode = ({ capabilityGroup = '', questionIntent = '', text = '', evidenceMode = '' } = {}) => {
  if (evidenceMode) return evidenceMode;
  if (capabilityGroup === 'professional_credential') return 'credential_verification';
  const normalizedIntent = normalizeKey(questionIntent);
  const normalizedText = normalizeKey(text);
  if (normalizedIntent.includes('scenario') || /\b(if|would|suppose|imagine)\b/.test(normalizedText)) return 'scenario_reasoning';
  if (normalizedIntent.includes('knowledge') || /\b(explain|principle|standard|framework)\b/.test(normalizedText)) return 'knowledge_explanation';
  return 'past_example';
};

const resolveQuestionRole = ({ sourceStage = '', category = '', stage = '', questionRole = '' } = {}) => {
  if (['root_question', 'fallback_root', 'wrap_up'].includes(questionRole)) return questionRole;
  const normalizedCategory = normalizeCategory(category || stage);
  if (sourceStage === 'fallback') return 'fallback_root';
  if (['closing'].includes(normalizedCategory) || ['closing', 'wrap_up'].includes(stage)) return 'wrap_up';
  return 'root_question';
};

const resolveFollowUpStrategies = ({ followUpStrategies = [], followUpStrategy = '', questionIntent = '', evidenceNeed = [] } = {}) => {
  const explicit = ensureArray(followUpStrategies).filter(Boolean);
  if (explicit.length) return explicit;
  if (followUpStrategy) return [followUpStrategy];
  const needs = ensureArray(evidenceNeed);
  if (needs.includes('personal_ownership')) return ['ownership', 'technical_depth'];
  if (needs.includes('tradeoff')) return ['tradeoff', 'validation'];
  if (needs.includes('result_or_impact')) return ['result', 'reflection'];
  if (questionIntent === 'behavioural_star') return ['behavioural_action', 'result', 'reflection'];
  return ['ownership', 'validation', 'result'];
};

const buildBaseItem = ({
  userId,
  sessionId,
  cvFileId,
  matchAnalysisId,
  jdFingerprint,
  sourceStage,
  sourceType,
  category,
  stage,
  topic,
  questionIntent,
  questionRole = '',
  maxFollowUps = 2,
  text,
  fallbackText = '',
  priorityWeight = 0.5,
  coverageWeight = 0.5,
  riskWeight = 0.4,
  metadata = {},
  ...rest
}) => {
  const questionFamily = resolveQuestionFamily({ category, questionIntent, questionFamily: rest.questionFamily });
  const evidenceMode = resolveEvidenceMode({
    capabilityGroup: rest.capabilityGroup,
    questionIntent,
    text,
    evidenceMode: rest.evidenceMode,
  });
  const item = {
    userId,
    sessionId,
    matchAnalysisId,
    cvFileId,
    jdFingerprint,
    questionId: stableQuestionId('poolq', [sessionId, sourceStage, sourceType, category, topic, questionIntent, text]),
    schemaVersion: 'v3',
    sourceStage,
    questionRole: resolveQuestionRole({ sourceStage, category, stage, questionRole }),
    maxFollowUps: Math.max(0, Number.isFinite(Number(maxFollowUps)) ? Number(maxFollowUps) : 2),
    followUpStrategies: resolveFollowUpStrategies({
      followUpStrategies: rest.followUpStrategies,
      followUpStrategy: rest.followUpStrategy,
      questionIntent,
      evidenceNeed: rest.evidenceNeed || rest.expectedSignal,
    }),
    sourceType,
    category: normalizeCategory(category),
    stage: stage || normalizeCategory(category),
    topic: normalizeText(topic) || 'role_fit',
    competency: normalizeText(rest.competency || topic),
    questionIntent: questionIntent || 'collect_specific_example',
    text,
    fallbackText: fallbackText || text,
    spokenDraft: fallbackText || text,
    expectedSignal: ensureArray(rest.expectedSignal),
    evidenceNeed: ensureArray(rest.evidenceNeed || rest.expectedSignal),
    constraints: ensureArray(rest.constraints),
    followUpStrategy: rest.followUpStrategy || '',
    priorityWeight: clampWeight(priorityWeight),
    coverageWeight: clampWeight(coverageWeight),
    riskWeight: clampWeight(riskWeight),
    modeCompatibility: rest.modeCompatibility || buildModeCompatibility(category),
    status: 'active',
    generationMethod: rest.generationMethod || 'deterministic',
    metadata,
    questionFamily,
    evidenceMode,
    roleDomain: rest.roleDomain || 'general',
    requirementCategory: rest.requirementCategory || '',
    capabilityGroup: rest.capabilityGroup || '',
    retentionUntil: questionRetentionDate(),
    proofPointId: rest.proofPointId || '',
    coverageContractIds: ensureArray(rest.coverageContractIds),
    testedRoleIntentIds: ensureArray(rest.testedRoleIntentIds),
    recommendedEvidenceIds: ensureArray(rest.recommendedEvidenceIds),
    evidenceAngle: rest.evidenceAngle || '',
    evidenceMapStrength: clampWeight(rest.evidenceMapStrength, 0),
    coveragePriority: rest.coveragePriority || '',
    roleFitReason: rest.roleFitReason || '',
    ...rest,
  };
  return {
    ...item,
    assessmentKey: buildAssessmentKey({ ...item, turnKind: 'root_question' }),
    questionFingerprint: buildQuestionFingerprint(item.text || item.fallbackText),
  };
};

const mapLegacyQuestion = (question, context, index) => buildBaseItem({
  ...context,
  sourceStage: ['opening', 'motivation', 'closing', 'wrap_up'].includes(normalizeCategory(question.category || question.stage)) ? 'common_template' : 'legacy_plan',
  sourceType: question.sourceType || 'common_template',
  category: question.category || question.stage,
  stage: question.stage,
  topic: question.topic || question.matchedSkill || 'role_fit',
  questionIntent: question.questionIntent || question.type || 'legacy_question',
  text: question.text || question.fallbackText,
  fallbackText: question.fallbackText || question.text,
  priorityWeight: question.priorityWeight ?? question.confidence ?? 0.55,
  coverageWeight: question.coverageWeight ?? 0.55,
  riskWeight: question.riskWeight ?? 0.35,
  linkedCvEvidence: question.linkedCvEvidence || question.cvEvidenceRefs || [],
  linkedJdRequirement: question.linkedJdRequirement || [],
  requirementId: question.requirementId || question.matchedRequirementId || '',
  expectedSignal: question.expectedSignal || question.evidenceNeed || [],
  evidenceNeed: question.evidenceNeed || question.expectedSignal || [],
  metadata: { legacyQuestion: question, order: index },
});

const mapSeedQuestion = (seed, decision, context) => {
  const adaptedText = decision?.adaptedQuestionText || seed.draftQuestion || seed.fallbackText;
  return buildBaseItem({
    ...context,
    sourceStage: decision?.decision === 'adapt' ? 'jd_filter' : 'cv_seed',
    sourceSeedId: seed.seedId,
    sourceType: seed.sourceType || 'cv_template',
    category: seed.category,
    stage: seed.category,
    topic: seed.topic,
    competency: seed.competency,
    questionIntent: seed.questionIntent,
    text: adaptedText,
    fallbackText: adaptedText,
    linkedCvEvidence: seed.evidenceRefs || [],
    expectedSignal: seed.expectedSignal || [],
    evidenceNeed: seed.expectedSignal || [],
    priorityWeight: clampWeight((seed.priorityWeight || 0.5) + (decision?.scoreDelta || 0)),
    coverageWeight: decision?.decision === 'boost' || decision?.decision === 'adapt' ? 0.78 : 0.55,
    riskWeight: ensureArray(seed.riskTags).length ? 0.75 : 0.4,
    generationMethod: seed.generationMethod || 'deterministic',
    metadata: { filterDecision: decision || null, evidenceSummary: seed.evidenceSummary },
  });
};
const buildSpokenRequirementTopic = (requirement = {}) => {
  const rawTopic = normalizeText(
    requirement.requirement
    || requirement.label
    || requirement.skill
  );

  return rawTopic
    .replace(/^strong\s+/i, '')
    .replace(/^excellent\s+/i, '')
    .replace(/^proven\s+/i, '')
    .replace(/^demonstrated\s+/i, '')
    .replace(/^experience\s+(?:(?:in|with)\s+)?/i, '')
    .replace(/^ability\s+to\s+/i, '')
    .replace(/^knowledge\s+of\s+/i, '')
    .replace(/^proficiency\s+(?:in|with)\s+/i, '')
    .replace(/^familiarity\s+with\s+/i, '')
    .replace(/\s+skills?$/i, '')
    .trim();
};
const inferRequirementQuestionStrategy = (requirement = {}, context = {},) => {
  const rawTopic = normalizeText(
    requirement.requirement
    || requirement.label
    || requirement.skill
  );

  const spokenTopic = buildSpokenRequirementTopic(requirement);

  const category = normalizeKey(requirement.category);
  const capabilityGroup = normalizeKey(requirement.capabilityGroup);
  const lower = rawTopic.toLowerCase();

  const isQualification = (
    capabilityGroup === 'professional_credential'
    || category.includes('qualification')
    || category.includes('credential')
    || /qualification|degree|bachelor|master|diploma|certificate|licen[cs]e|registration/.test(lower)
  );
  const isBehaviouralRequirement = (
    category.includes('behaviour')
    || category.includes('soft')
    || capabilityGroup.includes('behaviour')
    || capabilityGroup.includes('interpersonal')
    || /communication|communicate|stakeholder|teamwork|collaboration|collaborative|leadership|lead\b|ownership|adaptability|adaptable|problem[- ]solving|attention to detail|customer focus|client relationship|conflict|prioriti[sz]ation|time management|organised|organized/.test(lower)
  );
  if (isQualification) {
    return {
      excludeFromInterview: true,
      exclusionReason: 'qualification_verified_outside_interview',
    };
  }
  
  if (isBehaviouralRequirement) {
    const template = selectQuestionTemplate({
      templates: BEHAVIOURAL_QUESTION_TEMPLATES,
      sessionId: context.sessionId,
      topic: spokenTopic,
      questionIntent: 'behavioural_star',
    });
    return {
      excludeFromInterview: false,
      category: 'behavioural',
      questionIntent: 'behavioural_star',
      evidenceMode: 'past_example',
      expectedSignal: [
        'specific_example',
        'personal_action',
        'result_or_impact',
      ],
      text: template(spokenTopic),
    };
  }
  const template = selectQuestionTemplate({
    templates: TECHNICAL_QUESTION_TEMPLATES,
    sessionId: context.sessionId,
    topic: spokenTopic,
    questionIntent: 'technical_evidence',
  });
  return {
    excludeFromInterview: false,
    category: 'technical',
    questionIntent: 'technical_evidence',
    evidenceMode: 'past_example',
    expectedSignal: [
      'technical_context',
      'personal_ownership',
      'approach',
      'validation_method',
      'result_or_impact',
    ],
    text: template(spokenTopic),
  };
};

const buildRequirementItems = (analysisResult, context) =>
  ensureArray(analysisResult?.requirementChecks)
    .filter((item) => {
      const topic = item?.requirement || item?.label || item?.skill;

      return Boolean(
        topic
        && !isJobDescriptionSectionHeading(topic)
      );
    })
    .map((requirement, originalIndex) => {
      const topic = requirement.requirement
        || requirement.label
        || requirement.skill;

      const strategy = inferRequirementQuestionStrategy(requirement,context);

      return {
        requirement,
        topic,
        strategy,
        selectionPriority: resolveRequirementSelectionPriority(requirement, originalIndex),
      };
    })
    .filter(({ strategy }) => !strategy.excludeFromInterview)
    .sort((left, right) => compareRequirementSelectionPriority(
      left.selectionPriority,
      right.selectionPriority,
    ))
    .map(({ requirement, topic, strategy, selectionPriority }) =>
      buildBaseItem({
        ...context,
        sourceStage: 'match_validation',
        sourceType: 'jd_requirement',
        category: strategy.category,
        stage: 'role_requirement',
        topic,
        questionIntent: strategy.questionIntent,
        evidenceMode: strategy.evidenceMode,
        text: strategy.text,
        fallbackText: strategy.text,
        linkedJdRequirement: [requirement],
        requirementId:
          requirement.requirementId
          || requirement.id
          || normalizeKey(topic),
        roleDomain:
          requirement.roleDomain
          || resolveRoleDomain(analysisResult),
        requirementCategory: requirement.category || '',
        capabilityGroup: requirement.capabilityGroup || '',
        expectedSignal: strategy.expectedSignal,
        evidenceNeed: strategy.expectedSignal,
        priorityWeight: selectionPriority.priorityWeight,
        coverageWeight: 0.78,
        riskWeight: selectionPriority.riskWeight,
        metadata: {
          requirementSelection: {
            canonicalStatus: selectionPriority.canonicalStatus,
            isMustHave: selectionPriority.isMustHave,
            importance: selectionPriority.importance,
          },
        },
      })
    );

const INTERNAL_GAP_LANGUAGE = /\b(?:limited|missing|insufficient)\s+(?:direct\s+)?evidence\b|\b(?:possible|match)\s+gap\b|\b(?:coverage|score|risk|requirement)\b/i;

const resolveVoiceGapTopic = (gap = {}) => {
  if (!gap || typeof gap !== 'object') return 'this role';
  const skill = gap.requirement || gap.matchedSkill || gap.skill || gap.category;
  if (skill && typeof skill === 'string' && !INTERNAL_GAP_LANGUAGE.test(skill)) {
    return skill;
  }
  const candidate = normalizeText(gap.topic || gap.label);
  const words = candidate.split(/\s+/).filter(Boolean);
  if (!candidate || words.length > 8 || candidate.length > 72 || INTERNAL_GAP_LANGUAGE.test(candidate)) {
    return 'this role';
  }
  return candidate;
};

const buildGapItems = (analysisResult, context, { deliveryMode = 'text' } = {}) => ensureArray(analysisResult?.gaps || analysisResult?.explanation?.gaps)
  .filter(Boolean)
  .slice(0, 5)
  .map((gap) => {
    const internalTopic = typeof gap === 'string' ? gap : gap.topic || gap.label || gap.summary || 'match gap';
    const voiceMode = isVoiceDeliveryMode(deliveryMode);
    const topic = voiceMode ? resolveVoiceGapTopic(gap) : internalTopic;
    const questionText = voiceMode
      ? `Can you describe a relevant example involving ${topic}, including what you personally owned?`
      : `I want to validate one possible gap around ${internalTopic}. What related experience do you have, and what did you personally own?`;
    return buildBaseItem({
      ...context,
      sourceStage: 'match_gap',
      sourceType: 'match_gap',
      category: 'technical',
      stage: 'validation',
      topic,
      questionIntent: 'risk_probe',
      text: questionText,
      matchGapId: typeof gap === 'string' ? normalizeKey(gap) : gap.id || normalizeKey(internalTopic),
      roleDomain: resolveRoleDomain(analysisResult),
      requirementCategory: typeof gap === 'string' ? '' : gap.category || '',
      capabilityGroup: typeof gap === 'string' ? '' : gap.capabilityGroup || '',
      expectedSignal: ['gap_validation', 'adjacent_experience', 'ownership'],
      priorityWeight: 0.8,
      coverageWeight: 0.82,
      riskWeight: 0.9,
      metadata: { gap },
    });
  });

const mergeUniqueValues = (...values) => {
  const byValue = new Map();
  ensureArray(values.flat()).forEach((value) => {
    const key = typeof value === 'string' ? value : JSON.stringify(value);
    if (key && !byValue.has(key)) byValue.set(key, value);
  });
  return [...byValue.values()];
};

const mergeQuestionEvidence = (primary, secondary) => ({
  ...primary,
  linkedCvEvidence: mergeUniqueValues(primary.linkedCvEvidence, secondary.linkedCvEvidence),
  linkedJdRequirement: mergeUniqueValues(primary.linkedJdRequirement, secondary.linkedJdRequirement),
  expectedSignal: mergeUniqueValues(primary.expectedSignal, secondary.expectedSignal),
  evidenceNeed: mergeUniqueValues(primary.evidenceNeed, secondary.evidenceNeed),
});

const dedupePool = (items = []) => {
  const deduped = [];
  for (const rawItem of items) {
    if (!normalizeText(rawItem.text || rawItem.fallbackText)) continue;
    const item = {
      ...rawItem,
      assessmentKey: rawItem.assessmentKey || buildAssessmentKey({ ...rawItem, turnKind: 'root_question' }),
      questionFingerprint: rawItem.questionFingerprint || buildQuestionFingerprint(rawItem.text || rawItem.fallbackText),
    };
    const existingIndex = deduped.findIndex((candidate) => (
      candidate.assessmentKey === item.assessmentKey
      || candidate.questionFingerprint === item.questionFingerprint
    ));
    if (existingIndex < 0) {
      deduped.push(item);
      continue;
    }
    const existing = deduped[existingIndex];
    const itemWins = (sourcePriority[item.sourceStage] || 0) > (sourcePriority[existing.sourceStage] || 0);
    deduped[existingIndex] = itemWins
      ? mergeQuestionEvidence(item, existing)
      : mergeQuestionEvidence(existing, item);
  }
  return deduped;
};

export const buildScenarioPolicyItem = ({ analysisResult = {}, context = {}, settings = {} } = {}) => {
  const selectionContext = resolveCatalogSelectionContext({ analysisResult, settings });
  const scenarioEligibility = resolveScenarioEligibility(selectionContext);
  if (!scenarioEligibility.eligible) return null;

  const text = 'Imagine you are starting a new project with incomplete requirements. How would you clarify the problem, set constraints, choose an approach, manage risks, and validate the outcome?';
  return buildBaseItem({
    ...context,
    sourceStage: 'scenario_policy',
    sourceType: 'scenario_policy',
    category: 'technical',
    stage: 'scenario',
    topic: 'new_project_delivery',
    competency: 'new_project_delivery',
    questionIntent: 'scenario_problem_solving',
    questionFamily: 'scenario_problem_solving',
    evidenceMode: 'scenario_reasoning',
    text,
    fallbackText: text,
    expectedSignal: ['problem_framing', 'constraints_and_assumptions', 'technical_approach', 'tradeoffs_and_risks', 'validation_plan'],
    priorityWeight: 0.6,
    coverageWeight: 0.9,
    riskWeight: 0.55,
    maxFollowUps: 1,
    followUpStrategies: ['constraints', 'tradeoff', 'validation'],
    coverageSlot: SCENARIO_COVERAGE_SLOT,
    selectionPolicy: { minAsked: 1, maxAsked: 1, reservationPriority: 75 },
    ambiguityMode: 'bounded_scenario',
    clarificationContextVersion: 'scenario_policy_v1',
    clarificationContext: {
      responseText: 'Assume the project has a real user need but incomplete requirements, limited time, and at least one meaningful technical or delivery risk.',
    },
    metadata: { scenarioEligibility },
  });
};

export const ensureMinimumFallbacks = (items, context) => {
  const hasTechnical = items.some((item) => ['technical', 'role_competency'].includes(item.category));
  const hasBehavioural = items.some((item) => item.category === 'behavioural');
  const additions = [];
  if (!hasTechnical) {
    additions.push(buildBaseItem({
      ...context,
      sourceStage: 'fallback',
      sourceType: 'fallback',
      category: 'technical',
      stage: 'technical',
      topic: 'role_specific_competency',
      questionIntent: 'validate_depth',
      text: 'Tell me about one role-specific task you handled yourself. What approach and professional judgement did you use, what risks or quality requirements mattered, and how did you validate the outcome?',
      expectedSignal: ['approach', 'judgement', 'risk_or_quality', 'validation', 'outcome'],
      priorityWeight: 0.45,
    }));
  }
  if (!hasBehavioural) {
    additions.push(buildBaseItem({
      ...context,
      sourceStage: 'fallback',
      sourceType: 'fallback',
      category: 'behavioural',
      stage: 'behavioural',
      topic: 'teamwork',
      questionIntent: 'behavioural_star',
      text: 'Tell me about a time you worked through a challenge with others. What did you do, and what was the outcome?',
      expectedSignal: ['situation', 'personal_action', 'result_or_impact'],
      priorityWeight: 0.45,
    }));
  }
  return [...items, ...additions];
};

export const buildInterviewQuestionPoolItems = ({ userId, sessionId, cvFileId = null, matchAnalysisId = null, jdFingerprint = '', analysisResult = {}, settings = {}, cvSeeds = [], jdFilter = null, catalogItems = [], explicitCandidateSignals = [], deliveryMode = 'text' } = {}) => {
  const context = {
    userId,
    sessionId,
    cvFileId,
    matchAnalysisId,
    jdFingerprint,
    roleDomain: resolveRoleDomain(analysisResult),
  };
  const baseItems = buildQuestionPoolFromAnalysis(analysisResult, settings)
    .map((question, index) => mapLegacyQuestion(question, context, index));
  const decisionsBySeedId = new Map(ensureArray(jdFilter?.filterDecisions).map((decision) => [decision.seedId, decision]));
  const seedItems = ensureArray(cvSeeds)
    .filter((seed) => decisionsBySeedId.get(seed.seedId)?.decision !== 'suppress')
    .map((seed) => mapSeedQuestion(seed, decisionsBySeedId.get(seed.seedId), context));
  const requirementItems = buildRequirementItems(analysisResult, context);
  const gapItems = buildGapItems(analysisResult, context, { deliveryMode });
  const catalogSnapshots = buildCatalogQuestionSnapshots({
    catalogItems,
    context: { ...context, analysisResult, settings, explicitCandidateSignals },
  });
  const scenarioPolicyItem = buildScenarioPolicyItem({ analysisResult, context, settings });
  const deduped = dedupePool([
    ...baseItems,
    ...requirementItems,
    ...seedItems,
    ...gapItems,
    ...catalogSnapshots.items,
    ...(scenarioPolicyItem ? [scenarioPolicyItem] : []),
  ]);
  return validatePreparedQuestionPool(ensureMinimumFallbacks(deduped, context));
};

const loadStoredQuestionPool = async ({ sessionId, userId, questionPoolModel = InterviewQuestionPoolItem } = {}) => (
  questionPoolModel.find({ sessionId, userId }).sort({ priorityWeight: -1, createdAt: 1 }).lean()
);

export const restorePreparedQuestionPoolFromQuestionSet = async ({ sessionId, userId, items = [], questionPoolModel = InterviewQuestionPoolItem } = {}) => {
  const existingItems = await loadStoredQuestionPool({ sessionId, userId, questionPoolModel });
  const canonicalItems = ensureArray(items).filter((item) => item?.questionId);
  if (!canonicalItems.length) return existingItems;
  const existingQuestionIds = new Set(existingItems.map((item) => item.questionId).filter(Boolean));
  const missingCanonicalItems = canonicalItems.filter((item) => !existingQuestionIds.has(item.questionId));
  if (!missingCanonicalItems.length) return existingItems;
  try {
    await questionPoolModel.insertMany(missingCanonicalItems, { ordered: false });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  const restoredItems = await loadStoredQuestionPool({ sessionId, userId, questionPoolModel });
  const restoredQuestionIds = new Set(restoredItems.map((item) => item.questionId).filter(Boolean));
  const unresolvedQuestionIds = canonicalItems
    .map((item) => item.questionId)
    .filter((questionId) => !restoredQuestionIds.has(questionId));
  if (unresolvedQuestionIds.length) {
    throw new Error(`Canonical question pool restore is incomplete: ${unresolvedQuestionIds.join(', ')}`);
  }
  return restoredItems;
};

export const composeInterviewQuestionPool = async ({
  userId,
  sessionId,
  cvFileId = null,
  matchAnalysisId = null,
  jdFingerprint = '',
  analysisResult = {},
  settings = {},
  catalogItems = [],
  explicitCandidateSignals = [],
  deliveryMode = 'text',
  userInterviewMemoryProjection = null,
  loadQuestionSet = getSessionQuestionSet,
  persistQuestionSet = persistSessionQuestionSet,
  restoreQuestionPool = restorePreparedQuestionPoolFromQuestionSet,
  questionPoolModel = InterviewQuestionPoolItem,
} = {}) => {
  if (!userId || !sessionId) return [];
  const existingQuestionSet = await loadQuestionSet({ sessionId, userId });
  if (existingQuestionSet) {
    return restoreQuestionPool({
      sessionId,
      userId,
      items: getSessionQuestionSetItems(existingQuestionSet),
      questionPoolModel,
    });
  }

  const existingPoolItems = await loadStoredQuestionPool({ sessionId, userId, questionPoolModel });
  if (existingPoolItems.length) return existingPoolItems;

  const [cvSeeds, jdFilter, companyProfile] = await Promise.all([
    cvFileId ? getCvQuestionSeeds({ userId, cvFileId, status: 'active' }) : Promise.resolve([]),
    getJdQuestionFilter({ userId, matchAnalysisId, jdFingerprint }),
    jdFingerprint ? CompanyValuesProfile.findOne({ userId: String(userId), jdFingerprint }).lean() : Promise.resolve(null),
  ]);
  const composedItems = buildInterviewQuestionPoolItems({
    userId,
    sessionId,
    cvFileId,
    matchAnalysisId,
    jdFingerprint,
    analysisResult,
    settings,
    deliveryMode,
    cvSeeds,
    jdFilter,
    catalogItems,
    explicitCandidateSignals,
  });
  const memoryAdjustedPool = applyUserInterviewMemoryQuestionPolicy({
    items: composedItems,
    projection: userInterviewMemoryProjection,
  });
  const rawItems = memoryAdjustedPool.items;

  const roleEvidenceMap = analysisResult?.roleEvidenceMap || {};
  const roleFitProfile = companyProfile?.roleFitProfile || {};
  const roleFitQuestionPlan = buildRoleFitQuestionPool({
    poolItems: rawItems,
    roleEvidenceMap,
    roleFitProfile,
    context: {
      userId,
      sessionId,
      cvFileId,
      matchAnalysisId,
      jdFingerprint,
      roleDomain: resolveRoleDomain(analysisResult),
    },
  });
  const items = roleFitQuestionPlan.items;
  if (!items.length) return [];
  const persistedQuestionSet = await persistQuestionSet({ sessionId, userId, settings, items });
  const canonicalItems = getSessionQuestionSetItems(persistedQuestionSet.questionSet);
  if (!canonicalItems.length) {
    throw new Error('Cannot compose a question pool before its canonical session question set is persisted.');
  }
  return restoreQuestionPool({
    sessionId,
    userId,
    items: canonicalItems,
    questionPoolModel,
  });
};

export const buildPreparedRootQuestionPoolQuery = ({ sessionId, category = null, status = 'active', questionRoles = null } = {}) => {
  const query = { sessionId };
  if (status) query.status = status;
  if (category) query.category = normalizeCategory(category);
  if (ensureArray(questionRoles).length) {
    query.questionRole = { $in: ensureArray(questionRoles) };
    return query;
  }
  query.$or = [
    { questionRole: 'root_question' },
    { questionRole: { $exists: false } },
    { questionRole: null },
    { questionRole: '' },
  ];
  return query;
};

export const getPreparedQuestionPool = async ({ sessionId, category = null, status = 'active', questionRoles = null } = {}) => {
  if (!sessionId) return [];
  const query = buildPreparedRootQuestionPoolQuery({ sessionId, category, status, questionRoles });
  return InterviewQuestionPoolItem.find(query).sort({ priorityWeight: -1, createdAt: 1 }).lean();
};

export const markQuestionPoolItemAsked = async ({ sessionId, questionId, askedTurnIndex, rankTrace = {} } = {}) => {
  if (!sessionId || !questionId) return null;
  return InterviewQuestionPoolItem.findOneAndUpdate(
    { sessionId, questionId },
    {
      status: 'asked',
      askedAt: new Date(),
      askedTurnIndex,
      lastRankScore: rankTrace?.score ?? null,
      rankTrace,
    },
    { new: true }
  ).lean();
};

export const buildQuestionPoolReconciliationPlan = ({ transcript = [], poolItems = [] } = {}) => {
  const poolById = new Map(ensureArray(poolItems).map((item) => [item.questionId, item]));
  const poolByFingerprint = new Map();
  ensureArray(poolItems).forEach((item) => {
    const fingerprint = item.questionFingerprint || buildQuestionFingerprint(item.text || item.fallbackText);
    if (fingerprint && !poolByFingerprint.has(fingerprint)) poolByFingerprint.set(fingerprint, item);
  });
  const matchedIds = new Set();
  let preparedIdMatches = 0;
  let exactFingerprintMatches = 0;

  ensureArray(transcript).filter((turn) => turn?.role === 'ai').forEach((turn) => {
    const preparedQuestionId = turn.metadata?.preparedQuestionId
      || turn.metadata?.questionDecision?.preparedQuestionId
      || null;
    if (preparedQuestionId && poolById.has(preparedQuestionId)) {
      if (!matchedIds.has(preparedQuestionId)) preparedIdMatches += 1;
      matchedIds.add(preparedQuestionId);
      return;
    }
    const fingerprint = turn.metadata?.questionFingerprint || buildQuestionFingerprint(turn.text);
    const exactMatch = poolByFingerprint.get(fingerprint);
    if (exactMatch?.questionId) {
      if (!matchedIds.has(exactMatch.questionId)) exactFingerprintMatches += 1;
      matchedIds.add(exactMatch.questionId);
    }
  });

  return {
    questionIdsToMarkAsked: [...matchedIds],
    preparedIdMatches,
    exactFingerprintMatches,
  };
};

export const reconcileQuestionPoolFromTranscript = async ({ sessionId, transcript = [] } = {}) => {
  if (!sessionId) return { status: 'skipped', reason: 'missing_session_id' };
  const poolItems = await InterviewQuestionPoolItem.find({ sessionId }).lean();
  const plan = buildQuestionPoolReconciliationPlan({ transcript, poolItems });
  if (plan.questionIdsToMarkAsked.length > 0) {
    await InterviewQuestionPoolItem.updateMany(
      { sessionId, questionId: { $in: plan.questionIdsToMarkAsked } },
      { $set: { status: 'asked' } },
    );
  }
  return {
    status: 'complete',
    historySource: 'transcript',
    reconciledCount: plan.questionIdsToMarkAsked.length,
    ...plan,
  };
};
