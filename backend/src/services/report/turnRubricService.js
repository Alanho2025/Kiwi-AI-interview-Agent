import { analyzeStarBreakdown } from '../aiControl/starRubricService.js';
import { normalizeText } from '../../utils/commonHelpers.js';

const lower = (value = '') => normalizeText(value).toLowerCase();
const wordCount = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean).length;

export const inferTurnRubric = ({ question = '', metadata = {} } = {}) => {
  const questionText = lower(question);
  const topic = lower(metadata.topic || metadata.questionTopic || '');
  const stage = lower(metadata.stage || metadata.questionStage || metadata.type || metadata.questionType || '');
  const type = lower(metadata.questionType || metadata.type || '');

  if (
    stage.includes('opening')
    || stage.includes('self_intro')
    || topic.includes('self_intro')
    || type.includes('self_intro')
    || /quick introduction|tell me a bit about yourself|introduce yourself|about yourself/.test(questionText)
  ) {
    return {
      rubricType: 'self_intro',
      starApplicable: false,
      structureLabel: 'Introduction structure',
      dimensions: ['background', 'roleInterest', 'relevance', 'clarity'],
    };
  }

  if (
    topic.includes('company_and_role_motivation')
    || type.includes('company_motivation')
    || /what attracted you|why.*(company|role)|interested in.*role/.test(questionText)
  ) {
    return {
      rubricType: 'company_motivation',
      starApplicable: false,
      structureLabel: 'Motivation structure',
      dimensions: ['companyReason', 'roleReason', 'candidateEvidence', 'specificity'],
    };
  }

  if (stage.includes('wrap') || stage.includes('closing') || topic.includes('candidate_questions')) {
    return {
      rubricType: 'conversation',
      starApplicable: false,
      structureLabel: 'Conversation structure',
      dimensions: ['relevance', 'clarity', 'completion'],
    };
  }

  return {
    rubricType: 'star',
    starApplicable: true,
    structureLabel: 'STAR evidence',
    dimensions: ['situation', 'task', 'action', 'result'],
  };
};

const toLabel = (score = 0) => (score >= 2 ? 'clear' : score >= 1 ? 'partial' : 'missing');

const analyzeSelfIntro = (answer = '') => {
  const text = lower(answer);
  const words = wordCount(answer);
  const backgroundScore = Math.min(2, (
    (/(university|degree|study|studying|background|experience|project|intern|work)/.test(text) ? 1 : 0)
    + (/(information technology|computer science|software|data|ai|product|game)/.test(text) ? 1 : 0)
  ));
  const roleInterestScore = Math.min(2, (
    (/(interested|attracted|excited|because|role|job|intern)/.test(text) ? 1 : 0)
    + (/(game|gaming|ai|npc|product|user|client|business)/.test(text) ? 1 : 0)
  ));
  const relevanceScore = Math.min(2, (
    (/(database|design|ai|engine|web|application|client|games|coach)/.test(text) ? 1 : 0)
    + (/(build|built|deal|worked|playing|background)/.test(text) ? 1 : 0)
  ));
  const clarityScore = Math.min(2, (
    (words >= 25 ? 1 : 0)
    + (words <= 140 ? 1 : 0)
  ));
  const scores = { background: backgroundScore, roleInterest: roleInterestScore, relevance: relevanceScore, clarity: clarityScore };
  const mainMissingElement = Object.entries(scores).sort((left, right) => left[1] - right[1])[0]?.[0] || 'clarity';
  return {
    background: toLabel(backgroundScore),
    roleInterest: toLabel(roleInterestScore),
    relevance: toLabel(relevanceScore),
    clarity: toLabel(clarityScore),
    scores,
    mainMissingElement,
    scoreReason: mainMissingElement === 'roleInterest'
      ? 'The introduction should connect the candidate background to this specific company or role more clearly.'
      : mainMissingElement === 'clarity'
        ? 'The introduction would be stronger with a cleaner sequence and fewer unclear phrases.'
        : 'The introduction includes useful context but needs a sharper link between background, role interest, and relevant evidence.',
  };
};

const analyzeMotivation = (answer = '') => {
  const text = lower(answer);
  const companyReasonScore = Math.min(2, (
    (/(company|tencent|mission|value|team|product|platform)/.test(text) ? 1 : 0)
    + (/(researched|read|noticed|admire|specific)/.test(text) ? 1 : 0)
  ));
  const roleReasonScore = Math.min(2, (
    (/(role|job|intern|product|game|ai|npc|user|client)/.test(text) ? 1 : 0)
    + (/(interested|attracted|want|because|fit)/.test(text) ? 1 : 0)
  ));
  const candidateEvidenceScore = Math.min(2, (
    (/(my|i|background|project|experience|built|studied|worked|played)/.test(text) ? 1 : 0)
    + (/(database|ai|engine|web|application|game|client|business)/.test(text) ? 1 : 0)
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

export const analyzeTurnStructure = ({ question = '', answer = '', metadata = {} } = {}) => {
  const rubric = inferTurnRubric({ question, metadata });
  if (rubric.rubricType === 'self_intro') {
    return { ...rubric, structureBreakdown: analyzeSelfIntro(answer), starBreakdown: null };
  }
  if (rubric.rubricType === 'company_motivation') {
    return { ...rubric, structureBreakdown: analyzeMotivation(answer), starBreakdown: null };
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
        scoreReason: answer ? 'The answer was captured, but this turn is not scored with STAR.' : 'No substantive answer was captured.',
      },
      starBreakdown: null,
    };
  }
  const starBreakdown = analyzeStarBreakdown(answer);
  return { ...rubric, structureBreakdown: starBreakdown, starBreakdown };
};
