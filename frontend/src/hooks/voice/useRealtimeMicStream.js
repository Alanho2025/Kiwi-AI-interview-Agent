import { useCallback, useMemo, useRef, useState } from 'react';
import { MICROPHONE_AUDIO_CONSTRAINTS } from '../useMicrophonePermission.js';

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

const AUDIO_GATE_DEFAULTS = {
  minRms: 0.006,
  noiseFloorMargin: 0.008,
  warmupChunkCount: 8,
  minChunksBeforeSend: 2,
};

const createInitialAudioGateState = () => ({
  chunksSeen: 0,
  acceptedChunks: 0,
  noiseSamples: [],
  noiseFloorRms: null,
  lastRejectedReason: null,
});

const percentile = (values = [], target = 0.8) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * target)));
  return sorted[index];
};

const shouldSendChunkThroughAudioGate = ({ rms, mode, gateState }) => {
  const config = {
    ...AUDIO_GATE_DEFAULTS,
    ...(mode.audioGate || {}),
  };

  gateState.chunksSeen += 1;

  if (gateState.chunksSeen <= config.warmupChunkCount) {
    gateState.noiseSamples = [...gateState.noiseSamples.slice(-40), rms];
    gateState.noiseFloorRms = percentile(gateState.noiseSamples, 0.8);
    gateState.lastRejectedReason = 'audio_gate_warmup';
    return false;
  }

  const adaptiveThreshold = Math.max(
    config.minRms,
    Number(gateState.noiseFloorRms || 0) + config.noiseFloorMargin
  );

  if (rms < adaptiveThreshold) {
    gateState.noiseSamples = [...gateState.noiseSamples.slice(-40), rms];
    gateState.noiseFloorRms = percentile(gateState.noiseSamples, 0.8);
    gateState.lastRejectedReason = 'below_noise_gate';
    return false;
  }

  gateState.acceptedChunks += 1;

  if (gateState.acceptedChunks < config.minChunksBeforeSend) {
    gateState.lastRejectedReason = 'speech_not_confirmed';
    return false;
  }

  gateState.lastRejectedReason = null;
  return true;
};

export function useRealtimeMicStream({ onAudioChunk }) {
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const startedAtRef = useRef(0);
  const durationTimerRef = useRef(null);
  const onAudioChunkRef = useRef(onAudioChunk);
  const audioGateRef = useRef(createInitialAudioGateState());
  const [isStreaming, setIsStreaming] = useState(false);
  const [levelHistory, setLevelHistory] = useState([]);
  const [durationMs, setDurationMs] = useState(0);
  const modeRef = useRef({ sendAudio: true, audioGateEnabled: false });
  const [mediaStream, setMediaStream] = useState(null);

  onAudioChunkRef.current = onAudioChunk;

  const stopStream = useCallback(async () => {
    if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    try { processorRef.current?.disconnect(); } catch { }
    try { sourceRef.current?.disconnect(); } catch { }
    try { await audioContextRef.current?.close?.(); } catch { }
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    setMediaStream(null);
    setIsStreaming(false);
  }, []);

  const setSendAudio = useCallback((sendAudio, options = {}) => {
    modeRef.current = {
      ...modeRef.current,
      sendAudio: Boolean(sendAudio),
      audioGateEnabled: options.audioGateEnabled === true,
      audioGate: options.audioGate || modeRef.current.audioGate || AUDIO_GATE_DEFAULTS,
    };

    if (sendAudio) {
      audioGateRef.current = createInitialAudioGateState();
    }
  }, []);


  const startStream = useCallback(async (options = {}) => {
    modeRef.current = {
      sendAudio: options.sendAudio !== false,
      audioGateEnabled: options.audioGateEnabled === true,
      audioGate: options.audioGate || AUDIO_GATE_DEFAULTS,
    };
    audioGateRef.current = createInitialAudioGateState();
    await stopStream();

    const stream = options.stream || await navigator.mediaDevices.getUserMedia({ audio: MICROPHONE_AUDIO_CONSTRAINTS });
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextCtor();
    if (audioContext.state === 'suspended') await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleBuffer(input, audioContext.sampleRate, TARGET_SAMPLE_RATE);
      const rms = calculateRmsLevel(input);

      if (modeRef.current.sendAudio) {
        const canSend = !modeRef.current.audioGateEnabled
          || shouldSendChunkThroughAudioGate({
            rms,
            mode: modeRef.current,
            gateState: audioGateRef.current,
          });

        if (canSend) {
          onAudioChunkRef.current?.(floatTo16BitPcm(downsampled));
        }
      }

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
  }, [stopStream]);

  return useMemo(() => ({
    isStreaming,
    levelHistory,
    durationMs,
    mediaStream,
    startStream,
    stopStream,
    setSendAudio,
  }), [isStreaming, levelHistory, durationMs, mediaStream, startStream, stopStream, setSendAudio]);
}
