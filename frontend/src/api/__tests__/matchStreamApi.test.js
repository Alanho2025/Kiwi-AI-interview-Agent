import { describe, expect, it, vi } from 'vitest';

import {
  consumeMatchEventStream,
  parseMatchSseFrames,
} from '../matchStreamApi.js';

const encodeChunks = (chunks) => {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    getReader: () => ({
      read: vi.fn(async () => {
        if (index >= chunks.length) return { done: true, value: undefined };
        const value = encoder.encode(chunks[index]);
        index += 1;
        return { done: false, value };
      }),
    }),
  };
};

describe('Match stream API', () => {
  it('parses SSE frames split across network chunks', () => {
    const first = JSON.stringify({
      schemaVersion: 'match_stream_event_v1',
      type: 'match_started',
      sequence: 1,
    });
    const second = JSON.stringify({
      schemaVersion: 'match_stream_event_v1',
      type: 'stage_progress',
      sequence: 2,
      stage: { id: 'evidence_match', label: 'Matching your CV evidence', status: 'started' },
    });

    const parsed = parseMatchSseFrames(
      `event: match_started\ndata: ${first}\n\nevent: stage_progress\ndata: ${second}\n\n`,
    );

    expect(parsed.events).toEqual([
      expect.objectContaining({ type: 'match_started', sequence: 1 }),
      expect.objectContaining({
        type: 'stage_progress',
        stage: expect.objectContaining({ id: 'evidence_match' }),
      }),
    ]);
    expect(parsed.remainder).toBe('');
  });

  it('returns only the canonical terminal result and reports every event', async () => {
    const onEvent = vi.fn();
    const body = encodeChunks([
      'event: match_started\ndata: {"schemaVersion":"match_stream_event_v1","type":"match_started","sequence":1}\n\n',
      'event: stage_progress\ndata: {"schemaVersion":"match_stream_event_v1","type":"stage_progress","sequence":2,"stage":{"id":"evidence_match","label":"Matching your CV evidence","status":"started"}}\n',
      '\nevent: match_completed\ndata: {"schemaVersion":"match_stream_event_v1","type":"match_completed","sequence":3,"data":{"matchAnalysisId":"match-1","result":{"matchScore":78}}}\n\n',
    ]);

    const result = await consumeMatchEventStream(body, { onEvent });

    expect(result).toEqual({ matchScore: 78 });
    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'match_completed',
      data: expect.objectContaining({ matchAnalysisId: 'match-1' }),
    }));
  });

  it('throws a repair-targeted error from match_failed', async () => {
    const body = encodeChunks([
      'event: match_failed\ndata: {"schemaVersion":"match_stream_event_v1","type":"match_failed","sequence":1,"data":{"code":"CORRUPTED","message":"The CV appears corrupted.","retryable":false,"failedStage":"input_validation","repairTarget":"cv"}}\n\n',
    ]);

    await expect(consumeMatchEventStream(body)).rejects.toMatchObject({
      message: 'The CV appears corrupted.',
      code: 'CORRUPTED',
      retryable: false,
      repairTarget: 'cv',
    });
  });

  it('rejects a stream that closes without a terminal event', async () => {
    const body = encodeChunks([
      'event: match_started\ndata: {"schemaVersion":"match_stream_event_v1","type":"match_started","sequence":1}\n\n',
    ]);

    await expect(consumeMatchEventStream(body)).rejects.toThrow(/closed before completion/i);
  });
});
