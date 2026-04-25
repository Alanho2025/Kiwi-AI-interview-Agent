import { useCallback, useRef, useState } from 'react';

const TARGET_SAMPLE_RATE = 16000;

export const downsampleBuffer = (buffer, sourceRate, targetRate = TARGET_SAMPLE_RATE) => {
  if (targetRate === sourceRate) return buffer;
  const ratio = sourceRate / targetRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }
    result[offsetResult] = count ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
};

export const floatTo16BitPcm = (floatBuffer) => {
  const output = new Int16Array(floatBuffer.length);
  for (let i = 0; i < floatBuffer.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatBuffer[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output.buffer;
};

export const calculateRmsLevel = (samples) => {
  if (!samples?.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
};

export function useRealtimeMicStream({ onAudioChunk }) {
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const startedAtRef = useRef(0);
  const durationTimerRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [levelHistory, setLevelHistory] = useState([]);
  const [durationMs, setDurationMs] = useState(0);
  const [mediaStream, setMediaStream] = useState(null);

  const stopStream = useCallback(async () => {
    if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    try { processorRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { await audioContextRef.current?.close?.(); } catch {}
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    setMediaStream(null);
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(async () => {
    await stopStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleBuffer(input, audioContext.sampleRate, TARGET_SAMPLE_RATE);
      onAudioChunk?.(floatTo16BitPcm(downsampled));
      const rms = calculateRmsLevel(input);
      setLevelHistory((history) => [...history.slice(-41), Math.min(1, rms * 18)]);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    streamRef.current = stream;
    audioContextRef.current = audioContext;
    sourceRef.current = source;
    processorRef.current = processor;
    startedAtRef.current = performance.now();
    setDurationMs(0);
    setLevelHistory([]);
    setMediaStream(stream);
    setIsStreaming(true);
    durationTimerRef.current = window.setInterval(() => {
      setDurationMs(Math.round(performance.now() - startedAtRef.current));
    }, 250);
    return stream;
  }, [onAudioChunk, stopStream]);

  return {
    isStreaming,
    levelHistory,
    durationMs,
    mediaStream,
    startStream,
    stopStream,
  };
}
