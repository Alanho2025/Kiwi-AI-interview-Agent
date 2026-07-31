import { callDeepSeek } from '../deepseekService.js';
import { buildGeneralCompanyValuesFallback } from './companyGeneralValuesFallback.js';
import { ensureArray, ensureString, ensureNumber } from '../../utils/commonHelpers.js';

const MOTIVATION_QUESTION_TEXT = 'what attracted you to this company and role';


const extractJsonObject = (text = '') => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
};

export const findMotivationAnswer = ({ transcript = [] } = {}) => {
  const turns = Array.isArray(transcript?.turns) ? transcript.turns : ensureArray(transcript);

  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index] || {};
    const text = ensureString(turn.text || turn.question).toLowerCase();
    const metadata = turn.metadata || {};
    const isMotivationQuestion =
      turn.id === 'company_role_motivation' ||
      turn.questionId === 'company_role_motivation' ||
      metadata.questionType === 'company_motivation' ||
      metadata.topic === 'company_and_role_motivation' ||
      text.includes(MOTIVATION_QUESTION_TEXT);

    if (turn.role === 'ai' && isMotivationQuestion) {
      const nextUserTurn = turns
        .slice(index + 1)
        .find((item) => String(item.role || '').toLowerCase() === 'user' && ensureString(item.text));
      return {
        answer: ensureString(nextUserTurn?.text),
        evidenceStrength: nextUserTurn ? 'direct' : 'missing',
      };
    }
  }

  return {
    answer: turns
      .filter((turn) => String(turn.role || '').toLowerCase() === 'user')
      .map((turn) => ensureString(turn.text))
      .filter(Boolean)
      .join('\n'),
    evidenceStrength: 'weak_full_transcript',
  };
};

const normalizeSignal = (value = {}) => ({
  score: ensureNumber(value.score, 0),
  comment: ensureString(value.comment),
});

export const normalizeCompanyMotivationFit = (value = {}, fallback = {}) => ({
  source: ensureString(value.source, fallback.source || 'general_fallback'),
  score: ensureNumber(value.score, fallback.score || 0),
  summary: ensureString(value.summary, fallback.summary || ''),
  matchedValues: ensureArray(value.matchedValues).map((item) => ({
    value: ensureString(item.value),
    candidateQuote: ensureString(item.candidateQuote),
    comment: ensureString(item.comment),
    reviewed: item.reviewed ?? true,
  })).filter((item) => (item.value || item.comment) && item.reviewed !== false),
  missingValues: ensureArray(value.missingValues).map((item) => ({
    value: ensureString(item.value),
    whyItMatters: ensureString(item.whyItMatters),
    suggestion: ensureString(item.suggestion),
    reviewed: item.reviewed ?? true,
  })).filter((item) => (item.value || item.suggestion) && item.reviewed !== false),
  candidateResearchSignal: normalizeSignal(value.candidateResearchSignal || fallback.candidateResearchSignal),
  roleMotivationSignal: normalizeSignal(value.roleMotivationSignal || fallback.roleMotivationSignal),
  suggestedRewrite: ensureString(value.suggestedRewrite, fallback.suggestedRewrite || ''),
  fallbackReason: ensureString(value.fallbackReason, fallback.fallbackReason || ''),
  evidenceStrength: ensureString(value.evidenceStrength, fallback.evidenceStrength || ''),
});

const buildFallbackMotivationFit = ({ profile = {}, motivationAnswer = '', evidenceStrength = 'missing' } = {}) => {
  const source = profile.source === 'official_website' || profile.source === 'manual' ? profile.source : 'general_fallback';
  const hasAnswer = Boolean(ensureString(motivationAnswer));
  const answer = ensureString(motivationAnswer).toLowerCase();
  const hasRoleInterest = /(game|gaming|ai|npc|product|role|intern|client|user|business)/.test(answer);
  const hasCompanySpecificResearch = /(tencent|mission|values|official|company culture|product line|studio|portfolio)/.test(answer);
  return normalizeCompanyMotivationFit({
    source,
    score: hasAnswer ? (hasRoleInterest ? 5 : 3) + (hasCompanySpecificResearch && source !== 'general_fallback' ? 2 : 0) : 0,
    summary: hasAnswer
      ? hasRoleInterest
        ? 'The answer shows role/topic motivation, but it still needs one specific company reason and a cleaner link to candidate evidence.'
        : 'The motivation answer was captured, but it needs a clearer link to this specific role and company.'
      : 'No clear answer to the company and role motivation question was captured.',
    matchedValues: [],
    missingValues: ensureArray(profile.values).slice(0, 3).map((item) => ({
      value: item.label,
      whyItMatters: item.description,
      suggestion: 'Connect one specific motivation point to this signal.',
    })),
    candidateResearchSignal: {
      score: hasAnswer && /company|mission|values|product|customer|team|culture/i.test(motivationAnswer) ? 5 : 1,
      comment: hasAnswer
        ? source === 'general_fallback'
          ? 'No verified company-specific source was available, so this should be treated as general research guidance.'
          : 'Review the answer for specific company research evidence.'
        : 'No motivation answer was available.',
    },
    roleMotivationSignal: {
      score: hasAnswer && hasRoleInterest ? 6 : hasAnswer ? 3 : 0,
      comment: hasRoleInterest ? 'The answer shows some role motivation through game, AI, product, or user-interest signals.' : 'No role motivation evidence was available.',
    },
    suggestedRewrite: hasAnswer
      ? source === 'general_fallback'
        ? 'I am interested in this role because it combines game product thinking, AI features, and user experience. My background in database design, AI-enabled web applications, and gaming interest gives me a practical base to discuss how an AI feature could help players or product teams.'
        : 'I was attracted to this role because it connects the work I want to do next with the company context I have researched. I would strengthen my answer by naming one company-specific point, one role responsibility, and one example from my background.'
      : 'I was attracted to this company and role because [specific company reason] connects with [specific role responsibility], and my experience with [relevant example] would help me contribute.',
    fallbackReason: profile.fallbackReason || '',
    evidenceStrength,
  });
};

