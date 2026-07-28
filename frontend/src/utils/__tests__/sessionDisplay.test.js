import { describe, expect, it } from 'vitest';
import {
  buildHomepageStats,
  buildRecentActivity,
  buildSessionHistoryRows,
  dedupeSessionsById,
  parseStoredSessionDefaults,
  resolveSessionOpenPath,
  seniorityOptions,
} from '../sessionDisplay.js';

const buildSession = (overrides = {}) => ({
  id: 'session-1',
  createdAt: '2026-05-09T01:00:00.000Z',
  status: 'completed',
  displayTitle: 'Frontend Developer',
  targetRole: 'Frontend Developer',
  durationSeconds: 600,
  displayScore: 80,
  hasReport: true,
  ...overrides,
});

describe('sessionDisplay', () => {
  it('keeps the first occurrence when duplicated session ids are present', () => {
    const sessions = [
      buildSession({ id: 'session-1', displayTitle: 'Latest Frontend Developer' }),
      buildSession({ id: 'session-1', displayTitle: 'Duplicate Frontend Developer', displayScore: 20 }),
      buildSession({ id: 'session-2', displayTitle: 'Backend Developer', displayScore: 90 }),
    ];

    expect(dedupeSessionsById(sessions).map((item) => item.displayTitle)).toEqual([
      'Latest Frontend Developer',
      'Backend Developer',
    ]);
  });

  it('builds session history rows without duplicate ids', () => {
    const rows = buildSessionHistoryRows([
      buildSession({ id: 'session-1', displayTitle: 'Frontend Developer' }),
      buildSession({ id: 'session-1', displayTitle: 'Frontend Developer Duplicate' }),
      buildSession({ id: 'session-2', status: 'in_progress', displayTitle: 'Data Engineer' }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((item) => item.id)).toEqual(['session-1', 'session-2']);
    expect(rows[0]).toMatchObject({
      displayTitle: 'Frontend Developer',
      displayStatus: 'Completed',
      scoreLabel: 80,
    });
  });

  it('uses deduped sessions for homepage stats and recent activity', () => {
    const sessions = [
      buildSession({ id: 'session-1', displayScore: 80 }),
      buildSession({ id: 'session-1', displayScore: 10 }),
      buildSession({ id: 'session-2', displayScore: 100, displayTitle: 'Backend Developer' }),
    ];

    const stats = buildHomepageStats(sessions);
    const recentActivity = buildRecentActivity(sessions);

    expect(stats.totalSessionsLabel).toBe('2');
    expect(stats.averageScoreLabel).toBe('90');
    expect(recentActivity.map((item) => item.id)).toEqual(['session-1', 'session-2']);
  });

  it('routes ready sessions back to analysis before the interview starts', () => {
    expect(resolveSessionOpenPath(buildSession({ status: 'ready', hasReport: false }))).toBe('/analysis?sessionId=session-1');
    expect(resolveSessionOpenPath(buildSession({ status: 'in_progress', hasReport: false }))).toBe('/interview/session-1');
    expect(resolveSessionOpenPath(buildSession({ status: 'completed', hasReport: true }))).toBe('/report/session-1');
  });

  it('upgrades legacy Advanced defaults to the displayed Senior level', () => {
    expect(seniorityOptions).toContain('Senior');
    expect(parseStoredSessionDefaults(JSON.stringify({ seniorityLevel: 'Advanced' }))).toMatchObject({
      seniorityLevel: 'Senior',
    });
  });
});
