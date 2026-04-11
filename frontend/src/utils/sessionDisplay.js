/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: sessionDisplay should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Briefcase, Clock, FileText, Mic, Star } from 'lucide-react';

export const HOME_SESSION_DEFAULTS_KEY = 'kiwi-home-session-defaults';

export const DEFAULT_SESSION_SETTINGS = {
  seniorityLevel: 'Junior/Grad',
  enableNZCultureFit: false,
  focusArea: 'Combined',
};

export const seniorityOptions = ['Junior/Grad', 'Mid-level', 'Senior'];
export const focusOptions = ['Technical', 'Behavioral', 'Combined'];

/**
 * Purpose: Execute the main responsibility for formatFullDate.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const formatFullDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-NZ', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

/**
 * Purpose: Execute the main responsibility for formatShortDate.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const formatShortDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-NZ', {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Purpose: Execute the main responsibility for formatDurationLabel.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const formatDurationLabel = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  if (safeSeconds < 60) return '<1 min';
  const minutes = Math.round(safeSeconds / 60);
  return `${minutes} min`;
};

/**
 * Purpose: Execute the main responsibility for getHistoryIcon.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getHistoryIcon = (status = '', hasReport = false) => {
  if (hasReport) return FileText;
  if (status === 'completed') return Star;
  if (status === 'paused') return Clock;
  if (status === 'in_progress') return Mic;
  return Briefcase;
};

/**
 * Purpose: Execute the main responsibility for summarizeSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const summarizeSession = (session = {}) => {
  if (session.planPreview) return session.planPreview;
  if (session.scoreBand) return session.scoreBand;
  if (session.status === 'completed') return 'Interview completed';
  if (session.status === 'in_progress') return 'Interview in progress';
  return 'Interview session';
};

/**
 * Purpose: Execute the main responsibility for isPresentNumber.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const isPresentNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

export const resolveDisplayScore = (session = {}) => {
  if (isPresentNumber(session.displayScore)) return Number(session.displayScore);
  if (isPresentNumber(session.overallScore)) return Number(session.overallScore);
  if (isPresentNumber(session.matchScore)) return Number(session.matchScore);
  return null;
};

/**
 * Purpose: Execute the main responsibility for settingsSummary.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const settingsSummary = (settings = DEFAULT_SESSION_SETTINGS) => ({
  level: settings.seniorityLevel || 'Junior/Grad',
  focus: settings.focusArea || 'Combined',
  nzContext: settings.enableNZCultureFit ? 'On' : 'Off',
});

/**
 * Purpose: Execute the main responsibility for buildHomepageStats.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildHomepageStats = (sessionHistory = [], historyLoading = false) => {
  const completedSessions = sessionHistory.filter((item) => item.status === 'completed');
  const scoredSessions = sessionHistory
    .map((item) => resolveDisplayScore(item))
    .filter((value) => Number.isFinite(Number(value)));

  const averageScore = scoredSessions.length
    ? Math.round(scoredSessions.reduce((sum, value) => sum + Number(value || 0), 0) / scoredSessions.length)
    : '-';

  return {
    completedSessions,
    averageScore,
    latestRole: sessionHistory[0]?.displayTitle || sessionHistory[0]?.targetRole || 'No sessions yet',
    totalSessionsLabel: historyLoading ? '...' : String(sessionHistory.length),
    averageScoreLabel: historyLoading ? '...' : String(averageScore),
    latestRoleLabel: historyLoading ? '...' : (sessionHistory[0]?.displayTitle || sessionHistory[0]?.targetRole || 'No sessions yet'),
  };
};

/**
 * Purpose: Execute the main responsibility for buildRecentActivity.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildRecentActivity = (sessionHistory = []) => sessionHistory.slice(0, 3).map((item) => ({
  id: item.id,
  title: item.displayTitle || item.targetRole || 'Interview Session',
  date: formatShortDate(item.createdAt),
  duration: formatDurationLabel(item.durationSeconds),
  avgScore: Number.isFinite(Number(resolveDisplayScore(item))) ? Math.round(Number(resolveDisplayScore(item))) : '-',
  status: item.status === 'completed' ? 'Completed' : item.status === 'in_progress' ? 'In Progress' : item.status === 'paused' ? 'Paused' : 'Draft',
  icon: getHistoryIcon(item.status, item.hasReport),
}));

/**
 * Purpose: Execute the main responsibility for buildSessionHistoryRows.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildSessionHistoryRows = (sessionHistory = []) => sessionHistory.map((item) => {
  const displayStatus = item.status === 'completed'
    ? 'Completed'
    : item.status === 'in_progress'
      ? 'In Progress'
      : item.status === 'paused'
        ? 'Paused'
        : 'Draft';

  return {
    ...item,
    displayStatus,
    scoreLabel: Number.isFinite(Number(resolveDisplayScore(item))) ? Math.round(Number(resolveDisplayScore(item))) : '-',
    summary: summarizeSession(item),
    formattedDate: formatFullDate(item.createdAt),
    icon: getHistoryIcon(item.status, item.hasReport),
  };
});

/**
 * Purpose: Execute the main responsibility for getUserInitials.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getUserInitials = (name = '') => name
  .split(' ')
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

/**
 * Purpose: Execute the main responsibility for parseStoredSessionDefaults.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const parseStoredSessionDefaults = (rawDefaults) => {
  if (!rawDefaults) return DEFAULT_SESSION_SETTINGS;

  const parsedDefaults = JSON.parse(rawDefaults);
  return {
    seniorityLevel: parsedDefaults.seniorityLevel || DEFAULT_SESSION_SETTINGS.seniorityLevel,
    enableNZCultureFit: Boolean(parsedDefaults.enableNZCultureFit),
    focusArea: parsedDefaults.focusArea || DEFAULT_SESSION_SETTINGS.focusArea,
  };
};
