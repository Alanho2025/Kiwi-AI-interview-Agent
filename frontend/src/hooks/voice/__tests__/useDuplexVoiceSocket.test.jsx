import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDuplexVoiceSocket } from '../useDuplexVoiceSocket.js';

class MockWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.send = vi.fn();
    this.close = vi.fn();
    MockWebSocket.instances.push(this);
  }
}

describe('useDuplexVoiceSocket', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    MockWebSocket.instances = [];
    window.localStorage.clear();
    window.history.pushState({}, '', 'http://localhost:5173/interview/session-1');
  });

  it('does not resolve connect until the backend confirms session_ready', async () => {
    const { result } = renderHook(() => useDuplexVoiceSocket());
    let resolved = false;
    const connectPromise = result.current.connect({ sessionId: 'session-1' })
      .then(() => { resolved = true; });
    const socket = MockWebSocket.instances[0];

    await act(async () => {
      socket.onopen();
      await Promise.resolve();
    });
    expect(resolved).toBe(false);
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('session_start'));

    await act(async () => {
      socket.onmessage({ data: JSON.stringify({ type: 'session_ready' }) });
      await connectPromise;
    });

    expect(resolved).toBe(true);
    expect(result.current.socketState).toBe('ready');
  });
});
