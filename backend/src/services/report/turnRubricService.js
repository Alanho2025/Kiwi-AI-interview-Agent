import { analyzeStarrBreakdown } from '../aiControl/starRubricService.js';
import { normalizeText } from '../../utils/commonHelpers.js';
import { buildRoleSpecificRubric } from './answerFrameworkService.js';
import { resolveFollowUpAssessmentContract } from '../questions/questionAssessmentContractService.js';
import { resolveQuestionAssessmentIntent } from '../questions/questionArtifactHelpers.js';
import { analyzeImpactFirstAnswer } from './impactFirstAnalysisService.js';
import { evaluateWithUniversalLlm } from './universalLlmEvaluationService.js';

export const calculateFrameworkScore = (dimensions = []) => {
  const applicable = dimensions.filter((item) => item.status !== 'not_applicable');
  const totalScore = Number(Number(applicable.reduce((sum, item) => sum + Number(item.score || 0), 0)).toFixed(2));
  const maxScore = applicable.length * 10;
  return {
    totalScore,
    maxScore,
    normalizedScore: maxScore ? Number(Number((totalScore / maxScore) * 10).toFixed(2)) : 0,
  };
};

const lower = (value = '') => normalizeText(value).toLowerCase();
const wordCount = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean).length;

const buildStarrRubric = ({ topic = '', targetedDimensions = [] } = {}) => {
  const isReaction = topic.includes('teamwork') || topic.includes('communication') || topic.includes('conflict');
  return {
    rubricType: 'starr',
    frameworkKey: 'behavioural_starr',
    frameworkLabel: 'STARR',
    questionFamily: 'behavioural',
    evidenceMode: 'past_example',
    starApplicable: true,
    structureLabel: 'STARR evidence',
    resultOrReactionLabel: isReaction ? 'Reaction' : 'Result',
    dimensions: ['situation', 'task', 'action', 'resultOrReaction', 'reflection'],
    targetedDimensions,
  };
};

const buildImpactFirstRubric = () => ({
  rubricType: 'impact_first',
  frameworkKey: 'impact_first_past_example',
  frameworkLabel: 'Impact-first Past Example',
  questionFamily: 'behavioural',
  evidenceMode: 'past_example',
  starApplicable: false,
  structureLabel: 'Impact-first evidence',
  dimensions: ['outcome', 'problem_solving', 'personal_role', 'approaches', 'learning', 'outcome_placement'],
});

const buildDirectRubric = () => ({
  rubricType: 'direct',
  frameworkKey: 'direct_answer',
  frameworkLabel: 'Direct answer',
  questionFamily: 'direct',
  evidenceMode: 'knowledge_explanation',
  starApplicable: false,
  structureLabel: 'Direct answer',
  dimensions: [],
});



