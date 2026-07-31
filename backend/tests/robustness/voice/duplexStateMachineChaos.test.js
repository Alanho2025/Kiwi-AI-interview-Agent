import { describe, expect, it, vi } from 'vitest';
import { createSocketMessageQueue } from '../../../src/api/duplexVoiceSocket.js';

describe('1. duplexStateMachineChaos: WebSocket state machine & chaos tests', () => {
  it('buffers incoming messages while session initialization is pending and processes sequentially after ready', async () => {
    let resolveReady;
    const duplexSessionReady = new Promise((resolve) => { resolveReady = resolve; });
    const processed = [];

    const duplexSessionMock = {
      handleJsonMessage: vi.fn(async (payload) => {
        processed.push(payload.type);
      }),
    };

    const mockSocket = {
      listeners: {},
      on(event, handler) { this.listeners[event] = handler; },
      emit(event, ...args) { this.listeners[event]?.(...args); },
    };

    const queue = createSocketMessageQueue({
      socket: mockSocket,
      context: { sessionId: 's-1' },
      duplexSessionRef: { current: null },
      duplexSessionReady,
      safeSend: vi.fn(),
    });

    // Emit messages before session is ready
    mockSocket.emit('message', JSON.stringify({ type: 'session_start' }), false);
    mockSocket.emit('message', JSON.stringify({ type: 'ping' }), false);

    expect(processed).toEqual([]);

    // Settle session ready
    resolveReady(duplexSessionMock);
    await queue.drain();

    expect(processed).toEqual(['session_start', 'ping']);
  });

  it('immediately routes barge_in interrupt control payloads even while normal queue is delayed', async () => {
    let resolveReady;
    const duplexSessionReady = new Promise((resolve) => { resolveReady = resolve; });
    const processed = [];

    const duplexSessionMock = {
      handleJsonMessage: vi.fn(async (payload) => {
        processed.push(payload.type);
      }),
    };

    const mockSocket = {
      listeners: {},
      on(event, handler) { this.listeners[event] = handler; },
      emit(event, ...args) { this.listeners[event]?.(...args); },
    };

    createSocketMessageQueue({
      socket: mockSocket,
      context: { sessionId: 's-1' },
      duplexSessionRef: { current: null },
      duplexSessionReady,
      safeSend: vi.fn(),
    });

    // Send interrupt payload
    mockSocket.emit('message', JSON.stringify({ type: 'barge_in' }), false);

    // Resolve session ready
    resolveReady(duplexSessionMock);
    await new Promise((r) => setTimeout(r, 20));

    expect(processed).toContain('barge_in');
  });
});
