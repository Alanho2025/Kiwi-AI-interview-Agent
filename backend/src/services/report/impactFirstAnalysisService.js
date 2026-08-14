import { callDeepSeek } from '../deepseekService.js';

const SYSTEM_PROMPT = `You are an expert interviewer evaluating a candidate's past experience answer.
You must assess the answer against 6 specific dimensions using a 1 to 5 level scale.

Dimensions and 5-Level Anchors:
1. Outcome (outcome):
- Level 1: No usable outcome.
- Level 2: Generic positive claim only.
- Level 3: Specific result, but quantitative/comparison evidence or attribution is incomplete.
- Level 4: Clear quantitative result OR explicit comparison, linked to the candidate's contribution.
- Level 5: Level 4 plus a clear baseline, target, or alternative and why the impact mattered; attribution is explicit.

2. Problem Solving (problem_solving):
- Level 1: No identifiable problem or decision.
- Level 2: Context is given, but the actual challenge is vague.
- Level 3: Concrete challenge and action, with limited reasoning.
- Level 4: Problem plus a relevant constraint/cause and why the chosen response made sense.
- Level 5: Problem is decomposed; alternatives, trade-offs, risk, or validation are used when relevant; reasoning connects to the outcome.

3. Personal Role (personal_role):
- Level 1: Only team activity or no role evidence.
- Level 2: Title/responsibility is named, but personal work is unclear.
- Level 3: Some personal action is stated, but ownership boundaries or decision authority remain unclear.
- Level 4: Personal ownership, actions, and decision boundary are explicit.
- Level 5: Level 4 plus clear accountability, coordination/influence, and causal contribution without overstating team work.

4. Approaches/Actions/Decisions (approaches):
- Level 1: None, or tool names only.
- Level 2: One vague move or an unreasoned list.
- Level 3: One substantive move, or two thin moves, with partial connection to the problem.
- Level 4: Two distinct substantive moves; both are relevant and at least one has clear rationale.
- Level 5: Two or three distinct substantive moves form a coherent response; rationale and relevant trade-off/verification are explicit.

5. Learning (learning):
- Level 1: No learning.
- Level 2: Generic cliché with no example-specific insight.
- Level 3: Specific lesson, but no future transfer or behaviour change.
- Level 4: Specific lesson plus a concrete change for future work.
- Level 5: Level 4 plus evidence the lesson was already transferred, or a reusable principle with a clear boundary.

6. Outcome-first Placement (outcome_placement):
- Level 1: No outcome, or it appears only in the closing sentence.
- Level 2: Outcome first appears in the final third.
- Level 3: Outcome first appears in the middle third.
- Level 4: Outcome appears in the opening segment, but only after setup or in vague form.
- Level 5: A clear outcome/comparison appears in the first one or two sentences.

Return strictly JSON matching this schema:
{
  "dimensions": [
    {
      "key": "outcome",
      "level": 1,
      "reason": "Brief explanation of why this level was awarded based on the candidate's answer."
    }
  ]
}
Do not return any markdown formatting, only the JSON object.`;

const DIMENSION_WEIGHTS = {
  outcome: 20,
  problem_solving: 15,
  personal_role: 15,
  approaches: 20,
  learning: 10,
  outcome_placement: 10,
};

const DIMENSION_LABELS = {
  outcome: 'Outcome evidence',
  problem_solving: 'Problem solving',
  personal_role: 'Personal role',
  approaches: 'Approaches / actions / decisions',
  learning: 'Learning',
  outcome_placement: 'Outcome-first placement',
};

const extractJsonObject = (text = '') => {
  const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = String(text || '').indexOf('{');
  const end = String(text || '').lastIndexOf('}');
  if (start >= 0 && end > start) return String(text).slice(start, end + 1);
  return String(text || '').trim();
};

export const analyzeImpactFirstAnswer = async ({ question = '', answer = '', context = {} } = {}) => {
  const userPrompt = `Question: ${question}\nCandidate Answer: ${answer}`;
  
  let parsed;
  try {
    const response = await callDeepSeek(userPrompt, SYSTEM_PROMPT, {
      usageMetadata: { stage: 'evaluation', operation: 'llm_json', feature: 'impact_first_scoring' },
    });
    parsed = JSON.parse(extractJsonObject(response.content));
  } catch (error) {
    console.error('ImpactFirst LLM Error:', error);
    parsed = { dimensions: [] };
  }

  const dimensions = Object.keys(DIMENSION_WEIGHTS).map((key) => {
    const evaluated = (parsed?.dimensions || []).find((d) => d.key === key) || {};
    const level = Number(evaluated.level) || 1;
    const safeLevel = Math.max(1, Math.min(5, level));
    const scorePercentage = (safeLevel - 1) * 25; // 1->0%, 2->25%, 3->50%, 4->75%, 5->100%
    const weight = DIMENSION_WEIGHTS[key];
    const score = (scorePercentage / 100) * weight;

    return {
      key,
      label: DIMENSION_LABELS[key],
      status: safeLevel >= 4 ? 'clear' : safeLevel >= 2 ? 'partial' : 'missing',
      score,
      level: safeLevel,
      weight,
      reason: evaluated.reason || 'Evaluation failed. Defaulting to missing evidence.',
    };
  });

  const totalContentScore = dimensions.reduce((sum, d) => sum + d.score, 0); // Max 90
  const normalizedScore = Number(((totalContentScore / 90) * 10).toFixed(2));

  const sortedGaps = [...dimensions].sort((a, b) => a.level - b.level);
  const mainGap = sortedGaps[0];

  return {
    dimensions,
    mainGapKey: mainGap.key,
    mainMissingElement: mainGap.key,
    summary: 'This evaluates past example evidence using the Impact-first framework.',
    scoreReason: mainGap.reason,
    totalContentScore,
    normalizedScore,
  };
};
