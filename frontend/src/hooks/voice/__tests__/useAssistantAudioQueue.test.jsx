import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAssistantAudioQueue } from '../useAssistantAudioQueue.js';

const flushPlayback = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const enqueueChunk = (result, overrides = {}) => {
  act(() => {
    result.current.enqueueAudioChunk({
      base64: 'mock-audio-data',
      contentType: 'audio/mpeg',
      ...overrides,
    });
  });
};

describe('useAssistantAudioQueue', () => {
  let mockAudio;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    mockAudio = {
      src: '',
      muted: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
      currentTime: 0,
      onended: null,
    };

    global.Audio = vi.fn(() => mockAudio);
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    global.atob = vi.fn((value) => value);

    global.MediaSource = vi.fn(() => ({
      addSourceBuffer: vi.fn(),
      endOfStream: vi.fn(),
      readyState: 'open',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    global.MediaSource.isTypeSupported = vi.fn(() => false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useAssistantAudioQueue());

    expect(result.current.assistantAudioUrl).toBe('');
    expect(result.current.isAssistantSpeaking).toBe(false);
    expect(result.current.playbackError).toBe('');
  });

  it('unlocks audio playback', async () => {
    const { result } = renderHook(() => useAssistantAudioQueue());

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    let unlockResult;
    await act(async () => {
      unlockResult = await result.current.unlockAudio();
    });

    expect(unlockResult.ok).toBe(true);
    expect(mockAudio.play).toHaveBeenCalled();
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('handles audio unlock failure', async () => {
    mockAudio.play.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
    const onPlaybackError = vi.fn();
    const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackError }));

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    let unlockResult;
    await act(async () => {
      unlockResult = await result.current.unlockAudio();
    });

    expect(unlockResult.ok).toBe(false);
    expect(unlockResult.error).toContain('blocked');
    expect(onPlaybackError).toHaveBeenCalledWith(expect.stringContaining('blocked'));
  });

  it('returns an error when audio output is not ready', async () => {
    const { result } = renderHook(() => useAssistantAudioQueue());

    let unlockResult;
    await act(async () => {
      unlockResult = await result.current.unlockAudio();
    });

    expect(unlockResult.ok).toBe(false);
    expect(unlockResult.error).toContain('not ready');
  });

  it('enqueues a chunk and starts playback', async () => {
    const { result } = renderHook(() => useAssistantAudioQueue());

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    enqueueChunk(result);
    await flushPlayback();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockAudio.play).toHaveBeenCalled();
    expect(result.current.assistantAudioUrl).toBe('blob:mock-url');
    expect(result.current.isAssistantSpeaking).toBe(true);
  });

  it('plays queued chunks in order after each ended event', async () => {
    const { result } = renderHook(() => useAssistantAudioQueue());

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    act(() => {
      result.current.enqueueAudioChunk({ base64: 'chunk2', contentType: 'audio/mpeg', index: 2 });
      result.current.enqueueAudioChunk({ base64: 'chunk1', contentType: 'audio/mpeg', index: 1 });
    });

    await flushPlayback();
    expect(mockAudio.play).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockAudio.onended?.();
      await Promise.resolve();
    });
    await flushPlayback();

    expect(mockAudio.play).toHaveBeenCalledTimes(2);
  });

  it('clears queue and stops playback', async () => {
    const { result } = renderHook(() => useAssistantAudioQueue());

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    enqueueChunk(result);
    await flushPlayback();

    act(() => {
      result.current.clearQueue();
    });

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(result.current.isAssistantSpeaking).toBe(false);
    expect(result.current.assistantAudioUrl).toBe('');
  });

  it('calls playback lifecycle callbacks', async () => {
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    const onQueueDrained = vi.fn();
    const { result } = renderHook(() => useAssistantAudioQueue({
      onPlaybackStart,
      onPlaybackEnd,
      onQueueDrained,
    }));

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    enqueueChunk(result);
    await flushPlayback();

    await waitFor(() => {
      expect(onPlaybackStart).toHaveBeenCalled();
    });

    await act(async () => {
      mockAudio.onended?.();
      await Promise.resolve();
    });

    expect(onPlaybackEnd).toHaveBeenCalled();
    expect(onQueueDrained).toHaveBeenCalled();
  });

  it('calls onPlaybackError on playback failure', async () => {
    const onPlaybackError = vi.fn();
    mockAudio.play.mockRejectedValueOnce(new Error('Playback failed'));
    const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackError }));

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    enqueueChunk(result);
    await flushPlayback();

    await waitFor(() => {
      expect(onPlaybackError).toHaveBeenCalledWith('Playback failed');
    });
    expect(result.current.isAssistantSpeaking).toBe(false);
  });

  it('handles NotAllowedError during playback', async () => {
    const onPlaybackError = vi.fn();
    mockAudio.play.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
    const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackError }));

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    enqueueChunk(result);
    await flushPlayback();

    await waitFor(() => {
      expect(onPlaybackError).toHaveBeenCalledWith(expect.stringContaining('blocked'));
    });
  });

  it('revokes object URLs after playback', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAssistantAudioQueue());

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    enqueueChunk(result);
    await flushPlayback();

    await act(async () => {
      mockAudio.onended?.();
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('cleans up resources on unmount', async () => {
    const { result, unmount } = renderHook(() => useAssistantAudioQueue());

    act(() => {
      result.current.audioRef.current = mockAudio;
    });

    enqueueChunk(result);
    await flushPlayback();

    unmount();

    expect(mockAudio.pause).toHaveBeenCalled();
  });
});
