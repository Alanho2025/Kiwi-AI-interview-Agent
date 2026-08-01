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
  console.log('MICRO_PLAN_TOPIC_DEBUG', {
    targetTopic: planningFrame.targetTopic,
    topic: planningFrame.topic,
    matchedSkill: planningFrame.matchedSkill,
    parentTopic: planningFrame.parentTopic,
    currentTopic: planningFrame.currentTopic,
    questionText,
  });
  const topic =
    planningFrame.targetTopic
    || planningFrame.topic
    || planningFrame.matchedSkill
    || planningFrame.parentQuestion?.parentTopic;
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

Your task:
Turn the selected question plan into one natural interview question.
Preserve what the system needs to assess, but do not preserve the original sentence structure.

Core rules:
- Ask exactly one primary question.
- finalSpokenQuestion must be ready for text-to-speech.
- Use natural spoken English that a real interviewer would use.
- Rewrite the question rather than copying the source or fallback wording.
- Preserve the assessment intent, target topic, and evidence need.
- Ask for one concrete example when past experience is required.
- Ask only for the most important evidence needed in this turn.
- Keep the question concise, preferably under 24 words and never over 30 words for voice.
- Use the candidate's previous answer when the frame contains relevant transcript context.
- For follow-ups, directly target the missing detail instead of repeating the root question.
- For root questions, introduce the topic naturally and ask for one focused example.
- Vary the sentence structure based on the topic and conversation context.

Do not:
- Do not copy fallbackQuestion, source question text, or JD wording verbatim.
- Do not merely replace a topic inside a generic sentence template.
- Do not use the phrase "What is the strongest example from your experience involving".
- Do not repeatedly begin questions with the same frame used in recent interviewer questions.
- Do not ask two or three separate questions joined together.
- Do not expose internal rubric labels, match gaps, requirement names, evidence scores, or assessment wording.
- Do not invent CV, JD, match, project, or transcript facts.
- Do not switch to a different topic or scenario.
- Do not ask a generic interview-bank question when specific CV, JD, match, or transcript context is available.
- Do not ask technical implementation questions in behavioural-only mode.
- Do not turn a technical topic into a vague behavioural question.
- Do not repeat a root question as a follow-up.

Question design guidance:

For a technical root question:
- Ground it in one project or practical example.
- Focus on the most relevant angle, such as ownership, implementation, decision, trade-off, data quality, deployment, or validation.
- Choose the angle that best matches the planning frame instead of asking for all of them.

For a behavioural root question:
- Ask for one real situation.
- Focus on the candidate's personal action and the relevant behaviour.
- Do not force the full STAR structure into one long question.

For a follow-up:
- Use the parent topic and the candidate's previous answer.
- Ask only for the most important missing evidence.
- Examples of useful follow-up angles include:
  ownership, specific action, technical depth, decision reason,
  trade-off, validation, result, stakeholder response, or reflection.
- Do not restart with "Tell me about a time" when the candidate is already discussing an example.

For credential or education requirements:
- When the credential is already visible, ask how relevant coursework or a project prepared the candidate.
- When it is genuinely unclear, ask a brief verification question.
- Do not ask for "evidence of meeting the requirement".

For stakeholder or communication topics:
- Ask about the audience, what the candidate changed in their communication, or the resulting alignment.
- Do not simply ask whether they have communication skills.

For technical tools or platforms:
- Ask how the candidate used the tool in a real project.
- Select one useful angle based on the frame, such as what they owned, why they chose it, or how they validated it.
- Do not copy a long list of tools from the JD unless the list itself is necessary.

For data topics:
- Ask about the actual data problem, preparation, transformation, quality, modelling, or validation.
- Avoid generic wording that could apply to any technical skill.

For AI or ML topics:
- Ask about application, evaluation, limitations, safety, or trade-offs based on the frame.
- Avoid treating every AI topic as a generic software implementation question.

Quality check before returning:
1. Is this one question?
2. Does it sound natural when spoken aloud?
3. Does it assess the intended target?
4. Is it grounded in the supplied frame?
5. Is it different in structure from generic fallback wording?
6. Does it avoid asking for evidence already provided?
7. Is it concise enough for a live interview?

Bad:
"What is the strongest example from your experience involving cloud data platforms such as Azure, AWS, or GCP? What did you build or change, and how did you evaluate it?"

Better:
"Tell me about a cloud deployment you worked on and which part you personally owned."

Bad follow-up:
"Can you walk me through a specific project where you were responsible for the architecture and deployment, and what part did you personally own?"

Better follow-up when EC2 was already mentioned:
"Why did you choose EC2 for that deployment?"

Bad:
"What is the strongest example from your experience involving structured and unstructured datasets?"

Better:
"How did you handle data quality in a project that used different types of data?"

Bad:
"Tell me about a time you demonstrated stakeholder communication. What did you personally do, and what was the outcome?"

Better:
"How did you adapt your explanation for a non-technical stakeholder?"

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
      `You are an experienced interviewer responsible for converting a bounded assessment plan into one concise, natural spoken question. Preserve the assessment intent, but never copy generic template wording. Return strict JSON only.`,
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
