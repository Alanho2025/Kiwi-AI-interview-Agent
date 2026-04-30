/**
 * File responsibility: Shared voice latency metric helpers.
 * Main responsibilities:
 * - Keep duration math deterministic for client/server latency summaries.
 * - Prevent cross-turn audio playback calculations from using stale markers.
 */

const toMs = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const findMark = (events = [], stepName, turnId = null) => events.find((event) => {
  if (event?.step !== stepName && event?.name !== stepName) return false;
  if (turnId == null) return true;
  return event.turnId === turnId;
}) || null;

export const computeDurationBetweenMarks = ({ events = [], startStep, endStep, turnId = null } = {}) => {
  const start = findMark(events, startStep, turnId);
  const end = findMark(events, endStep, turnId);
  const startMs = toMs(start?.msFromStart ?? start?.atMs);
  const endMs = toMs(end?.msFromStart ?? end?.atMs);

  if (startMs == null || endMs == null || endMs < startMs) return null;
  return Math.round(endMs - startMs);
};
