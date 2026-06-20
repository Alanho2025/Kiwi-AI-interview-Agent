import { analyzeStarrBreakdown } from '../aiControl/starRubricService.js';
import { normalizeText } from '../../utils/commonHelpers.js';
import { buildRoleSpecificRubric } from './answerFrameworkService.js';
import { analyzeRoleSpecificAnswer, calculateFrameworkScore } from './roleAnswerAnalysisService.js';

export { calculateFrameworkScore } from './roleAnswerAnalysisService.js';

const lower = (value = '') => normalizeText(value).toLowerCase();
const wordCount = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean).length;

const buildStarrRubric = ({ topic = '' } = {}) => {
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
  };
};

const isSelfIntroductionQuestion = (questionText = '') =>
  /quick introduction|tell me a bit about yourself|introduce yourself|about yourself/.test(questionText);

const asksForPastExampleEvidence = (questionText = '') =>
  /specific project|specific example|tell me about a time|can you describe.*project|project where|built .*engine|what did you personally do|what did you build|how did you know|what was the result|outcome|validated|validation|performance/.test(questionText);

export const inferTurnRubric = ({ question = '', metadata = {} } = {}) => {
  const questionText = lower(question);
  const topic = lower(metadata.topic || metadata.questionTopic || '');
  const stage = lower(metadata.stage || metadata.questionStage || metadata.type || metadata.questionType || '');
  const type = lower(metadata.questionType || metadata.type || '');
  const questionFamily = lower(metadata.questionFamily || metadata.category || metadata.questionCategory || '');
  const evidenceMode = lower(metadata.evidenceMode || '') || 'past_example';
  const capabilityGroup = lower(metadata.capabilityGroup || '');
  const roleDomain = lower(metadata.roleDomain || '') || 'general';

  if (questionFamily.includes('behaviour') || questionFamily.includes('behavior')) {
    return buildStarrRubric({ topic });
  }

  if (questionFamily === 'role_specific' || questionFamily === 'technical' || questionFamily === 'role_competency') {
    return buildRoleSpecificRubric({ evidenceMode, capabilityGroup, roleDomain });
  }

  if (
    isSelfIntroductionQuestion(questionText)
    || questionFamily === 'self_intro'
    || stage.includes('self_intro')
    || topic.includes('self_intro')
    || type.includes('self_intro')
    || (stage.includes('opening') && !asksForPastExampleEvidence(questionText))
  ) {
    return {
      rubricType: 'self_intro',
      frameworkKey: 'self_intro',
      frameworkLabel: 'Introduction',
      questionFamily: 'self_intro',
      evidenceMode: 'knowledge_explanation',
      starApplicable: false,
      structureLabel: 'Introduction structure',
      dimensions: ['background', 'roleRelevance', 'evidence', 'clarity'],
    };
  }

  if (
    topic.includes('company_and_role_motivation')
    || questionFamily === 'motivation'
    || type.includes('company_motivation')
    || /what attracted you|why.*(company|role)|interested in.*role/.test(questionText)
  ) {
    return {
      rubricType: 'company_motivation',
      frameworkKey: 'company_motivation',
      frameworkLabel: 'Motivation',
      questionFamily: 'motivation',
      evidenceMode: 'knowledge_explanation',
      starApplicable: false,
      structureLabel: 'Motivation structure',
      dimensions: ['companyReason', 'roleReason', 'candidateEvidence', 'specificity'],
    };
  }

  if (questionFamily === 'conversation' || stage.includes('wrap') || stage.includes('closing') || topic.includes('candidate_questions')) {
    return {
      rubricType: 'conversation',
      frameworkKey: 'conversation',
      frameworkLabel: 'Conversation',
      questionFamily: 'conversation',
      evidenceMode: 'knowledge_explanation',
      starApplicable: false,
      structureLabel: 'Conversation structure',
      dimensions: ['relevance', 'clarity', 'completion'],
    };
  }

  if (
    stage.includes('technical')
    || stage.includes('role_competency')
    || type.includes('technical')
    || type.includes('role_competency')
    || /\b(technical|implementation|system|tool|clinical|professional|process|workflow|method)\b/.test(questionText)
  ) {
    return buildRoleSpecificRubric({ evidenceMode, capabilityGroup, roleDomain });
  }

  if (asksForPastExampleEvidence(questionText) && !isSelfIntroductionQuestion(questionText)) {
    return buildStarrRubric({ topic });
  }

  return buildStarrRubric({ topic });
};

