import { validateReportOutput } from '../schemaValidationService.js';
import { generateCandidateFeedback } from '../reportCoachingService.js';

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

const getScoreBand = (overallScore = 0) => {
  if (overallScore >= 80) return 'Strong match';
  if (overallScore >= 65) return 'Promising match';
  if (overallScore >= 45) return 'Developing match';
  return 'Needs stronger evidence';
};

const getDecisionLabel = (analysisResult = {}) => analysisResult.decision?.label || 'manual_review';

const buildCandidateTakeaway = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const overallScore = Number(analysisResult.overallScore || 0);
  const evidenceStrength = Number(evidenceSummary.averageStrength || 0);
  const directTurns = Number(evidenceSummary.totals.direct_past_experience || 0);
  const hypotheticalTurns = Number(evidenceSummary.totals.hypothetical_understanding || 0);

  if (overallScore >= 80 && evidenceStrength >= 2.8) {
    return 'You come across as a strong fit for the role, with solid alignment and convincing examples from past work.';
  }

  if (overallScore >= 65 && directTurns >= hypotheticalTurns) {
    return 'You show good alignment with the role, and your next step is to make your strongest examples more specific and memorable.';
  }

  if (overallScore >= 45 && evidenceStrength < 2) {
    return 'You show partial fit for the role, but your answers need more real project evidence to feel convincing.';
  }

  if (!interviewMetrics.interviewCompletedByLimit && (interviewMetrics.plannedQuestionCount || 0) > 0) {
    return 'The interview captured some useful signals, but the full planned question set was not completed, so the feedback should be read as directional.';
  }

  if (hypotheticalTurns > 0) {
    return 'You show useful role understanding, but too many answers stayed theoretical instead of proving what you have already done.';
  }

  if (getDecisionLabel(analysisResult) === 'not_qualified') {
    return 'The report found role-critical gaps, so the main priority is building clearer evidence against the must-have requirements.';
  }

  return 'This interview shows some relevant signals, but you need stronger, more detailed examples to make your fit feel clear and credible.';
};

const buildPlainEnglishMetrics = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const overallScore = Number(analysisResult.overallScore || 0);
  const evidenceStrength = Number(evidenceSummary.averageStrength || 0);
  const directTurns = Number(evidenceSummary.totals.direct_past_experience || 0);
  const hypotheticalTurns = Number(evidenceSummary.totals.hypothetical_understanding || 0);
  const genericTurns = Number(evidenceSummary.totals.generic_filler || 0);
  const plannedQuestions = Number(interviewMetrics.plannedQuestionCount || 0);
  const askedQuestions = Number(interviewMetrics.interviewerQuestionCount || 0);

  return [
    {
      id: 'overall_fit',
      label: 'Overall role fit',
      value: overallScore,
      interpretation:
        overallScore >= 80
          ? 'Your profile and interview answers point to strong alignment with this role.'
          : overallScore >= 65
            ? 'You are reasonably aligned with the role, but there are still noticeable gaps to close.'
            : overallScore >= 45
              ? 'You have some relevant signals, but the case for fit is not strong yet.'
              : 'The current interview evidence does not yet support a strong match for this role.',
    },
    {
      id: 'evidence_strength',
      label: 'Evidence strength',
      value: evidenceStrength,
      interpretation:
        evidenceStrength >= 3
          ? 'Your answers usually included context, actions, and outcomes, which makes them persuasive.'
          : evidenceStrength >= 2
            ? 'Some answers had useful detail, but several still needed clearer actions or outcomes.'
            : 'Most answers were too general. You would benefit from using concrete project stories with measurable results.',
    },
    {
      id: 'direct_examples',
      label: 'Use of real examples',
      value: directTurns,
      interpretation:
        directTurns >= 4
          ? 'You regularly grounded your answers in past experience, which is exactly what interviewers look for.'
          : directTurns >= 2
            ? 'You used some real examples, but there is room to anchor more answers in work you have actually done.'
            : 'Very few answers were backed by direct past experience, which is likely reducing your credibility.',
    },
    {
      id: 'hypothetical_answers',
      label: 'Theoretical answers',
      value: hypotheticalTurns,
      interpretation:
        hypotheticalTurns === 0
          ? 'You stayed grounded in what you have done, not only what you might do.'
          : hypotheticalTurns <= 2
            ? 'A few answers sounded theoretical. Replacing them with real examples would make your story stronger.'
            : 'Too many answers leaned on theory or intent. Interviewers usually trust demonstrated experience more than hypothetical reasoning.',
    },
    {
      id: 'interview_completion',
      label: 'Interview completion',
      value: plannedQuestions > 0 ? Math.min(100, Math.round((askedQuestions / Math.max(plannedQuestions, 1)) * 100)) : askedQuestions,
      interpretation:
        plannedQuestions > 0 && askedQuestions === plannedQuestions
          ? 'You completed the planned interview flow, so this report reflects the full session.'
          : 'The interview did not fully match the planned flow, so some signals may be incomplete.',
    },
    {
      id: 'generic_answers',
      label: 'Generic answers',
      value: genericTurns,
      interpretation:
        genericTurns >= 4
          ? 'Several answers likely felt broad or surface-level. This is a strong signal to prepare sharper STAR-style examples.'
          : genericTurns > 0
            ? 'A few answers may have felt too broad. Tightening them with specifics would improve clarity and impact.'
            : 'Most answers had enough substance to avoid sounding generic.',
    },
  ];
};

