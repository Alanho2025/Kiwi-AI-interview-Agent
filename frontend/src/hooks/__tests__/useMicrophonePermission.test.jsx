import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMicrophonePermission } from '../useMicrophonePermission.js';

describe('useMicrophonePermission', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reports unsupported when getUserMedia is unavailable', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useMicrophonePermission());

    await act(async () => {
      const response = await result.current.requestPermission();
      expect(response.ok).toBe(false);
    });

    expect(result.current.permissionState).toBe('unsupported');
    expect(result.current.isSupported).toBe(false);
  });

  it('requests permission and stops the temporary permission stream', async () => {
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });

    const { result } = renderHook(() => useMicrophonePermission());

    await act(async () => {
      const response = await result.current.requestPermission();
      expect(response.ok).toBe(true);
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.permissionState).toBe('granted');
  });

  it('handles denied microphone permission without throwing', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) },
    });

    const { result } = renderHook(() => useMicrophonePermission());

    await act(async () => {
      const response = await result.current.requestPermission();
      expect(response.ok).toBe(false);
    });

    expect(result.current.permissionState).toBe('denied');
    expect(result.current.error).toContain('Microphone permission was denied');
  });
});