export const inferTurnRubric = ({ question = '', metadata = {} } = {}) => {
  const topic = lower(metadata.topic || metadata.questionTopic || '');
  const capabilityGroup = lower(metadata.capabilityGroup || '');
  const roleDomain = lower(metadata.roleDomain || '') || 'general';
  const followUpIntent = lower(metadata.followUpIntent || metadata.questionDecision?.followUpIntent || '');

  const currentIntentResolution = resolveQuestionAssessmentIntent({
    questionFamily: metadata.questionFamily || metadata.category || metadata.questionCategory,
    category: metadata.requirementCategory,
    questionType: metadata.questionType || metadata.type,
    questionIntent: metadata.questionType || metadata.type,
    evidenceMode: metadata.evidenceMode,
    text: question,
    assessmentIntent: metadata.assessmentIntent,
  });

  const parentIntentResolution = resolveQuestionAssessmentIntent({
    questionFamily: metadata.parentQuestionFamily || metadata.questionFamily || metadata.category || metadata.questionCategory,
    evidenceMode: metadata.parentEvidenceMode || metadata.evidenceMode,
    assessmentIntent: metadata.parentAssessmentIntent || metadata.assessmentIntent,
  });

  const resolvedIntent = currentIntentResolution.intent;
  const resolvedSource = currentIntentResolution.source;

  if (followUpIntent) {
    const contract = resolveFollowUpAssessmentContract({
      intent: followUpIntent,
      parentQuestionFamily: metadata.parentQuestionFamily || metadata.questionFamily || metadata.category || metadata.questionCategory,
      parentEvidenceMode: metadata.parentEvidenceMode || metadata.evidenceMode || 'past_example',
    });
    if (contract.targetedDimensions.length > 0) {
      if (contract.questionFamily === 'behavioural') {
        return {
          ...buildStarrRubric({ topic, targetedDimensions: contract.targetedDimensions }),
          assessmentIntent: resolvedIntent,
          assessmentIntentSource: resolvedSource,
          parentAssessmentIntent: parentIntentResolution.intent,
        };
      }
      return {
        ...buildRoleSpecificRubric({
          evidenceMode: contract.evidenceMode,
          capabilityGroup,
          roleDomain,
        }),
        targetedDimensions: contract.targetedDimensions,
        assessmentIntent: resolvedIntent,
        assessmentIntentSource: resolvedSource,
        parentAssessmentIntent: parentIntentResolution.intent,
      };
    }
  }

  let rubric;
  if (resolvedIntent === 'impact_first_past_example') {
    rubric = buildImpactFirstRubric();
  } else if (resolvedIntent === 'self_intro') {
    rubric = {
      rubricType: 'self_intro',
      frameworkKey: 'self_intro',
      frameworkLabel: 'Introduction',
      questionFamily: 'self_intro',
      evidenceMode: 'knowledge_explanation',
      starApplicable: false,
      structureLabel: 'Introduction structure',
      dimensions: [
        { key: 'background', label: 'Background' },
        { key: 'roleRelevance', label: 'Role Relevance' },
        { key: 'evidence', label: 'Evidence' },
        { key: 'clarity', label: 'Clarity' }
      ],
    };
  } else if (resolvedIntent === 'company_motivation') {
    rubric = {
      rubricType: 'company_motivation',
      frameworkKey: 'company_motivation',
      frameworkLabel: 'Motivation',
      questionFamily: 'motivation',
      evidenceMode: 'knowledge_explanation',
      starApplicable: false,
      structureLabel: 'Motivation structure',
      dimensions: [
        { key: 'companyReason', label: 'Company Reason' },
        { key: 'roleReason', label: 'Role Reason' },
        { key: 'candidateEvidence', label: 'Candidate Evidence' },
        { key: 'specificity', label: 'Specificity' }
      ],
    };
  } else if (resolvedIntent === 'conversation') {
    rubric = {
      rubricType: 'conversation',
      frameworkKey: 'conversation',
      frameworkLabel: 'Conversation',
      questionFamily: 'conversation',
      evidenceMode: 'knowledge_explanation',
      starApplicable: false,
      structureLabel: 'Conversation structure',
      dimensions: [
        { key: 'relevance', label: 'Relevance' },
        { key: 'clarity', label: 'Clarity' },
        { key: 'completion', label: 'Completion' }
      ],
    };
  } else if (['scenario_reasoning', 'knowledge_explanation', 'credential_verification', 'role_specific_reasoning'].includes(resolvedIntent)) {
    const fallbackMode = resolvedIntent === 'role_specific_reasoning' ? 'process_reasoning' : resolvedIntent;
    rubric = buildRoleSpecificRubric({ evidenceMode: fallbackMode, capabilityGroup, roleDomain });
  } else {
    rubric = buildDirectRubric();
  }

  return {
    ...rubric,
    assessmentIntent: resolvedIntent,
    assessmentIntentSource: resolvedSource,
    parentAssessmentIntent: parentIntentResolution.intent,
  };
};