const buildStrengthHighlights = ({ explanation }) => (explanation.strengths || []).slice(0, 4).map((item) => ({
  title: item.label,
  explanation: 'This showed up as one of your clearer role-fit signals and is worth reinforcing with specific examples.',
}));

const buildImprovementPriorities = ({ analysisResult, evidenceSummary, interviewMetrics }) => {
  const priorities = [];

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0) {
    priorities.push({
      title: 'Use more real project examples',
      whyItMatters: 'Interviewers trust demonstrated experience more than theoretical explanations.',
      action: 'Prepare 2-3 project stories that clearly explain the situation, your actions, and the result.',
    });
  }

  if ((evidenceSummary.averageStrength || 0) < 2.2) {
    priorities.push({
      title: 'Add more detail to each answer',
      whyItMatters: 'Answers feel stronger when they show context, ownership, and outcomes rather than staying at a high level.',
      action: 'Use a simple structure in every answer: context, what you did, and what changed because of your work.',
    });
  }

  if ((evidenceSummary.totals.generic_filler || 0) >= 3) {
    priorities.push({
      title: 'Reduce broad or generic wording',
      whyItMatters: 'Generic answers make it harder for interviewers to judge your actual level and impact.',
      action: 'Replace broad claims with one concrete example, one decision you made, and one result you achieved.',
    });
  }

  if ((interviewMetrics.plannedQuestionCount || 0) > 0 && interviewMetrics.interviewerQuestionCount !== interviewMetrics.plannedQuestionCount) {
    priorities.push({
      title: 'Practise more concise answers',
      whyItMatters: 'Focused answers help the interview stay on track and make your strongest evidence easier to notice.',
      action: 'Aim for a 60-90 second core answer, then expand only when the interviewer asks for more detail.',
    });
  }

  if ((analysisResult.explanation?.gaps || []).length > 0) {
    priorities.push({
      title: 'Target the biggest role-specific gaps',
      whyItMatters: 'Closing the most obvious requirement gaps will improve both your confidence and your match score.',
      action: `Prioritize preparation around: ${joinLabels(analysisResult.explanation.gaps, 3) || 'the main missing requirements'}.`,
    });
  }

  if (!priorities.length) {
    priorities.push({
      title: 'Keep strengthening specificity',
      whyItMatters: 'You already have a workable base, and sharper examples will make your answers more memorable.',
      action: 'For each key project, prepare one sentence on the challenge, one on your contribution, and one on the outcome.',
    });
  }

  return priorities.slice(0, 4);
};