const toLabel = (score = 0) => (score >= 2 ? 'clear' : score >= 1 ? 'partial' : 'missing');

const analyzeSelfIntro = (answer = '') => {
  const text = lower(answer);
  const words = wordCount(answer);
  const backgroundScore = Math.min(2, (
    (/(qualification|degree|study|studying|background|experience|career|profession|work)/.test(text) ? 1 : 0)
    + (/(years?|current role|previous role|trained|registered|speciali[sz])/.test(text) ? 1 : 0)
  ));
  const roleRelevanceScore = Math.min(2, (
    (/(role|job|position|responsibilit|requirement)/.test(text) ? 1 : 0)
    + (/(relevant|match|contribute|support|need|align)/.test(text) ? 1 : 0)
  ));
  const evidenceScore = Math.min(2, (
    (/(example|evidence|case|project|work|experience|review|service|care|customer|client|student)/.test(text) ? 1 : 0)
    + (/(led|supported|delivered|improved|managed|created|resolved|achieved|completed)/.test(text) ? 1 : 0)
  ));
  const clarityScore = Math.min(2, (
    (words >= 25 ? 1 : 0)
    + (words <= 140 ? 1 : 0)
  ));
  const scores = { background: backgroundScore, roleRelevance: roleRelevanceScore, evidence: evidenceScore, clarity: clarityScore };
  const mainMissingElement = Object.entries(scores).sort((left, right) => left[1] - right[1])[0]?.[0] || 'clarity';
  return {
    background: toLabel(backgroundScore),
    roleRelevance: toLabel(roleRelevanceScore),
    evidence: toLabel(evidenceScore),
    clarity: toLabel(clarityScore),
    scores,
    mainMissingElement,
    scoreReason: mainMissingElement === 'roleRelevance'
      ? 'The introduction should connect the candidate background to this specific company or role more clearly.'
      : mainMissingElement === 'clarity'
        ? 'The introduction would be stronger with a cleaner sequence and fewer unclear phrases.'
        : 'The introduction includes useful context but needs a sharper link between background, role interest, and relevant evidence.',
  };
};

const analyzeMotivation = (answer = '') => {
  const text = lower(answer);
  const companyReasonScore = Math.min(2, (
    (/(company|organisation|organization|mission|value|team|service|community|reputation)/.test(text) ? 1 : 0)
    + (/(researched|read|noticed|admire|specific)/.test(text) ? 1 : 0)
  ));
  const roleReasonScore = Math.min(2, (
    (/(role|job|position|responsibilit|customer|client|patient|student|service)/.test(text) ? 1 : 0)
    + (/(interested|attracted|want|because|fit)/.test(text) ? 1 : 0)
  ));
  const candidateEvidenceScore = Math.min(2, (
    (/(my|i|background|project|case|experience|studied|worked|supported|led|delivered)/.test(text) ? 1 : 0)
    + (/(relevant|match|align|contribute|improved|outcome|result)/.test(text) ? 1 : 0)
  ));
  const specificityScore = Math.min(2, (
    (wordCount(answer) >= 25 ? 1 : 0)
    + (/(for example|especially|because|which|therefore|specific)/.test(text) ? 1 : 0)
  ));
  const scores = { companyReason: companyReasonScore, roleReason: roleReasonScore, candidateEvidence: candidateEvidenceScore, specificity: specificityScore };
  const mainMissingElement = Object.entries(scores).sort((left, right) => left[1] - right[1])[0]?.[0] || 'companyReason';
  return {
    companyReason: toLabel(companyReasonScore),
    roleReason: toLabel(roleReasonScore),
    candidateEvidence: toLabel(candidateEvidenceScore),
    specificity: toLabel(specificityScore),
    scores,
    mainMissingElement,
    scoreReason: mainMissingElement === 'companyReason'
      ? 'The answer shows role interest, but it needs one specific company reason.'
      : 'The answer should connect company interest, role responsibilities, and candidate evidence more explicitly.',
  };
};