export const analyzeTurnStructure = async ({ question = '', answer = '', metadata = {} } = {}) => {
  const rubric = inferTurnRubric({ question, metadata });
  
  if (rubric.rubricType === 'impact_first') {
    const frameworkBreakdown = await analyzeImpactFirstAnswer({ question, answer, context: metadata });
    return {
      ...rubric,
      frameworkBreakdown,
      structureBreakdown: frameworkBreakdown,
      starBreakdown: null,
      starrBreakdown: null,
      starrQualityScore: null,
      frameworkQualityScore: frameworkBreakdown.normalizedScore,
      missingElementExplanation: frameworkBreakdown.scoreReason,
    };
  }
  
  if (rubric.rubricType === 'self_intro' || rubric.rubricType === 'company_motivation' || rubric.rubricType === 'conversation' || rubric.rubricType === 'role_specific' || !rubric.starApplicable) {
    let frameworkBreakdown = await evaluateWithUniversalLlm({ question, answer, context: metadata, dimensionsArray: rubric.dimensions, frameworkLabel: rubric.frameworkLabel });
    
    if (rubric.targetedDimensions && rubric.targetedDimensions.length > 0) {
      const targeted = new Set(rubric.targetedDimensions);
      frameworkBreakdown.dimensions = frameworkBreakdown.dimensions.map(dim => {
        if (!targeted.has(dim.key)) {
          return { ...dim, status: 'not_applicable', score: 0, reason: 'Not targeted by this follow-up.' };
        }
        return dim;
      });
      const applicable = frameworkBreakdown.dimensions.filter(d => d.status !== 'not_applicable');
      frameworkBreakdown.maxScore = applicable.length * 10;
      frameworkBreakdown.totalScore = Number(applicable.reduce((s, d) => s + d.score, 0).toFixed(2));
      frameworkBreakdown.normalizedScore = frameworkBreakdown.maxScore ? Number(((frameworkBreakdown.totalScore / frameworkBreakdown.maxScore) * 10).toFixed(2)) : 0;
    }

    return {
      ...rubric,
      frameworkBreakdown,
      structureBreakdown: frameworkBreakdown,
      starBreakdown: null,
      starrBreakdown: null,
      starrQualityScore: null,
      frameworkQualityScore: frameworkBreakdown.normalizedScore,
      missingElementExplanation: frameworkBreakdown.scoreReason,
    };
  }
  const starrBreakdown = analyzeStarrBreakdown(answer);
  const targetedDimensions = new Set(rubric.targetedDimensions || []);
  const scoredStarrBreakdown = targetedDimensions.size === 0
    ? starrBreakdown
    : {
        ...starrBreakdown,
        ...Object.fromEntries(rubric.dimensions.map((key) => [
          key,
          targetedDimensions.has(key) ? starrBreakdown[key] : 'not_applicable',
        ])),
        scores: Object.fromEntries(rubric.dimensions.map((key) => [
          key,
          targetedDimensions.has(key) ? Number(starrBreakdown.scores?.[key] || 0) : 0,
        ])),
        totalScore: [...targetedDimensions].reduce((sum, key) => sum + Number(starrBreakdown.scores?.[key] || 0), 0),
        maxScore: targetedDimensions.size * 2,
        mainMissingElement: [...targetedDimensions]
          .sort((left, right) => Number(starrBreakdown.scores?.[left] || 0) - Number(starrBreakdown.scores?.[right] || 0))[0],
      };
  const frameworkDimensions = [
    ['situation', 'Situation'],
    ['task', 'Task'],
    ['action', 'Action'],
    ['resultOrReaction', rubric.resultOrReactionLabel || 'Result'],
    ['reflection', 'Reflection'],
  ].map(([key, label]) => ({
    key,
    label,
    status: scoredStarrBreakdown[key],
    score: Number(scoredStarrBreakdown.scores?.[key] || 0) * 5,
    reason: targetedDimensions.size > 0 && !targetedDimensions.has(key)
      ? `${label} was not requested by this follow-up.`
      : `${label} evidence is ${scoredStarrBreakdown[key] || 'missing'}.`,
  }));
  const frameworkScore = calculateFrameworkScore(frameworkDimensions);
  const frameworkBreakdown = {
    dimensions: frameworkDimensions,
    mainGapKey: scoredStarrBreakdown.mainMissingElement,
    mainMissingElement: scoredStarrBreakdown.mainMissingElement,
    summary: 'This evaluates behavioural evidence using STARR.',
    scoreReason: scoredStarrBreakdown.scoreReason,
    ...frameworkScore,
  };
  return { 
    ...rubric, 
    structureBreakdown: scoredStarrBreakdown,
    frameworkBreakdown,
    starBreakdown: scoredStarrBreakdown,
    starrBreakdown: scoredStarrBreakdown,
    starrQualityScore: scoredStarrBreakdown.totalScore,
    missingElementExplanation: scoredStarrBreakdown.scoreReason,
  };
};

export const validateRubricQuestionAlignment = ({ question = '', rubric = {}, metadata = {} } = {}) => {
  const questionText = lower(question);
  const intent = lower(metadata.followUpIntent || '');
  const dimensionKeys = (rubric.frameworkBreakdown?.dimensions || rubric.dimensions || [])
    .map((item) => typeof item === 'string' ? item : item.key);
  const asksForValidation = intent === 'validation' || /\b(validat|verif|before-and-after|measur|check)\w*/.test(questionText);
  if (asksForValidation && !dimensionKeys.some((key) => /validat|verif/.test(key))) {
    return { passed: false, reason: 'validation_question_missing_validation_dimension' };
  }
  if (rubric.rubricType === 'company_motivation' && !/what attracted you|why.*(?:company|role)|interested in.*role/.test(questionText)) {
    return { passed: false, reason: 'motivation_rubric_without_motivation_question' };
  }
  return { passed: true, reason: 'rubric_matches_question' };
};
