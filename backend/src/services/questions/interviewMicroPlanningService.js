import { callDeepSeek } from '../deepseekService.js';
import { guardGeneratedTextForInterviewMode } from '../aiControl/interviewModeGuard.js';
import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';
import { hasAwkwardQuestionWording, polishQuestionWording } from './questionWordingPolishService.js';

const extractJsonObject = (text = '') => {
  const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = String(text || '').indexOf('{');
  const end = String(text || '').lastIndexOf('}');
  if (start >= 0 && end > start) return String(text).slice(start, end + 1);
  return String(text || '').trim();
};

const countQuestionMarks = (text = '') => (String(text || '').match(/\?/g) || []).length;
const countWords = (text = '') => normalizeText(text).split(/\s+/).filter(Boolean).length;
const isVoicePlanningFrame = (planningFrame = {}) => (
  normalizeKey(planningFrame.deliveryMode).includes('voice')
);

const hasTechnicalImplementationProbe = (text = '') => /\b(code|algorithm|database schema|sql query|implementation detail|latency|scalability|architecture|api endpoint|library|framework)\b/i.test(text);

const RUBRIC_STYLE_PATTERNS = [
  /\bevidence\s+for\s+studying\b/i,
  /\bshows?\s+your\s+evidence\s+for\b/i,
  /\bevidence\s+for\s+can\b/i,
  /\blimited\s+direct\s+evidence\s+for\b/i,
  /\bwhat\s+evidence\s+do\s+you\s+have\s+for\b/i,
  /\bmeeting\s+the\s+.+\s+requirement\b/i,
  /\brelated[-\s]?field\s+requirement\b/i,
  /\bcredential\s+evidence\b/i,
  /\brequirement\s+alignment\b/i,
];

const INTERNAL_ASSESSMENT_PATTERNS = [
  /\bi want to validate (?:one )?possible gap\b/i,
  /\bpossible gap around\b/i,
  /\bmatch gap\b/i,
  /\blimited direct evidence\b/i,
  /\bassessment (?:goal|criteria|rubric)\b/i,
  /\binternal (?:rubric|requirement|assessment)\b/i,
];

const hasRubricStyleQuestion = (text = '') =>
  RUBRIC_STYLE_PATTERNS.some((pattern) => pattern.test(String(text || '')));

const hasInternalAssessmentPreamble = (text = '') =>
  INTERNAL_ASSESSMENT_PATTERNS.some((pattern) => pattern.test(String(text || '')));

