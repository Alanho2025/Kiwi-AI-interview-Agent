import { validateReportOutput } from '../schemaValidationService.js';

const normalizeText = (value = '') => String(value || '').trim();
const toWords = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean);
const lower = (value = '') => normalizeText(value).toLowerCase();

const joinLabels = (items = [], limit = 4) => items.slice(0, limit).map((item) => item.label).filter(Boolean).join(', ');

const interviewQuestionStarters = [
  'tell me about',
  'what was your',
  'can you walk me through',
  'before we finish',
  'please introduce yourself',
  'how did you',
  'why did you',
  'what did you',
  'could you',
  'would you',
];

const isQuestionTurn = (turn = {}) => {
  if (turn.role !== 'ai') return false;
  if (turn.questionId) return true;
  const text = lower(turn.text);
  return text.endsWith('?') || interviewQuestionStarters.some((starter) => text.startsWith(starter));
};

const classifyEvidenceType = (text = '') => {
  const value = lower(text);
  if (!value) return 'generic_filler';
  if (/(^|\b)(i would|i could|i can|would fit|would use|i see|i understand)\b/.test(value)) return 'hypothetical_understanding';
  if (/(^|\b)(i have not|i haven't|i did not|i didn't|mainly|rather than|not as the core)\b/.test(value)) return 'indirect_adjacent_experience';
  if (/(^|\b)(in my role|at foxconn|i used|i built|i worked on|my role was|the result was|i analysed|i automated|i supported|i proposed)\b/.test(value)) return 'direct_past_experience';
  return 'generic_filler';
};

const scoreEvidenceStrength = (text = '') => {
  const value = lower(text);
  let score = 0;
  const reasons = [];
  if (/(at |during |when |in my role|project|workflow|process|station|session|system)/.test(value)) {
    score += 1;
    reasons.push('real_context');
  }
  if (/(i built|i used|i created|i analysed|i cleaned|i applied|i translated|i proposed|i designed|i handled|i implemented)/.test(value)) {
    score += 1;
    reasons.push('specific_action');
  }
  if (/(compared|checked|validated|make sure|knew it worked|consisten|benchmark|reviewed manually)/.test(value)) {
    score += 1;
    reasons.push('validation_method');
  }
  if (/(\d+\s*(minute|hour|%|percent|score|times?))/i.test(text) || /(reduced|improved|dropped|increase|decrease)/.test(value)) {
    score += 1;
    reasons.push('measurable_result');
  }
  return { score, reasons };
};

const analyseCandidateAnswers = (turns = []) => turns.map((turn, index) => {
  const evidenceType = classifyEvidenceType(turn.text);
  const strength = scoreEvidenceStrength(turn.text);
  return {
    index,
    text: normalizeText(turn.text),
    evidenceType,
    evidenceStrength: strength.score,
    evidenceSignals: strength.reasons,
    wordCount: toWords(turn.text).length,
  };
});

const buildEvidenceSummary = (analysedAnswers = []) => {
  const totals = analysedAnswers.reduce((acc, item) => {
    acc[item.evidenceType] = (acc[item.evidenceType] || 0) + 1;
    return acc;
  }, {});
  const averageStrength = analysedAnswers.length
    ? Number((analysedAnswers.reduce((sum, item) => sum + item.evidenceStrength, 0) / analysedAnswers.length).toFixed(2))
    : 0;
  const strongestExamples = analysedAnswers
    .filter((item) => item.evidenceStrength >= 3)
    .slice(0, 2)
    .map((item) => item.text.slice(0, 180));

  return {
    totals,
    averageStrength,
    strongestExamples,
  };
};

const buildInterviewMetrics = (transcript = [], totalQuestions = 0) => {
  const candidateTurns = transcript.filter((turn) => turn.role === 'user');
  const questionTurns = transcript.filter((turn) => isQuestionTurn(turn));
  const extraAiTurns = transcript.filter((turn) => turn.role === 'ai' && !isQuestionTurn(turn));
  return {
    candidateTurnCount: candidateTurns.length,
    interviewerQuestionCount: questionTurns.length,
    extraAiTurnCount: extraAiTurns.length,
    plannedQuestionCount: totalQuestions,
    interviewCompletedByLimit: questionTurns.length >= totalQuestions && totalQuestions > 0,
  };
};

const buildSummary = ({ analysisResult, session, evidenceSummary, interviewMetrics }) => {
  const direct = evidenceSummary.totals.direct_past_experience || 0;
  const adjacent = evidenceSummary.totals.indirect_adjacent_experience || 0;
  const hypothetical = evidenceSummary.totals.hypothetical_understanding || 0;
  const strengths = joinLabels(analysisResult.explanation?.strengths || [], 4);
  return `Decision: ${analysisResult.decision?.label || 'manual_review'}. Top matched areas: ${strengths || 'role fit, communication'}. Direct evidence turns: ${direct}. Adjacent evidence turns: ${adjacent}. Hypothetical turns: ${hypothetical}. Planned questions answered: ${Math.min(interviewMetrics.candidateTurnCount, interviewMetrics.plannedQuestionCount || interviewMetrics.candidateTurnCount)} of ${interviewMetrics.plannedQuestionCount || interviewMetrics.candidateTurnCount}.`;
};

