/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: reportViewBuilder should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

export {
  formatNumber,
  titleCase,
  extractFocusAreas,
  getScoreBand,
  buildTakeaway,
  buildDataInsights,
  buildFallbackImprovementPriorities,
  buildFallbackCoachingAdvice,
  buildFallbackAnswerRewriteTips,
  buildFallbackStrengthHighlights,
  buildReportViewModel,
} from './reportView/index.js';