const buildDedicatedFrameworkBreakdown = ({ structure = {}, dimensionLabels = {}, summary = '' } = {}) => {
  const dimensions = Object.entries(dimensionLabels).map(([key, label]) => ({
    key,
    label,
    status: structure[key] || 'missing',
    score: Number(structure.scores?.[key] || 0) * 5,
    reason: `${label} evidence is ${structure[key] || 'missing'}.`,
  }));
  const score = calculateFrameworkScore(dimensions);
  return {
    dimensions,
    mainGapKey: structure.mainMissingElement || '',
    mainMissingElement: structure.mainMissingElement || '',
    summary,
    scoreReason: structure.scoreReason || '',
    ...score,
  };
};

export const analyzeTurnStructure = ({ question = '', answer = '', metadata = {} } = {}) => {
  const rubric = inferTurnRubric({ question, metadata });
  if (rubric.rubricType === 'self_intro') {
    const structureBreakdown = analyzeSelfIntro(answer);
    return {
      ...rubric,
      structureBreakdown,
      frameworkBreakdown: buildDedicatedFrameworkBreakdown({
        structure: structureBreakdown,
        dimensionLabels: {
          background: 'Background',
          roleRelevance: 'Role Relevance',
          evidence: 'Evidence',
          clarity: 'Clarity',
        },
        summary: 'This evaluates introduction evidence using background, role relevance, evidence, and clarity.',
      }),
      starBreakdown: null,
    };
  }
  if (rubric.rubricType === 'company_motivation') {
    const structureBreakdown = analyzeMotivation(answer);
    return {
      ...rubric,
      structureBreakdown,
      frameworkBreakdown: buildDedicatedFrameworkBreakdown({
        structure: structureBreakdown,
        dimensionLabels: {
          companyReason: 'Company Reason',
          roleReason: 'Role Reason',
          candidateEvidence: 'Candidate Evidence',
          specificity: 'Specificity',
        },
        summary: 'This evaluates motivation using company reason, role reason, candidate evidence, and specificity.',
      }),
      starBreakdown: null,
    };
  }
  if (rubric.rubricType === 'role_specific') {
    const frameworkBreakdown = analyzeRoleSpecificAnswer({ answer, rubric });
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
  if (!rubric.starApplicable) {
    return {
      ...rubric,
      structureBreakdown: {
        relevance: answer ? 'partial' : 'missing',
        clarity: wordCount(answer) >= 8 ? 'partial' : 'missing',
        completion: answer ? 'partial' : 'missing',
        scores: {},
        mainMissingElement: answer ? 'specificity' : 'answer',
        scoreReason: answer ? 'The answer was captured, but this turn is not scored with STARR.' : 'No substantive answer was captured.',
      },
      starrBreakdown: null,
      starrQualityScore: null,
      missingElementExplanation: null,
    };
  }
  const starrBreakdown = analyzeStarrBreakdown(answer);
  const frameworkDimensions = [
    ['situation', 'Situation'],
    ['task', 'Task'],
    ['action', 'Action'],
    ['resultOrReaction', rubric.resultOrReactionLabel || 'Result'],
    ['reflection', 'Reflection'],
  ].map(([key, label]) => ({
    key,
    label,
    status: starrBreakdown[key],
    score: Number(starrBreakdown.scores?.[key] || 0) * 5,
    reason: `${label} evidence is ${starrBreakdown[key] || 'missing'}.`,
  }));
  const frameworkScore = calculateFrameworkScore(frameworkDimensions);
  const frameworkBreakdown = {
    dimensions: frameworkDimensions,
    mainGapKey: starrBreakdown.mainMissingElement,
    mainMissingElement: starrBreakdown.mainMissingElement,
    summary: 'This evaluates behavioural evidence using STARR.',
    scoreReason: starrBreakdown.scoreReason,
    ...frameworkScore,
  };
  return { 
    ...rubric, 
    structureBreakdown: starrBreakdown, 
    frameworkBreakdown,
    starBreakdown: starrBreakdown,
    starrBreakdown,
    starrQualityScore: starrBreakdown.totalScore,
    missingElementExplanation: starrBreakdown.scoreReason,
  };
};
