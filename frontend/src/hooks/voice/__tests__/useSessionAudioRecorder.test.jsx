import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionAudioRecorder } from '../useSessionAudioRecorder.js';

let recorderInstance;

class FakeMediaRecorder {
  static isTypeSupported = () => true;

  constructor(_stream, options = {}) {
    this.mimeType = options.mimeType || 'audio/webm';
    this.state = 'inactive';
    recorderInstance = this;
  }

  start = vi.fn((timeslice) => {
    this.state = 'recording';
    this.timeslice = timeslice;
  });

  stop = vi.fn(() => {
    this.state = 'inactive';
    queueMicrotask(() => this.onstop?.());
  });

  emit(blob) {
    this.ondataavailable?.({ data: blob });
  }
}

const createManager = () => ({
  enqueueChunk: vi.fn().mockResolvedValue(undefined),
  finalizeLocalCapture: vi.fn().mockResolvedValue({ state: 'locally_durable' }),
  getSnapshot: vi.fn(() => ({ state: 'recording' })),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  subscribe: vi.fn((listener) => { listener({ state: 'recording' }); return vi.fn(); }),
});

describe('useSessionAudioRecorder', () => {
  beforeEach(() => {
    recorderInstance = null;
    global.MediaRecorder = FakeMediaRecorder;
  });

  it('uses one continuous recorder and durably enqueues ordered chunks', async () => {
    const manager = createManager();
    const uploadRegistry = { getOrCreate: vi.fn(() => manager) };
    const { result } = renderHook(() => useSessionAudioRecorder({ sessionId: 'session-1', uploadRegistry }));

    act(() => result.current.startRecording({ id: 'stream-1' }));
    await act(async () => {
      recorderInstance.emit(new Blob(['A'], { type: 'audio/webm' }));
      recorderInstance.emit(new Blob(['B'], { type: 'audio/webm' }));
      await Promise.resolve();
    });

    expect(recorderInstance.start).toHaveBeenCalledTimes(1);
    expect(recorderInstance.start).toHaveBeenCalledWith(4000);
    expect(manager.enqueueChunk).toHaveBeenNthCalledWith(1, expect.objectContaining({ sequence: 0 }));
    expect(manager.enqueueChunk).toHaveBeenNthCalledWith(2, expect.objectContaining({ sequence: 1 }));
  });

  it('shares one finalization and resolves after the final local chunk commit', async () => {
    const manager = createManager();
    const uploadRegistry = { getOrCreate: vi.fn(() => manager) };
    const { result } = renderHook(() => useSessionAudioRecorder({ sessionId: 'session-1', uploadRegistry }));
    act(() => result.current.startRecording({ id: 'stream-1' }));
    act(() => recorderInstance.emit(new Blob(['A'], { type: 'audio/webm' })));

    const first = result.current.finalizeLocalRecording();
    const second = result.current.finalizeLocalRecording();

    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ state: 'locally_durable' });
    expect(manager.finalizeLocalCapture).toHaveBeenCalledWith(expect.objectContaining({ totalChunks: 1 }));
  });

  it('forwards voice priority state and resumes the background uploader', async () => {
    const manager = createManager();
    const uploadRegistry = {
      getOrCreate: vi.fn(() => manager),
      setVoicePriorityState: vi.fn(),
    };
    const { result } = renderHook(() => useSessionAudioRecorder({ sessionId: 'session-1', uploadRegistry }));

    result.current.setVoicePriorityState('user_speaking');
    await result.current.resumeUpload();

    expect(uploadRegistry.setVoicePriorityState).toHaveBeenCalledWith('session-1', 'user_speaking');
    expect(manager.start).toHaveBeenCalled();
  });
});
