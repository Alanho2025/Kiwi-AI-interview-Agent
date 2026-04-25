/**
 * File responsibility: Browser microphone streaming hook.
 * Main responsibilities:
 * - Capture microphone audio as small PCM chunks for WebSocket STT.
 * - Keep audio transport independent from interview and UI logic.
 * - Expose audio levels and duration for a responsive voice UI.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const TARGET_SAMPLE_RATE = 16000;
const MAX_LEVEL_HISTORY = 48;

export const downsampleBuffer = (buffer, inputSampleRate, outputSampleRate) => {
  if (outputSampleRate === inputSampleRate) return buffer;
  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accumulator = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accumulator += buffer[i];
      count += 1;
    }
    result[offsetResult] = count ? accumulator / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
};

export const floatTo16BitPcm = (samples) => {
  const output = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output.buffer;
};

export const calculateRmsLevel = (samples) => {
  if (!samples.length) return 0;
  const sum = samples.reduce((total, sample) => total + sample * sample, 0);
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
};

export function useRealtimeMicStream({ onAudioChunk }) {
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [levelHistory, setLevelHistory] = useState([]);
  const [durationMs, setDurationMs] = useState(0);

  const stopStream = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    try { processorRef.current?.disconnect?.(); } catch {}
    try { sourceRef.current?.disconnect?.(); } catch {}
    try { await audioContextRef.current?.close?.(); } catch {}
    try { streamRef.current?.getTracks?.().forEach((track) => track.stop()); } catch {}

    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(async () => {
    setStreamError(null);
    setLevelHistory([]);
    setDurationMs(0);

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(mediaStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleBuffer(input, audioContext.sampleRate, TARGET_SAMPLE_RATE);
      const chunk = floatTo16BitPcm(downsampled);
      onAudioChunk?.(chunk);
      const level = calculateRmsLevel(Array.from(input));
      setLevelHistory((current) => [...current.slice(-(MAX_LEVEL_HISTORY - 1)), level]);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    streamRef.current = mediaStream;
    audioContextRef.current = audioContext;
    sourceRef.current = source;
    processorRef.current = processor;
    startedAtRef.current = performance.now();
    timerRef.current = setInterval(() => {
      setDurationMs(Math.round(performance.now() - startedAtRef.current));
    }, 250);
    setIsStreaming(true);
  }, [onAudioChunk]);

  useEffect(() => () => {
    stopStream();
  }, [stopStream]);

  return {
    isStreaming,
    streamError,
    levelHistory,
    durationMs,
    startStream,
    stopStream,
  };
}
