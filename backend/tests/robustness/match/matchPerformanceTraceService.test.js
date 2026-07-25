import { describe, expect, it } from 'vitest';

import {
  createMatchPerformanceTrace,
  markMatchStep,
  measureMatchStep,
} from '../../../src/services/match/matchPerformanceTraceService.js';

describe('match performance trace service', () => {
  it('records sanitized match timing steps without raw document payloads', async () => {
    const trace = createMatchPerformanceTrace({
      requestId: 'request-1',
      cvId: 'cv-1',
      matchEngine: 'semantic',
      rawJD: undefined,
      nested: { keep: true, drop: null },
    });

    const result = await measureMatchStep(trace, 'match_cache_read', async () => ({ ok: true }), {
      cacheEligible: true,
      rawJD: undefined,
    });
    markMatchStep(trace, 'match_cache_miss', { cacheEligible: true });

    const snapshot = trace.toJSON({ matchAnalysisId: 'match-1' });

    expect(result).toEqual({ ok: true });
    expect(snapshot).toEqual(expect.objectContaining({
      schemaVersion: 'match_performance_trace_v1',
      requestId: 'request-1',
      cvId: 'cv-1',
      matchEngine: 'semantic',
      matchAnalysisId: 'match-1',
      totalMs: expect.any(Number),
      nested: { keep: true },
    }));
    expect(snapshot).not.toHaveProperty('rawJD');
    expect(snapshot.steps.map((step) => step.step)).toEqual(['match_cache_read', 'match_cache_miss']);
    expect(snapshot.steps[0]).toEqual(expect.objectContaining({
      durationMs: expect.any(Number),
      msFromStart: expect.any(Number),
      ok: true,
      cacheEligible: true,
    }));
    expect(snapshot.stepSummary.match_cache_read).toEqual(expect.objectContaining({
      count: 1,
      okCount: 1,
      failedCount: 0,
      totalDurationMs: expect.any(Number),
      maxDurationMs: expect.any(Number),
    }));
    expect(snapshot.slowestSteps[0]).toEqual(expect.objectContaining({
      step: 'match_cache_read',
      durationMs: expect.any(Number),
      ok: true,
    }));
  });

  it('records failed measured steps and rethrows the original error', async () => {
    const trace = createMatchPerformanceTrace();

    await expect(measureMatchStep(trace, 'match_critic_first_review', async () => {
      throw new Error('critic unavailable');
    })).rejects.toThrow('critic unavailable');

    const snapshot = trace.toJSON();
    expect(snapshot.steps[0]).toEqual(expect.objectContaining({
      step: 'match_critic_first_review',
      ok: false,
      error: 'critic unavailable',
      durationMs: expect.any(Number),
    }));
    expect(snapshot.stepSummary.match_critic_first_review).toEqual(expect.objectContaining({
      count: 1,
      okCount: 0,
      failedCount: 1,
    }));
  });

  it('aggregates repeated steps and ranks measured steps by duration', async () => {
    const trace = createMatchPerformanceTrace();

    await measureMatchStep(trace, 'match_compare_first', async () => 'first');
    await measureMatchStep(trace, 'match_compare_first', async () => 'second');
    markMatchStep(trace, 'match_cache_miss', { cacheEligible: true });

    const snapshot = trace.toJSON();

    expect(snapshot.steps.map((step) => step.step)).toEqual([
      'match_compare_first',
      'match_compare_first',
      'match_cache_miss',
    ]);
    expect(snapshot.stepSummary.match_compare_first).toEqual(expect.objectContaining({
      count: 2,
      okCount: 2,
      failedCount: 0,
      totalDurationMs: expect.any(Number),
      maxDurationMs: expect.any(Number),
    }));
    expect(snapshot.stepSummary.match_cache_miss).toEqual(expect.objectContaining({
      count: 1,
      totalDurationMs: 0,
    }));
    expect(snapshot.slowestSteps.every((step) => Number.isFinite(step.durationMs))).toBe(true);
  });

  it('notifies an allowlisted observer when a measured step starts and completes', async () => {
    const events = [];
    const trace = createMatchPerformanceTrace(
      { requestId: 'request-stream-1' },
      { onStep: (event) => events.push(event) },
    );

    await measureMatchStep(trace, 'match_compare_first', async () => 'result', {
      rawJD: undefined,
      requirementCount: 3,
    });

    expect(events).toEqual([
      expect.objectContaining({
        phase: 'started',
        step: 'match_compare_first',
        metadata: { requirementCount: 3 },
      }),
      expect.objectContaining({
        phase: 'completed',
        step: 'match_compare_first',
        ok: true,
        metadata: { requirementCount: 3 },
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain('rawJD');
  });

  it('notifies the observer of failed steps without swallowing the error', async () => {
    const events = [];
    const trace = createMatchPerformanceTrace({}, {
      onStep: (event) => events.push(event),
    });

    await expect(trace.measure('match_critic_first_review', async () => {
      throw new Error('private provider detail');
    })).rejects.toThrow('private provider detail');

    expect(events).toEqual([
      expect.objectContaining({ phase: 'started', step: 'match_critic_first_review' }),
      expect.objectContaining({
        phase: 'completed',
        step: 'match_critic_first_review',
        ok: false,
      }),
    ]);
    expect(events[1].metadata).not.toHaveProperty('error');
  });
});
