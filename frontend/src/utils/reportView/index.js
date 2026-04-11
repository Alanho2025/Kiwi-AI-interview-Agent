/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: index should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

export { formatNumber, titleCase, extractFocusAreas, getScoreBand } from './shared.js';
export { buildTakeaway, buildDataInsights } from './insights.js';
export {
  buildFallbackImprovementPriorities,
  buildFallbackCoachingAdvice,
  buildFallbackAnswerRewriteTips,
  buildFallbackStrengthHighlights,
} from './coaching.js';
export { buildReportViewModel } from './viewModel.js';
