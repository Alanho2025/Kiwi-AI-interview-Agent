import { useCallback, useEffect, useRef, useState } from 'react';

const TARGET_SAMPLE_RATE = 16000;
const MAX_LEVEL_HISTORY = 72;

const mergeAudioBuffers = (buffers) => {
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  buffers.forEach((buffer) => {
    merged.set(buffer, offset);
    offset += buffer.length;
  });
  return merged;
};

const downsampleAudioBuffer = (buffer, sourceSampleRate, targetSampleRate = TARGET_SAMPLE_RATE) => {
  if (sourceSampleRate === targetSampleRate) {
    return buffer;
  }

  const sampleRateRatio = sourceSampleRate / targetSampleRate;
  const nextLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(nextLength);
  let outputOffset = 0;
  let inputOffset = 0;

  while (outputOffset < result.length) {
    const nextInputOffset = Math.round((outputOffset + 1) * sampleRateRatio);
    let accumulator = 0;
    let count = 0;

    for (let index = inputOffset; index < nextInputOffset && index < buffer.length; index += 1) {
      accumulator += buffer[index];
      count += 1;
    }

    result[outputOffset] = count ? accumulator / count : 0;
    outputOffset += 1;
    inputOffset = nextInputOffset;
  }

  return result;
};

const encodeWav = (samples, sampleRate = TARGET_SAMPLE_RATE) => {
  const bytesPerSample = 2;
  const headerLength = 44;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(buffer);

  const writeAscii = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  samples.forEach((sample) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  });

  return buffer;
};

const getNormalizedLevel = (chunk) => {
  if (!chunk?.length) return 0;
  let squareSum = 0;
  for (let index = 0; index < chunk.length; index += 1) {
    squareSum += chunk[index] * chunk[index];
  }
  const rms = Math.sqrt(squareSum / chunk.length);
  return Math.min(1, rms * 8);
};

export function useDirectWavRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  const [levelHistory, setLevelHistory] = useState(Array.from({ length: MAX_LEVEL_HISTORY }, () => 0));
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const resourcesRef = useRef({
    stream: null,
    audioContext: null,
    source: null,
    processor: null,
    chunks: [],
    sampleRate: TARGET_SAMPLE_RATE,
    startedAt: 0,
    gainNode: null,
    timerId: null,
  });

  const resetLevels = useCallback(() => {
    setLevelHistory(Array.from({ length: MAX_LEVEL_HISTORY }, () => 0));
  }, []);

  const clearResources = useCallback(async () => {
    const resources = resourcesRef.current;
    if (resources.timerId) {
      window.clearInterval(resources.timerId);
      resources.timerId = null;
    }
    resources.processor?.disconnect?.();
    resources.source?.disconnect?.();
    resources.gainNode?.disconnect?.();
    resources.stream?.getTracks?.().forEach((track) => track.stop());
    if (resources.audioContext && resources.audioContext.state !== 'closed') {
      try {
        await resources.audioContext.close();
      } catch {
        // ignore close failures during cleanup
      }
    }
    resourcesRef.current = {
      stream: null,
      audioContext: null,
      source: null,
      processor: null,
      chunks: [],
      sampleRate: TARGET_SAMPLE_RATE,
      startedAt: 0,
      gainNode: null,
      timerId: null,
    };
    setIsRecording(false);
    setRecordingDurationMs(0);
    resetLevels();
  }, [resetLevels]);

  const startRecording = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      const message = 'This browser cannot record microphone audio for direct voice turns.';
      setRecordingError(message);
      throw new Error(message);
    }

    await clearResources();
    setRecordingError(null);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      stream.getTracks().forEach((track) => track.stop());
      const message = 'Audio processing is not supported on this browser.';
      setRecordingError(message);
      throw new Error(message);
    }

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;

    const chunks = [];
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const copied = new Float32Array(input.length);
      copied.set(input);
      chunks.push(copied);
      const level = getNormalizedLevel(copied);
      setLevelHistory((current) => [...current.slice(-(MAX_LEVEL_HISTORY - 1)), level]);
    };

    source.connect(processor);
    processor.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      setRecordingDurationMs(Date.now() - startedAt);
    }, 120);

    resourcesRef.current = {
      stream,
      audioContext,
      source,
      processor,
      chunks,
      sampleRate: audioContext.sampleRate,
      startedAt,
      gainNode,
      timerId,
    };

    setIsRecording(true);
    setRecordingDurationMs(0);
  }, [clearResources]);

  const stopRecording = useCallback(async () => {
    const resources = resourcesRef.current;
    if (!resources.stream || !resources.audioContext) {
      return null;
    }

    if (resources.timerId) {
      window.clearInterval(resources.timerId);
      resources.timerId = null;
    }

    const merged = mergeAudioBuffers(resources.chunks);
    const downsampled = downsampleAudioBuffer(merged, resources.sampleRate, TARGET_SAMPLE_RATE);
    const wavBuffer = encodeWav(downsampled, TARGET_SAMPLE_RATE);
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const wavFile = new File([wavBlob], `voice-turn-${Date.now()}.wav`, { type: 'audio/wav' });
    const durationMs = resources.startedAt ? Date.now() - resources.startedAt : recordingDurationMs;

    await clearResources();

    return {
      file: wavFile,
      durationMs,
    };
  }, [clearResources, recordingDurationMs]);

  useEffect(() => () => {
    clearResources();
  }, [clearResources]);

  return {
    isRecording,
    recordingError,
    levelHistory,
    recordingDurationMs,
    startRecording,
    stopRecording,
    clearResources,
  };
}
