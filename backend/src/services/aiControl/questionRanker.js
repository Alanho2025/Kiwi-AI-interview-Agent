/**
 * File responsibility: Build transparent question ranking metadata.
 * This layer does not replace the action planner. It explains and scores the concrete question selected by the existing flow.
 */

const SOURCE_WEIGHTS = {
  match_gap: 0.95,
  jd_requirement: 0.85,
  cv_template: 0.75,
  culture_fit: 0.7,
  retrieval: 0.7,
  controller_directed: 0.65,
  common_template: 0.55,
  fallback: 0.35,
  agent_generated: 0.45,
};

import { normalizeKey, ensureArray } from '../../utils/commonHelpers.js';

const inferSourceType = (question = {}) => {
  const explicit = normalizeKey(question.sourceType);
  if (explicit) return explicit;

  const reason = normalizeKey(question.reason);
  const topic = normalizeKey(question.topic);
  const type = normalizeKey(question.type);

  if (reason.includes('match') || topic.includes('gap') || type.includes('validation')) return 'match_gap';
  if (reason.includes('jd') || reason.includes('role requirement')) return 'jd_requirement';
  if (reason.includes('cv') || reason.includes('resume')) return 'cv_template';
  if (topic.includes('culture') || topic.includes('team')) return 'culture_fit';
  return 'agent_generated';
};

const buildEvidenceUsed = ({ question = {}, decisionContext = {}, selectedAction = '' } = {}) => {
  const evidence = [];

  ensureArray(question.linkedCvEvidence).forEach((value) => evidence.push({ type: 'cv_evidence', value }));
  ensureArray(question.linkedJdRequirement).forEach((value) => evidence.push({ type: 'jd_requirement', value }));

  if (question.matchGapId) evidence.push({ type: 'match_gap', value: question.matchGapId });
  if (question.cultureFitDimension) evidence.push({ type: 'culture_fit', value: question.cultureFitDimension });

  ensureArray(decisionContext?.coverageState?.missingTopics)
    .slice(0, 3)
    .forEach((value) => evidence.push({ type: 'coverage_gap', value }));

  ensureArray(decisionContext?.matchState?.validationTargets)
    .slice(0, 3)
    .forEach((value) => evidence.push({ type: 'validation_target', value }));

  const specificity = decisionContext?.candidateState?.specificityLevel;
  if (specificity) evidence.push({ type: 'answer_specificity', value: specificity });

  if (selectedAction) evidence.push({ type: 'selected_action', value: selectedAction });

  return evidence;
};

const scoreQuestion = ({ question = {}, decisionContext = {}, selectedAction = '' } = {}) => {
  const sourceType = inferSourceType(question);
  let score = SOURCE_WEIGHTS[sourceType] ?? SOURCE_WEIGHTS.agent_generated;
  const reasons = [`source:${sourceType}`];

  const topic = normalizeKey(question.topic);
  const text = normalizeKey(question.text || question.fallbackText);
  const latestAnswer = normalizeKey(decisionContext?.environment?.latestAnswer?.text || '');

  if (topic && latestAnswer.includes(topic)) {
    score += 0.15;
    reasons.push('linked_to_latest_answer');
  }

  if (ensureArray(decisionContext?.matchState?.validationTargets).some((item) => text.includes(normalizeKey(item)) || topic.includes(normalizeKey(item)))) {
    score += 0.2;
    reasons.push('match_validation_target');
  }

  if (ensureArray(decisionContext?.coverageState?.missingTopics).some((item) => text.includes(normalizeKey(item)) || topic.includes(normalizeKey(item)))) {
    score += 0.15;
    reasons.push('coverage_gap');
  }

  if (selectedAction) {
    score += 0.08;
    reasons.push(`action_fit:${selectedAction}`);
  }

  if (Number(question.followUpDepth || 0) > 0) {
    score += 0.05;
    reasons.push('follow_up_continuity');
  }

  if (question.reason) {
    score += 0.04;
    reasons.push('has_rationale');
  }

  return {
    questionId: question.id || question.sourceId || `${sourceType}:${question.topic || question.type || 'question'}`,
    sourceType,
    score: Number(score.toFixed(3)),
    reasons,
    text: question.fallbackText || question.text || '',
  };
};

export const buildQuestionDecisionTrace = ({
  selectedQuestion = {},
  session = {},
  decisionContext = {},
  selectedAction = '',
  actionInput = {},
  generatedText = '',
  confidence = null,
  selectionSource = 'rule_fallback',
} = {}) => {
  const sourceType = inferSourceType(selectedQuestion);
  const selectedCandidate = scoreQuestion({ question: selectedQuestion, decisionContext, selectedAction });
  const poolCandidates = ensureArray(session?.interviewPlan?.questionPool)
    .slice(0, 12)
    .map((question) => scoreQuestion({ question, decisionContext, selectedAction }))
    .sort((a, b) => b.score - a.score);

  const topCandidates = [selectedCandidate, ...poolCandidates.filter((item) => item.questionId !== selectedCandidate.questionId)]
    .slice(0, 5);

  const evidenceUsed = buildEvidenceUsed({ question: selectedQuestion, decisionContext, selectedAction });
  const whyThisQuestion = selectedQuestion.reason
    || `Selected to support ${selectedAction || 'the next interview step'} using ${sourceType} evidence.`;

  return {
    selectedAction,
    selectedQuestionId: selectedCandidate.questionId,
    sourceType,
    whyThisQuestion,
    evidenceUsed,
    expectedSignal: ensureArray(selectedQuestion.evidenceNeed),
    alternativesConsidered: topCandidates.slice(1),
    confidence,
    selectionSource,
    baseQuestionText: selectedQuestion.fallbackText || selectedQuestion.text || '',
    spokenQuestionText: generatedText || selectedQuestion.fallbackText || selectedQuestion.text || '',
    ranking: {
      selectedQuestionId: selectedCandidate.questionId,
      selectedScore: selectedCandidate.score,
      rankingReason: whyThisQuestion,
      topCandidates,
    },
    actionInput,
  };
};
