import { describe, expect, it, vi } from 'vitest';

import {
  createMatchStreamReporter,
  createMatchSseWriter,
} from '../../../src/services/match/matchStreamEventService.js';

describe('match stream event service', () => {
  it('emits ordered candidate-safe progress and one canonical completion', () => {
    const events = [];
    const reporter = createMatchStreamReporter({
      requestId: 'request-1',
      now: () => '2026-07-26T00:00:00.000Z',
      writeEvent: (event) => events.push(event),
    });

    reporter.start();
    reporter.stageStarted('input_validation');
    reporter.stageCompleted('input_validation');
    reporter.observeTraceStep({
      phase: 'started',
      step: 'role_fit_review_gate',
      metadata: { rawJD: 'private job text' },
    });
    reporter.observeTraceStep({ phase: 'completed', step: 'role_fit_review_gate', ok: true });
    reporter.observeTraceStep({ phase: 'started', step: 'match_compare_first' });
    reporter.observeTraceStep({ phase: 'started', step: 'match_critic_first_review' });
    reporter.observeTraceStep({ phase: 'completed', step: 'match_critic_first_review', ok: true });
    reporter.observeTraceStep({ phase: 'started', step: 'match_record_persist' });
    reporter.observeTraceStep({ phase: 'started', step: 'jd_question_filter_build' });
    reporter.complete({ matchAnalysisId: 'match-1', result: { matchScore: 78 } });

    expect(events[0]).toMatchObject({
      type: 'match_started',
      requestId: 'request-1',
      sequence: 1,
    });
    expect(events.at(-1)).toMatchObject({
      type: 'match_completed',
      requestId: 'request-1',
      data: {
        matchAnalysisId: 'match-1',
        result: { matchScore: 78 },
      },
    });
    expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index + 1));
    expect(events.filter((event) => event.type === 'match_completed')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'match_failed')).toHaveLength(0);
    expect(events.filter((event) => event.type === 'stage_progress').map((event) => event.stage.id))
      .toEqual(expect.arrayContaining([
        'input_validation',
        'role_fit_gate',
        'evidence_match',
        'quality_review',
        'persistence',
        'question_filter',
      ]));
    expect(JSON.stringify(events)).not.toContain('private job text');
    expect(JSON.stringify(events)).not.toContain('rawJD');
  });

  it('does not move backwards when later trace callbacks finish', () => {
    const events = [];
    const reporter = createMatchStreamReporter({
      requestId: 'request-2',
      writeEvent: (event) => events.push(event),
    });

    reporter.start();
    reporter.observeTraceStep({ phase: 'started', step: 'match_compare_first' });
    reporter.observeTraceStep({ phase: 'started', step: 'match_critic_first_review' });
    reporter.observeTraceStep({ phase: 'completed', step: 'match_compare_first', ok: true });

    const progressStages = events
      .filter((event) => event.type === 'stage_progress')
      .map((event) => event.stage.id);
    const lastEvidenceIndex = progressStages.lastIndexOf('evidence_match');
    const qualityIndex = progressStages.indexOf('quality_review');

    expect(lastEvidenceIndex).toBeLessThan(qualityIndex);
  });

  it('emits one safe failure without leaking an internal error', () => {
    const events = [];
    const reporter = createMatchStreamReporter({
      requestId: 'request-3',
      writeEvent: (event) => events.push(event),
    });

    reporter.start();
    reporter.stageStarted('persistence');
    reporter.fail({
      code: 'PERSISTENCE_FAILED',
      message: 'We could not save the Match result. Try again.',
      retryable: true,
      failedStage: 'persistence',
      internalError: 'mongodb://private-host secret',
    });
    reporter.fail({ code: 'MATCH_FAILED', message: 'duplicate failure' });

    expect(events.filter((event) => event.type === 'match_failed')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: 'match_failed',
      data: {
        code: 'PERSISTENCE_FAILED',
        message: 'We could not save the Match result. Try again.',
        retryable: true,
        failedStage: 'persistence',
      },
    });
    expect(JSON.stringify(events)).not.toContain('private-host');
  });

  it('writes SSE frames without serializing response internals', () => {
    const response = {
      write: vi.fn(),
    };
    const writeEvent = createMatchSseWriter(response);

    writeEvent({
      type: 'match_started',
      requestId: 'request-4',
      sequence: 1,
      occurredAt: '2026-07-26T00:00:00.000Z',
      stage: null,
      data: null,
    });

    expect(response.write).toHaveBeenCalledWith(expect.stringMatching(
      /^event: match_started\ndata: \{"schemaVersion":"match_stream_event_v1"/,
    ));
    expect(response.write.mock.calls[0][0]).toMatch(/\n\n$/);
  });
});