const extractTopicFromFrame = (planningFrame = {}, questionText = '') => {
  const topic = planningFrame.targetTopic || planningFrame.topic || planningFrame.matchedSkill;
  if (topic && typeof topic === 'string' && !/\b(evidence|gap|requirement|match_gap)\b/i.test(topic)) {
    return topic;
  }
  const cleanText = normalizeText(questionText);
  const match = cleanText.match(/\b(?:around|for|with|in|using|about)\s+([A-Za-z0-9+#.\- ]{2,35}?)(?=\s*(?:\?|\.|,|$|what|how))/i);
  if (match?.[1]) {
    const candidate = match[1].trim();
    if (!/\b(evidence|gap|requirement|experience|role|study)\b/i.test(candidate)) {
      return candidate;
    }
  }
  return null;
};

const buildSafeRequirementQuestion = ({ question = '', fallbackQuestion = '', planningFrame = {} } = {}) => {
  const extractedTopic = extractTopicFromFrame(planningFrame, `${question} ${fallbackQuestion}`);
  if (extractedTopic) {
    return `Can you give me one practical example that shows your experience with ${extractedTopic}?`;
  }
  return 'Can you give me one practical example from your experience for this role?';
};

const naturalizeRubricStyleQuestion = ({
  question = '',
  fallbackQuestion = '',
  planningFrame = {},
} = {}) => {
  const polishedQuestion = polishQuestionWording(question || fallbackQuestion);
  const genericQuestion = buildSafeRequirementQuestion({ question: polishedQuestion, fallbackQuestion, planningFrame });
  if (hasInternalAssessmentPreamble(polishedQuestion)) {
    const safeFallback = polishQuestionWording(fallbackQuestion);
    const fallbackIsSafe = safeFallback
      && !hasInternalAssessmentPreamble(safeFallback)
      && !hasRubricStyleQuestion(safeFallback);
    return {
      question: fallbackIsSafe ? safeFallback : genericQuestion,
      riskFlags: ['internal_assessment_preamble_rewritten'],
    };
  }

  if (isVoicePlanningFrame(planningFrame) && countWords(polishedQuestion) > 30) {
    const safeFallback = polishQuestionWording(fallbackQuestion);
    const boundedFallback = countWords(safeFallback) <= 30
      && !hasInternalAssessmentPreamble(safeFallback)
      && !hasRubricStyleQuestion(safeFallback);
    return {
      question: boundedFallback ? safeFallback : genericQuestion,
      riskFlags: ['overlong_spoken_question_rewritten'],
    };
  }

  const frameText = normalizeText(
    `${question} ${fallbackQuestion} ${JSON.stringify(planningFrame || {})}`,
  ).toLowerCase();

  const shouldRewrite =
    hasRubricStyleQuestion(question) ||
    hasRubricStyleQuestion(fallbackQuestion) ||
    hasRubricStyleQuestion(polishedQuestion);

  if (!shouldRewrite) {
    return {
      question: polishedQuestion,
      riskFlags: [],
    };
  }

  if (
    /\b(studying|study|education|credential|degree|master|information systems|computer science|software|data|related field)\b/i.test(frameText)
  ) {
    return {
      question:
        'Which coursework or project from your IT study has prepared you most for this automation role?',
      riskFlags: ['rubric_style_question_rewritten', 'credential_requirement_reworded'],
    };
  }

  if (/\b(non[-\s]?technical|stakeholder|staff|communication|explain|explained)\b/i.test(frameText)) {
    return {
      question:
        'Can you describe a time when you explained a technical issue to a non-technical stakeholder?',
      riskFlags: ['rubric_style_question_rewritten', 'stakeholder_question_reworded'],
    };
  }

  if (/\b(ask good questions|jumping into|technical solution|root cause|real pain point|investigate)\b/i.test(frameText)) {
    return {
      question:
        'Can you describe a time when you asked questions to understand a problem before choosing a technical solution?',
      riskFlags: ['rubric_style_question_rewritten', 'investigation_question_reworded'],
    };
  }

  if (/\b(documentation|documented|handover|reporting)\b/i.test(frameText)) {
    return {
      question:
        'Can you describe a time when you created or improved documentation to help other people use a process?',
      riskFlags: ['rubric_style_question_rewritten', 'documentation_question_reworded'],
    };
  }

  return {
    question: genericQuestion,
    riskFlags: ['rubric_style_question_rewritten', 'generic_requirement_reworded'],
  };
};

export const buildSafeSpokenQuestion = ({
  question = '',
  fallbackQuestion = '',
  deliveryMode = 'voice',
} = {}) => naturalizeRubricStyleQuestion({
  question,
  fallbackQuestion,
  planningFrame: { deliveryMode },
});

const buildPrompt = ({ planningFrame = {} } = {}) => `Return strict JSON only:
{
  "selectedAngle": "short angle grounded in the frame",
  "shortReason": "one short sentence",
  "finalSpokenQuestion": "one clear interview question",
  "evidenceUsed": ["short source label"],
  "riskFlags": []
}

Rules:
- Ask exactly one question.
- finalSpokenQuestion must be ready for text-to-speech.
- Use natural spoken English for a real interview.
- Keep the original assessment goal, but polish awkward wording.
- Avoid unnatural verb-object pairs such as "showed documentation".
- Convert rubric-style requirements into natural interview questions.
- For credential, education, eligibility, or related-field requirements, do not ask unnatural questions such as "evidence for studying..." or "shows your evidence for...".
- If the CV already shows the credential, ask for one relevant coursework, project, or practical example that prepared the candidate for this role.
- If credential evidence is missing or ambiguous, ask a simple verification question instead of a behavioural evidence question.
- Never expose internal rubric labels, requirement names, or assessment wording in finalSpokenQuestion.
- Prefer common verbs: created, wrote, improved, explained, documented, clarified, validated.
- For documentation-related questions, ask about creating, improving, or using documentation to help others.
- Do not invent CV, JD, match, or transcript facts.
- Do not switch broad scenario.
- Do not ask technical implementation questions in behavioural-only mode.
- Do not ask generic interview-bank questions when CV/JD/match evidence is available.
- For follow-ups, stay on the parent topic unless the scenario is switch_topic, shift_section, or wrap_up.

Examples:
Bad: "Tell me about one example that shows your evidence for studying information systems, computer science, data, software, or a related field."
Good: "Which coursework or project from your IT study has prepared you most for this automation role?"

Bad: "What evidence do you have for meeting the related field requirement?"
Good: "Can you briefly explain how your study background connects to this role?"

Planning frame:
${JSON.stringify(planningFrame, null, 2)}`;

export const parseMicroPlanningResponse = (content = '') => JSON.parse(extractJsonObject(content));

export const buildFallbackMicroPlan = ({
  fallbackQuestion = '',
  reason = 'fallback_micro_plan',
  evidenceUsed = [],
  planningFrame = {},
} = {}) => {
  const naturalized = naturalizeRubricStyleQuestion({
    question: fallbackQuestion,
    fallbackQuestion,
    planningFrame,
  });

  return {
    selectedAngle: 'fallback',
    shortReason: reason,
    finalSpokenQuestion: naturalized.question,
    evidenceUsed,
    riskFlags: ['fallback_used', ...naturalized.riskFlags],
  };
};

export const validateMicroPlan = ({
  microPlan = {},
  planningFrame = {},
  fallbackQuestion = '',
  focusArea = 'combined',
} = {}) => {
  const naturalizedInitialQuestion = naturalizeRubricStyleQuestion({
    question: microPlan.finalSpokenQuestion,
    fallbackQuestion,
    planningFrame,
  });

  const finalSpokenQuestion = normalizeText(naturalizedInitialQuestion.question);
  const riskFlags = ensureArray(microPlan.riskFlags).concat(naturalizedInitialQuestion.riskFlags);
  const normalizedFocus = normalizeKey(focusArea).replace('behavioral', 'behavioural');
  const validationErrors = [];

  if (!finalSpokenQuestion) validationErrors.push('missing_final_spoken_question');
  if (countQuestionMarks(finalSpokenQuestion) > 1) validationErrors.push('multiple_questions');
  if (!/[?？]\s*$/.test(finalSpokenQuestion)) validationErrors.push('not_a_question');
  if (isVoicePlanningFrame(planningFrame) && countWords(finalSpokenQuestion) > 30) {
    validationErrors.push('overlong_spoken_question');
  }
  if (hasAwkwardQuestionWording(finalSpokenQuestion)) validationErrors.push('awkward_question_wording');
  if (normalizedFocus === 'behavioural' && hasTechnicalImplementationProbe(finalSpokenQuestion)) {
    validationErrors.push('behavioural_mode_technical_probe');
  }
  if (planningFrame.turnKind === 'follow_up' && !planningFrame.parentQuestion && planningFrame.scenario !== 'intro_follow_up') {
    validationErrors.push('follow_up_missing_parent');
  }

  const fallbackNaturalized = naturalizeRubricStyleQuestion({
    question: fallbackQuestion,
    fallbackQuestion,
    planningFrame,
  });

  const guardedQuestion = validationErrors.length
    ? fallbackNaturalized.question
    : guardGeneratedTextForInterviewMode({
        focusArea,
        generatedText: finalSpokenQuestion,
        fallbackText: fallbackNaturalized.question,
        selectedQuestion: {
          text: fallbackNaturalized.question,
          fallbackText: fallbackNaturalized.question,
        },
      });

  const finalNaturalized = naturalizeRubricStyleQuestion({
    question: guardedQuestion,
    fallbackQuestion: fallbackNaturalized.question,
    planningFrame,
  });

  const safeQuestion = polishQuestionWording(finalNaturalized.question);

  return {
    ok: validationErrors.length === 0 && Boolean(safeQuestion),
    microPlan: {
      selectedAngle: normalizeText(microPlan.selectedAngle) || 'bounded_question',
      shortReason: normalizeText(microPlan.shortReason) || 'Generated inside the selected scenario.',
      finalSpokenQuestion: safeQuestion || fallbackNaturalized.question,
      evidenceUsed: ensureArray(microPlan.evidenceUsed).slice(0, 6),
      riskFlags: riskFlags
        .concat(fallbackNaturalized.riskFlags)
        .concat(finalNaturalized.riskFlags)
        .concat(validationErrors.map((item) => `validation:${item}`)),
    },
    validationErrors,
  };
};

export const runBoundedQuestionMicroPlanning = async ({
  planningFrame = {},
  fallbackQuestion = '',
  focusArea = 'combined',
  callModel = callDeepSeek,
} = {}) => {
  try {
    const { content } = await callModel(
      buildPrompt({ planningFrame }),
      'You are a bounded interview micro-planner. Return strict JSON only.',
      {
        usageMetadata: {
          stage: 'interview',
          operation: 'llm_json',
          feature: 'bounded_question_micro_planning',
        },
      },
    );
    const parsed = parseMicroPlanningResponse(content);
    const validation = validateMicroPlan({ microPlan: parsed, planningFrame, fallbackQuestion, focusArea });
    if (validation.ok) return validation.microPlan;
    return buildFallbackMicroPlan({
      fallbackQuestion,
      reason: `micro_plan_validation_failed:${validation.validationErrors.join(',')}`,
      evidenceUsed: validation.microPlan.evidenceUsed,
      planningFrame,
    });
  } catch (error) {
    return buildFallbackMicroPlan({
      fallbackQuestion,
      reason: `micro_plan_failed:${error?.message || String(error)}`,
      planningFrame,
    });
  }
};
