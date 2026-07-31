import { describe, expect, it, vi } from 'vitest';
import { createSessionAudioMixer } from '../sessionAudioMixer.js';

const createMockMicStream = () => ({
  id: 'mic-stream-1',
  getAudioTracks: () => [{ id: 'track-1', stop: vi.fn() }],
});

const createMockAudioContext = () => {
  const destinationStream = { id: 'mixed-stream-1' };
  const mockAudioContext = {
    state: 'running',
    currentTime: 10,
    resume: vi.fn().mockResolvedValue(),
    close: vi.fn().mockResolvedValue(),
    createMediaStreamDestination: vi.fn(() => ({ stream: destinationStream })),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createMediaElementSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    destination: {},
  };
  return { MockAudioContext: vi.fn(() => mockAudioContext), mockAudioContext, destinationStream };
};

describe('sessionAudioMixer', () => {
  it('throws error if micStream is not provided', () => {
    expect(() => createSessionAudioMixer()).toThrow('Microphone stream is required');
  });

  it('falls back gracefully to mic_only when AudioContext is unavailable', () => {
    const micStream = createMockMicStream();
    const mixer = createSessionAudioMixer({ micStream, AudioContextClass: null });

    expect(mixer.topology).toBe('mic_only');
    expect(mixer.mixedStream).toBe(micStream);
  });

  it('creates mixed stream topology when assistant audio element is connected', () => {
    const micStream = createMockMicStream();
    const audioElement = document.createElement('audio');
    const { MockAudioContext, destinationStream } = createMockAudioContext();

    const mixer = createSessionAudioMixer({
      micStream,
      assistantAudioElement: audioElement,
      AudioContextClass: MockAudioContext,
    });

    expect(mixer.topology).toBe('mixed');
    expect(mixer.mixedStream).toBe(destinationStream);
  });

  it('handles muteAssistant, unmuteAssistant, and cleanup without throwing', () => {
    const micStream = createMockMicStream();
    const audioElement = document.createElement('audio');
    const { MockAudioContext } = createMockAudioContext();

    const mixer = createSessionAudioMixer({
      micStream,
      assistantAudioElement: audioElement,
      AudioContextClass: MockAudioContext,
    });

    expect(() => mixer.muteAssistant()).not.toThrow();
    expect(() => mixer.unmuteAssistant(0.5)).not.toThrow();
    expect(() => mixer.setAssistantGain(1.2)).not.toThrow();
    expect(() => mixer.cleanup()).not.toThrow();
  });
});
