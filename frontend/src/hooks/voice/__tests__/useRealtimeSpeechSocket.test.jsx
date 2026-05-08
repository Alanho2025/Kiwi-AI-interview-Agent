import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSocketUrl, useRealtimeSpeechSocket } from '../useRealtimeSpeechSocket.js';

class MockWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.binaryType = '';
    this.send = vi.fn();
    this.close = vi.fn(() => {
      this.readyState = 3;
      this.onclose?.();
    });
    MockWebSocket.instances.push(this);
  }
}

describe('buildSocketUrl', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', 'http://localhost:5173/interview/session-1');
  });

  it('builds a websocket URL from the relative API base without exposing auth tokens', () => {
    window.localStorage.setItem('authToken', 'token-123');

    const url = buildSocketUrl({ sessionId: 'abc 123', language: 'en-NZ', sampleRate: 16000 });

    expect(url).toBe('ws://localhost:5173/api/interview/abc%20123/voice/live?language=en-NZ&sampleRate=16000');
  });
});

describe('useRealtimeSpeechSocket', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    MockWebSocket.instances = [];
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  it('rejects connection when sessionId is missing', async () => {
    const { result } = renderHook(() => useRealtimeSpeechSocket());

    await expect(result.current.connect({ sessionId: '' })).rejects.toThrow('Missing session ID');

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('updates state for ready, partial, final, error, and stopped events', async () => {
    const { result } = renderHook(() => useRealtimeSpeechSocket());

    const connectPromise = result.current.connect({ sessionId: 'session-1' });
    const socket = MockWebSocket.instances[0];

    await act(async () => {
      socket.onopen();
      await connectPromise;
    });

    expect(result.current.socketState).toBe('open');

    act(() => {
      socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
    });
    expect(result.current.socketState).toBe('ready');

    act(() => {
      socket.onmessage({ data: JSON.stringify({ type: 'partial_transcript', text: 'hello there' }) });
    });
    expect(result.current.partialTranscript).toBe('hello there');

    act(() => {
      socket.onmessage({ data: JSON.stringify({ type: 'final_transcript', displayText: 'final answer', confidence: 0.92 }) });
    });
    expect(result.current.finalTranscript.displayText).toBe('final answer');
    expect(result.current.partialTranscript).toBe('');

    act(() => {
      socket.onmessage({ data: JSON.stringify({ type: 'speech_error', reason: 'network dropped' }) });
    });
    expect(result.current.socketState).toBe('error');
    expect(result.current.socketError).toBe('network dropped');

    act(() => {
      socket.onmessage({ data: JSON.stringify({ type: 'stopped' }) });
    });
    expect(result.current.socketState).toBe('stopped');
  });

  it('sends binary audio and stop messages only when the socket is open', async () => {
    const { result } = renderHook(() => useRealtimeSpeechSocket());
    const connectPromise = result.current.connect({ sessionId: 'session-1' });
    const socket = MockWebSocket.instances[0];

    await act(async () => {
      socket.onopen();
      await connectPromise;
    });

    const chunk = new ArrayBuffer(8);
    act(() => {
      result.current.sendAudioChunk(chunk);
      result.current.sendStop();
    });

    expect(socket.send).toHaveBeenCalledWith(chunk);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'stop' }));

    socket.readyState = 3;
    act(() => {
      result.current.sendAudioChunk(new ArrayBuffer(2));
      result.current.sendStop();
    });

    expect(socket.send).toHaveBeenCalledTimes(2);
  });
});