const sanitizeGeneralFallbackResult = (result = {}, fallback = {}) => {
  if (result.source !== 'general_fallback') return result;
  return normalizeCompanyMotivationFit({
    ...result,
    matchedValues: [],
    missingValues: fallback.missingValues,
    candidateResearchSignal: {
      score: Math.min(Number(result.candidateResearchSignal?.score || 0), 2),
      comment: 'Company-specific sources were unavailable, so this report cannot confirm company research claims.',
    },
    suggestedRewrite: fallback.suggestedRewrite,
    summary: result.summary && !/mission|values|tech for good|value for users/i.test(result.summary)
      ? result.summary
      : fallback.summary,
    fallbackReason: result.fallbackReason || fallback.fallbackReason || 'company_values_not_available_at_report_generation',
  }, fallback);
};

export const buildCompanyMotivationFit = async ({
  session = {},
  transcript = [],
  companyValuesProfile = null,
} = {}) => {
  const profile = companyValuesProfile?.values?.length
    ? companyValuesProfile
    : buildGeneralCompanyValuesFallback({
        companyName: companyValuesProfile?.companyName || session.companyName || '',
        reason: companyValuesProfile?.fallbackReason || 'company_values_not_available_at_report_generation',
      });
  const { answer: motivationAnswer, evidenceStrength } = findMotivationAnswer({ transcript });
  const fallback = buildFallbackMotivationFit({ profile, motivationAnswer, evidenceStrength });
  const transcriptText = ensureArray(transcript)
    .map((turn) => `${turn.role}: ${turn.text}`)
    .join('\n')
    .slice(0, 5000);

  if (process.env.COMPANY_MOTIVATION_AI_ENABLED === 'false') {
    return fallback;
  }

  try {
    const prompt = `
You are evaluating a candidate's answer to:
"What attracted you to this company and role?"

Return valid JSON only.

Company profile:
${JSON.stringify(profile, null, 2)}

Candidate motivation answer:
${motivationAnswer || '(No direct motivation answer found)'}

Full transcript context:
${transcriptText}

Required JSON:
{
  "source": "official_website | manual | general_fallback",
  "score": 0,
  "summary": "string",
  "matchedValues": [
    {
      "value": "string",
      "candidateQuote": "string",
      "comment": "string"
    }
  ],
  "missingValues": [
    {
      "value": "string",
      "whyItMatters": "string",
      "suggestion": "string"
    }
  ],
  "candidateResearchSignal": {
    "score": 0,
    "comment": "string"
  },
  "roleMotivationSignal": {
    "score": 0,
    "comment": "string"
  },
  "suggestedRewrite": "string",
  "fallbackReason": "string"
}

Rules:
- Use exact candidate quotes only.
- Do not invent company values.
- If source is general_fallback, say this is general motivation feedback.
- Suggested rewrite must sound natural and interview-ready.
`;

    const { content } = await callDeepSeek(
      prompt,
      'You output valid JSON only. Stay grounded in the provided values and candidate transcript.',
      {
        usageMetadata: {
          stage: 'report_generated',
          operation: 'llm_chat',
          feature: 'company_motivation_fit',
        },
      }
    );
    const parsed = JSON.parse(extractJsonObject(content));
    return sanitizeGeneralFallbackResult(normalizeCompanyMotivationFit({ ...parsed, evidenceStrength }, fallback), fallback);
  } catch {
    return fallback;
  }
};
