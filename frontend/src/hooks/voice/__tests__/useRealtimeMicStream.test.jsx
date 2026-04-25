import { describe, expect, it } from 'vitest';
import { calculateRmsLevel, downsampleBuffer, floatTo16BitPcm } from '../useRealtimeMicStream.js';

describe('realtime mic stream helpers', () => {
  it('downsamples audio without increasing the sample count', () => {
    const input = Float32Array.from([0, 0.2, 0.4, 0.6, 0.8, 1]);
    const output = downsampleBuffer(input, 48000, 16000);

    expect(output.length).toBeLessThan(input.length);
    expect(Array.from(output).every(Number.isFinite)).toBe(true);
  });

  it('converts float samples to signed 16-bit PCM bytes', () => {
    const pcm = floatTo16BitPcm(Float32Array.from([-1, 0, 1]));

    expect(pcm).toBeInstanceOf(ArrayBuffer);
    expect(pcm.byteLength).toBe(6);
    expect(new DataView(pcm).getInt16(0, true)).toBe(-32768);
    expect(new DataView(pcm).getInt16(2, true)).toBe(0);
    expect(new DataView(pcm).getInt16(4, true)).toBe(32767);
  });

  it('calculates RMS level for voice activity UI', () => {
    expect(calculateRmsLevel(Float32Array.from([0, 0, 0]))).toBe(0);
    expect(calculateRmsLevel(Float32Array.from([1, -1, 1]))).toBeCloseTo(1, 5);
  });
});
