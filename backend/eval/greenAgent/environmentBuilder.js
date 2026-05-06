/**
 * File responsibility: Build deterministic evaluation environments for Kiwi green-agent scenarios.
 * Main responsibilities:
 * - Normalize scenario inputs into the shape expected by scenario runners and judges.
 * - Keep benchmark tasks realistic without touching production data or external services.
 * - Make every scenario self-contained for repeatable static evaluation.
 */

const normalizeCategory = (value = '') => String(value || '').toLowerCase().replace('behavioral', 'behavioural');

export const buildScenarioEnvironment = (scenario = {}) => {
  const transcript = Array.isArray(scenario.transcript) ? scenario.transcript : [];
  const aiTurns = transcript.filter((turn) => turn.role === 'ai');
  const userTurns = transcript.filter((turn) => turn.role === 'user');
  return {
    id: scenario.id,
    settings: scenario.settings || {},
    cvProfile: scenario.cvProfile || {},
    jdProfile: scenario.jdProfile || {},
    transcript,
    aiTurns,
    userTurns,
    categories: aiTurns.map((turn) => normalizeCategory(turn.metadata?.category)).filter(Boolean),
    topics: aiTurns.map((turn) => String(turn.metadata?.topic || '').toLowerCase()).filter(Boolean),
    questions: aiTurns.map((turn) => turn.text || ''),
    report: scenario.report || {},
    expected: scenario.expected || {},
  };
};
