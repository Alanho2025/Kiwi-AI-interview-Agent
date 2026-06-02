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

const hasTechnicalImplementationProbe = (text = '') => /\b(code|algorithm|database schema|sql query|implementation detail|latency|scalability|architecture|api endpoint|library|framework)\b/i.test(text);

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
- Prefer common verbs: created, wrote, improved, explained, documented, clarified, validated.
- For documentation-related questions, ask about creating, improving, or using documentation to help others.
- Do not invent CV, JD, match, or transcript facts.
- Do not switch broad scenario.
- Do not ask technical implementation questions in behavioural-only mode.
- Do not ask generic interview-bank questions when CV/JD/match evidence is available.
- For follow-ups, stay on the parent topic unless the scenario is switch_topic, shift_section, or wrap_up.

Planning frame:
${JSON.stringify(planningFrame, null, 2)}`;

export const parseMicroPlanningResponse = (content = '') => JSON.parse(extractJsonObject(content));

export const buildFallbackMicroPlan = ({ fallbackQuestion = '', reason = 'fallback_micro_plan', evidenceUsed = [] } = {}) => ({
  selectedAngle: 'fallback',
  shortReason: reason,
  finalSpokenQuestion: polishQuestionWording(fallbackQuestion),
  evidenceUsed,
  riskFlags: ['fallback_used'],
});

export const validateMicroPlan = ({
  microPlan = {},
  planningFrame = {},
  fallbackQuestion = '',
  focusArea = 'combined',
} = {}) => {
  const finalSpokenQuestion = normalizeText(microPlan.finalSpokenQuestion);
  const riskFlags = ensureArray(microPlan.riskFlags);
  const normalizedFocus = normalizeKey(focusArea).replace('behavioral', 'behavioural');
  const validationErrors = [];

  if (!finalSpokenQuestion) validationErrors.push('missing_final_spoken_question');
  if (countQuestionMarks(finalSpokenQuestion) > 1) validationErrors.push('multiple_questions');
  if (!/[?？]\s*$/.test(finalSpokenQuestion)) validationErrors.push('not_a_question');
  if (hasAwkwardQuestionWording(finalSpokenQuestion)) validationErrors.push('awkward_question_wording');
  if (normalizedFocus === 'behavioural' && hasTechnicalImplementationProbe(finalSpokenQuestion)) {
    validationErrors.push('behavioural_mode_technical_probe');
  }
  if (planningFrame.turnKind === 'follow_up' && !planningFrame.parentQuestion && planningFrame.scenario !== 'intro_follow_up') {
    validationErrors.push('follow_up_missing_parent');
  }

  const safeQuestion = validationErrors.length
    ? polishQuestionWording(fallbackQuestion)
    : polishQuestionWording(guardGeneratedTextForInterviewMode({
        focusArea,
        generatedText: finalSpokenQuestion,
        fallbackText: fallbackQuestion,
        selectedQuestion: { text: fallbackQuestion, fallbackText: fallbackQuestion },
      }));

  return {
    ok: validationErrors.length === 0 && Boolean(safeQuestion),
    microPlan: {
      selectedAngle: normalizeText(microPlan.selectedAngle) || 'bounded_question',
      shortReason: normalizeText(microPlan.shortReason) || 'Generated inside the selected scenario.',
      finalSpokenQuestion: safeQuestion || polishQuestionWording(fallbackQuestion),
      evidenceUsed: ensureArray(microPlan.evidenceUsed).slice(0, 6),
      riskFlags: riskFlags.concat(validationErrors.map((item) => `validation:${item}`)),
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
    });
  } catch (error) {
    return buildFallbackMicroPlan({
      fallbackQuestion,
      reason: `micro_plan_failed:${error?.message || String(error)}`,
    });
  }
};
