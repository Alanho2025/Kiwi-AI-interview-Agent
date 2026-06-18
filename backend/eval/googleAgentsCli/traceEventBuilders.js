/**
 * File responsibility: Shared Google Agents CLI trace event builders.
 * Main responsibilities:
 * - Keep hand-built EvaluationDataset event shapes consistent.
 * - Avoid duplicating function_call/function_response/text event plumbing.
 * - Keep evaluator-only metadata outside agent_data in caller modules.
 */

export const toTextPart = (text = '') => ({ text: String(text || '') });

export const ensureArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export const take = (items = [], limit = 8) => ensureArray(items).slice(0, limit);

export const truncate = (value = '', limit = 2200) => String(value || '').slice(0, limit);

export const textEvent = ({ author, text, role = null } = {}) => ({
  author,
  content: {
    role: role || (author === 'user' ? 'user' : 'model'),
    parts: [toTextPart(text)],
  },
});

export const toolCallEvent = ({ author, name, args = {} } = {}) => ({
  author,
  content: {
    role: 'model',
    parts: [{ function_call: { name, args } }],
  },
});

export const toolResponseEvent = ({ name, response = {}, author = 'tool' } = {}) => ({
  author,
  content: {
    role: 'function',
    parts: [{ function_response: { name, response } }],
  },
});

export const scoreChecks = (checks = []) => {
  const safeChecks = ensureArray(checks);
  const earned = safeChecks.filter((check) => check.passed).length;
  return {
    earned,
    possible: safeChecks.length,
    score: safeChecks.length ? Number((earned / safeChecks.length).toFixed(2)) : 1,
    failedChecks: safeChecks.filter((check) => !check.passed).map((check) => check.label),
    checks: safeChecks,
  };
};
