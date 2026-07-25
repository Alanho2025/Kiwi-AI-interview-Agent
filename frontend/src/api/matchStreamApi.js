/**
 * File responsibility: Parse and execute the canonical Match SSE transport.
 */

import { apiClientStream } from './client.js';

const parseFrame = (frame) => {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data) return null;

  const event = JSON.parse(data);
  if (event?.schemaVersion !== 'match_stream_event_v1' || !event.type) {
    throw new Error('Received an unsupported Match stream event.');
  }
  return event;
};

export const parseMatchSseFrames = (input = '') => {
  const normalized = String(input || '').replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const remainder = normalized.endsWith('\n\n') ? '' : frames.pop() || '';
  const events = frames.map(parseFrame).filter(Boolean);
  return { events, remainder };
};

const buildMatchStreamError = (data = {}) => {
  const error = new Error(data.message || 'Match analysis could not finish.');
  error.code = data.code || 'MATCH_FAILED';
  error.retryable = Boolean(data.retryable);
  error.failedStage = data.failedStage || null;
  error.repairTarget = data.repairTarget || null;
  return error;
};

export const consumeMatchEventStream = async (body, { onEvent = () => {} } = {}) => {
  if (!body?.getReader) {
    throw new Error('Match progress stream is unavailable.');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminalResult;
  let terminalError;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const parsed = parseMatchSseFrames(buffer);
    buffer = parsed.remainder;

    for (const event of parsed.events) {
      onEvent(event);
      if (event.type === 'match_completed') {
        terminalResult = event.data?.result || null;
      } else if (event.type === 'match_failed') {
        terminalError = buildMatchStreamError(event.data);
      }
    }

    if (terminalError) throw terminalError;
    if (terminalResult) return terminalResult;
    if (done) break;
  }

  throw new Error('Match progress stream closed before completion.');
};

const createRequestId = () => globalThis.crypto?.randomUUID?.()
  || `match-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const streamMatchCV = async ({
  cvId,
  rawJD,
  jdRubric,
  settings,
  requestId = createRequestId(),
  onEvent,
  signal,
}) => {
  const response = await apiClientStream('/analyze/match/stream', {
    method: 'POST',
    body: { cvId, rawJD, jdRubric, settings },
    headers: {
      Accept: 'text/event-stream',
      'X-Match-Request-Id': requestId,
    },
    signal,
  });

  return consumeMatchEventStream(response.body, { onEvent });
};
