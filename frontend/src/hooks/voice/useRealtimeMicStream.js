import { useCallback, useMemo, useRef, useState } from 'react';
import { MICROPHONE_AUDIO_CONSTRAINTS } from '../useMicrophonePermission.js';

const TARGET_SAMPLE_RATE = 16000;
const MIC_AUDIO_TRACE_EVERY = 25;

const traceMic = (event, payload = {}) => {
  console.log('[FRONTEND-MIC-TRACE]', event, {
    at: Date.now(),
    ...payload,
  });
};

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
  const processorChunkCountRef = useRef(0);
  const sentChunkCountRef = useRef(0);
  const blockedChunkCountRef = useRef(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [levelHistory, setLevelHistory] = useState([]);
  const [durationMs, setDurationMs] = useState(0);
  const modeRef = useRef({ sendAudio: true, audioGateEnabled: false });
  const [mediaStream, setMediaStream] = useState(null);

  onAudioChunkRef.current = onAudioChunk;

  const stopStream = useCallback(async () => {
    traceMic('stopStream_start', {
      hadStream: Boolean(streamRef.current),
      hadAudioContext: Boolean(audioContextRef.current),
      audioContextState: audioContextRef.current?.state || null,
      processorChunks: processorChunkCountRef.current,
      sentChunks: sentChunkCountRef.current,
      blockedChunks: blockedChunkCountRef.current,
      mode: modeRef.current,
    });
    if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    try { processorRef.current?.disconnect(); } catch (error) { traceMic('processor_disconnect_error', { error: error?.message || String(error) }); }
    try { sourceRef.current?.disconnect(); } catch (error) { traceMic('source_disconnect_error', { error: error?.message || String(error) }); }
    try { await audioContextRef.current?.close?.(); } catch (error) { traceMic('audio_context_close_error', { error: error?.message || String(error) }); }
    streamRef.current?.getTracks?.().forEach((track) => {
      traceMic('stopStream_track_stop', {
        id: track.id,
        label: track.label,
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
      track.stop();
    });
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    setMediaStream(null);
    setIsStreaming(false);
    traceMic('stopStream_done', {
      processorChunks: processorChunkCountRef.current,
      sentChunks: sentChunkCountRef.current,
      blockedChunks: blockedChunkCountRef.current,
    });
  }, []);

  const setSendAudio = useCallback((sendAudio, options = {}) => {
    const previousMode = modeRef.current;
    modeRef.current = {
      ...modeRef.current,
      sendAudio: Boolean(sendAudio),
      audioGateEnabled: options.audioGateEnabled === true,
      audioGate: options.audioGate || modeRef.current.audioGate || AUDIO_GATE_DEFAULTS,
    };

    if (sendAudio) {
      audioGateRef.current = createInitialAudioGateState();
      sentChunkCountRef.current = 0;
      blockedChunkCountRef.current = 0;
    }

    traceMic('setSendAudio', {
      requestedSendAudio: sendAudio,
      options,
      previousMode,
      nextMode: modeRef.current,
      gateReset: Boolean(sendAudio),
    });
  }, []);


  const startStream = useCallback(async (options = {}) => {
    modeRef.current = {
      sendAudio: options.sendAudio !== false,
      audioGateEnabled: options.audioGateEnabled === true,
      audioGate: options.audioGate || AUDIO_GATE_DEFAULTS,
    };
    audioGateRef.current = createInitialAudioGateState();
    processorChunkCountRef.current = 0;
    sentChunkCountRef.current = 0;
    blockedChunkCountRef.current = 0;
    traceMic('startStream_requested', {
      options,
      mode: modeRef.current,
      hasProvidedStream: Boolean(options.stream),
    });
    await stopStream();

    const stream = options.stream || await navigator.mediaDevices.getUserMedia({ audio: MICROPHONE_AUDIO_CONSTRAINTS });
    traceMic('startStream_got_media_stream', {
      constraints: MICROPHONE_AUDIO_CONSTRAINTS,
      tracks: stream.getAudioTracks?.().map((track) => ({
        id: track.id,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      })) || [],
    });
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextCtor();
    traceMic('audio_context_created', {
      sampleRate: audioContext.sampleRate,
      state: audioContext.state,
    });
    if (audioContext.state === 'suspended') await audioContext.resume();
    traceMic('audio_context_ready', {
      sampleRate: audioContext.sampleRate,
      state: audioContext.state,
    });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      processorChunkCountRef.current += 1;
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
          sentChunkCountRef.current += 1;
          if (sentChunkCountRef.current === 1 || sentChunkCountRef.current % MIC_AUDIO_TRACE_EVERY === 0) {
            traceMic('audio_chunk_sent_to_socket', {
              processorChunkIndex: processorChunkCountRef.current,
              sentChunkIndex: sentChunkCountRef.current,
              rms: Number(rms.toFixed(5)),
              sourceSampleRate: audioContext.sampleRate,
              targetSampleRate: TARGET_SAMPLE_RATE,
              inputSamples: input.length,
              outputSamples: downsampled.length,
              bytes: downsampled.length * 2,
              mode: modeRef.current,
            });
          }
          onAudioChunkRef.current?.(floatTo16BitPcm(downsampled));
        } else {
          blockedChunkCountRef.current += 1;
          if (blockedChunkCountRef.current === 1 || blockedChunkCountRef.current % MIC_AUDIO_TRACE_EVERY === 0) {
            traceMic('audio_chunk_blocked_by_gate', {
              processorChunkIndex: processorChunkCountRef.current,
              blockedChunkIndex: blockedChunkCountRef.current,
              rms: Number(rms.toFixed(5)),
              gateState: audioGateRef.current,
              mode: modeRef.current,
            });
          }
        }
      } else if (processorChunkCountRef.current === 1 || processorChunkCountRef.current % MIC_AUDIO_TRACE_EVERY === 0) {
        traceMic('audio_chunk_not_sent_sendAudio_false', {
          processorChunkIndex: processorChunkCountRef.current,
          rms: Number(rms.toFixed(5)),
          mode: modeRef.current,
        });
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
    traceMic('startStream_done', {
      startedAt: Math.round(startedAtRef.current),
      audioContextSampleRate: audioContext.sampleRate,
      targetSampleRate: TARGET_SAMPLE_RATE,
      mode: modeRef.current,
    });
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