const buildCoachingAdvice = ({ evidenceSummary, interviewPlan }) => {
  const focusAreas = (interviewPlan.interviewFocus || []).filter(Boolean);
  const advice = [];

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0) {
    advice.push({
      theme: 'Replace theory with proof',
      advice: 'When a question asks about a skill, lead with a real project you have already worked on.',
      example: 'Instead of saying "I would use React Native to build this", say "In my last project, I used React Native to build X, solved Y, and improved Z."',
    });
  }

  if ((evidenceSummary.averageStrength || 0) < 2.2) {
    advice.push({
      theme: 'Add action and outcome',
      advice: 'Your answers will feel stronger if each one includes what you personally did and what changed because of it.',
      example: 'Use this pattern: "The challenge was..., I handled..., and the result was..."',
    });
  }

  if ((evidenceSummary.totals.direct_past_experience || 0) < 3) {
    advice.push({
      theme: 'Prepare reusable stories',
      advice: 'Build a small bank of stories that show technical problem-solving, collaboration, and ownership.',
      example: 'Prepare one mobile feature story, one debugging story, and one teamwork story, each in under 90 seconds.',
    });
  }

  if ((evidenceSummary.totals.generic_filler || 0) >= 3) {
    advice.push({
      theme: 'Avoid generic wording',
      advice: 'Move past tools and concepts, and explain your judgment, trade-offs, and execution.',
      example: 'Swap "I know testing is important" for "I added tests for X, caught Y issue early, and avoided regression in Z flow."',
    });
  }

  if (focusAreas.length > 0) {
    advice.push({
      theme: 'Target the role focus areas',
      advice: `The interview repeatedly touched on ${focusAreas.slice(0, 3).join(', ')}. These are the areas to strengthen first.`,
      example: `Prepare one confident example for each of these areas: ${focusAreas.slice(0, 3).join(', ')}.`,
    });
  }

  if (!advice.length) {
    advice.push({
      theme: 'Keep building clarity',
      advice: 'Your next gain will come from sharper examples and clearer impact statements.',
      example: 'For each project, prepare one sentence on the challenge, one on your actions, and one on the result.',
    });
  }

  return advice.slice(0, 4);
};

const buildAnswerRewriteExamples = ({ evidenceSummary }) => {
  const examples = [
    {
      weak: 'I think I would use React Native to do that.',
      better: 'In a previous project, I used React Native to build a mobile flow, handled API integration, and improved the user experience by fixing performance and stability issues.',
    },
  ];

  if ((evidenceSummary.totals.generic_filler || 0) > 0) {
    examples.push({
      weak: 'I am a good problem solver and I work well in teams.',
      better: 'When our team hit a blocker, I broke the issue into smaller parts, coordinated the handoff with teammates, and helped the team ship the feature on time.',
    });
  }

  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0) {
    examples.push({
      weak: 'If I was given that problem, I would probably approach it by using the framework carefully.',
      better: 'In my last project, I faced a similar problem, chose a practical approach, implemented it step by step, and checked the result through testing and review.',
    });
  }

  return examples.slice(0, 3);
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
  const deterministicCandidateFeedback = {
    overallTakeaway: buildCandidateTakeaway({ analysisResult, evidenceSummary, interviewMetrics }),
    scoreBand: getScoreBand(analysisResult.overallScore || 0),
    plainEnglishMetrics: buildPlainEnglishMetrics({ analysisResult, evidenceSummary, interviewMetrics }),
    strengthHighlights: buildStrengthHighlights({ explanation }),
    improvementPriorities: buildImprovementPriorities({ analysisResult, evidenceSummary, interviewMetrics }),
    coachingAdvice: buildCoachingAdvice({ evidenceSummary, interviewPlan }),
    answerRewriteExamples: buildAnswerRewriteExamples({ evidenceSummary }),
  };
  const candidateFeedback = await generateCandidateFeedback({
    session,
    analysisResult,
    interviewPlan,
    evidenceSummary,
    interviewMetrics,
    strongestExamples: evidenceSummary.strongestExamples,
    deterministicFeedback: deterministicCandidateFeedback,
  });

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
    candidateFeedback,
  };

  return validateReportOutput(draft);
};