const buildGapText = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const gaps = [];
  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0) {
    gaps.push('Some answers relied on hypothetical or system-level understanding rather than direct past examples.');
  }
  if ((evidenceSummary.totals.indirect_adjacent_experience || 0) > 0) {
    gaps.push('Several answers were adjacent to the asked technology rather than direct role-specific evidence.');
  }
  if (!interviewMetrics.interviewCompletedByLimit) {
    gaps.push('The interview did not cleanly finish the planned question set.');
  }
  if (!gaps.length && (analysisResult.explanation?.gaps || []).length) {
    return joinLabels(analysisResult.explanation.gaps, 4);
  }
  return gaps.join(' ');
};

export const runReportGeneratorAgent = async ({ session = {}, analysisResult = {}, interviewPlan = {}, retrievalBundle = null } = {}) => {
  const transcript = session.transcript || [];
  const userTurns = transcript.filter((turn) => turn.role === 'user');
  const explanation = analysisResult.explanation || { strengths: [], gaps: [], risks: [], summary: '' };
  const analysedAnswers = analyseCandidateAnswers(userTurns);
  const evidenceSummary = buildEvidenceSummary(analysedAnswers);
  const interviewMetrics = buildInterviewMetrics(transcript, session.totalQuestions || 0);
  const strongEvidenceText = evidenceSummary.strongestExamples.length
    ? evidenceSummary.strongestExamples.map((item, index) => `Example ${index + 1}: ${item}`).join(' | ')
    : 'No high-strength interview examples were captured.';

  const draft = {
    schemaVersion: 'v3',
    sessionId: session.id,
    candidateName: analysisResult.candidateName || session.candidateName || 'Candidate',
    jobTitle: analysisResult.jobTitle || session.targetRole || 'Target Role',
    generatedAt: new Date().toISOString(),
    summary: buildSummary({ analysisResult, session, evidenceSummary, interviewMetrics }),
    sections: [
      {
        id: 'match_overview',
        title: 'Match overview',
        content: `Overall score ${analysisResult.overallScore || 0}, confidence ${analysisResult.confidence || 0}. Decision: ${analysisResult.decision?.label || 'manual_review'}. Average evidence strength: ${evidenceSummary.averageStrength} out of 4.`,
      },
      {
        id: 'strengths',
        title: 'Strengths',
        content: explanation.strengths?.length
          ? `The clearest strengths were ${joinLabels(explanation.strengths)}. The strongest interview evidence showed real context, specific actions, validation steps, and measurable outcomes.`
          : 'No standout strengths were captured.',
      },
      {
        id: 'gaps',
        title: 'Gaps',
        content: buildGapText({ analysisResult, evidenceSummary, interviewMetrics }) || 'No major gaps were captured.',
      },
      {
        id: 'interview_observations',
        title: 'Interview observations',
        content: `The session recorded ${interviewMetrics.candidateTurnCount} candidate turns, ${interviewMetrics.interviewerQuestionCount} scored interviewer questions, and ${interviewMetrics.extraAiTurnCount} extra AI turns. Focus areas: ${(interviewPlan.interviewFocus || []).join(', ') || 'general role fit'}.`,
      },
      {
        id: 'evidence_quality',
        title: 'Evidence quality',
        content: `Direct past-experience turns: ${evidenceSummary.totals.direct_past_experience || 0}. Adjacent-experience turns: ${evidenceSummary.totals.indirect_adjacent_experience || 0}. Hypothetical-understanding turns: ${evidenceSummary.totals.hypothetical_understanding || 0}. Generic turns: ${evidenceSummary.totals.generic_filler || 0}.`,
      },
      {
        id: 'evidence_examples',
        title: 'Evidence examples',
        content: strongEvidenceText,
      },
    ],
    scores: {
      overall: analysisResult.overallScore || 0,
      macro: analysisResult.scoreBreakdown?.macro || 0,
      micro: analysisResult.scoreBreakdown?.micro || 0,
      requirements: analysisResult.scoreBreakdown?.requirements || 0,
      evidenceStrength: evidenceSummary.averageStrength,
      directEvidenceTurns: evidenceSummary.totals.direct_past_experience || 0,
      hypotheticalTurns: evidenceSummary.totals.hypothetical_understanding || 0,
    },
    recommendations: [
      (evidenceSummary.totals.hypothetical_understanding || 0) > 0
        ? 'Replace hypothetical wording with one real project example for each major technology question.'
        : 'Keep using concrete project examples with measurable outcomes.',
      interviewMetrics.interviewerQuestionCount !== (session.totalQuestions || interviewMetrics.interviewerQuestionCount)
        ? 'Align the interview flow so the number of asked questions matches the planned question count.'
        : 'Continue using STAR-style examples to tighten impact and outcome statements.',
    ],
    evidenceReferences: [
      ...(analysisResult.evidenceMap || []).slice(0, 5),
      ...((retrievalBundle?.items || []).slice(0, 3).map((item) => ({ chunkId: item.chunkId, label: item.metadata?.label || item.sourceType, sourceType: item.sourceType }))),
    ],
    interviewMetrics,
    evidenceDiagnostics: {
      totals: evidenceSummary.totals,
      averageStrength: evidenceSummary.averageStrength,
    },
  };

  return validateReportOutput(draft);
};
