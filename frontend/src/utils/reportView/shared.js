/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: shared should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

/**
 * Purpose: Execute the main responsibility for formatNumber.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const formatNumber = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-');

export const titleCase = (value = '') => String(value)
  .split('_')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

/**
 * Purpose: Execute the main responsibility for extractFocusAreas.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const extractFocusAreas = (sections = []) => {
  const observation = sections.find((section) => section.id === 'interview_observations');
  const match = String(observation?.content || '').match(/Focus areas:\s*(.+?)\.$/i);
  if (!match?.[1]) return [];
  return match[1].split(',').map((item) => item.trim()).filter(Boolean);
};

export const getReportTurnBreakdowns = (report = {}) => report.candidateFeedback?.turnBreakdowns || [];

export const hasReasoningOnlyTurns = (report = {}) => {
  const turns = getReportTurnBreakdowns(report);
  const reasoningModes = new Set(['scenario_reasoning', 'knowledge_explanation', 'credential_verification']);
  return turns.length > 0 && turns.every((turn) => reasoningModes.has(turn.evidenceMode));
};

export const buildTurnRewriteScaffold = (turn = {}) => {
  const topic = String(turn.questionTopic || turn.question || 'the role requirement').trim();
  if (turn.frameworkKey === 'behavioural_starr' || turn.rubricType === 'starr') {
    return `Topic: ${topic}. Situation: [補充情境] Task: [說明你的責任] Action: [說明個人行動] Result/Reaction: [補充實際結果] Reflection: [補充反思]`;
  }
  if (turn.evidenceMode === 'credential_verification') {
    return `Topic: ${topic}. Evidence: [補充資格證明] Validity: [說明有效期限] Scope: [說明適用範圍] Conditions: [補充限制或條件] Verification: [說明驗證方式]`;
  }
  if (turn.evidenceMode === 'knowledge_explanation') {
    return `Topic: ${topic}. Principle: [說明核心原則] Application: [說明如何應用] Assumptions/Limits: [補充假設或限制] Risk: [說明風險、品質或倫理考量] Verification: [說明驗證方式]`;
  }
  if (turn.evidenceMode === 'scenario_reasoning') {
    return `Topic: ${topic}. Requirements: [釐清需求] Options: [列出可行選項] Reasoning: [說明專業判斷與取捨] Risk: [說明風險、品質或倫理考量] Validation: [說明驗證方式] Expected outcome: [補充預期成果]`;
  }
  return `Topic: ${topic}. Context/Goal: [補充情境與目標] Approach: [說明採取的方法] Judgement/Trade-offs: [說明專業判斷與取捨] Risk/Quality/Ethics: [說明風險、品質或倫理考量] Validation/Verification: [說明驗證方式] Outcome/Value: [補充實際結果]`;
};

/**
 * Purpose: Execute the main responsibility for getScoreBand.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getScoreBand = (overallScore) => {
  if (overallScore >= 80) return 'Strong match';
  if (overallScore >= 65) return 'Promising match';
  if (overallScore >= 45) return 'Developing match';
  return 'Needs stronger evidence';
};
