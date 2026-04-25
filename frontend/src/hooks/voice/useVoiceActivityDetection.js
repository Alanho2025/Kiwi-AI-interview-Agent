import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceActivityStateMachine, DEFAULT_VAD_CONFIG } from '../../utils/voiceActivityDetectionCore.js';

const calculateRms = (byteData) => {
  if (!byteData?.length) return 0;
  let sum = 0;
  for (let i = 0; i < byteData.length; i += 1) {
    const normalized = (byteData[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / byteData.length);
};

export function useVoiceActivityDetection({
  stream = null,
  config = {},
  enabled = true,
  onSpeechStart,
  onSpeechEnd,
  onNoSpeechTimeout,
  onMaxAnswerTimeout,
  onVadFrame,
} = {}) {
  const mergedConfig = { ...DEFAULT_VAD_CONFIG, ...config };
  const [vadState, setVadState] = useState('idle');
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [vadMetrics, setVadMetrics] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const intervalRef = useRef(null);
  const machineRef = useRef(createVoiceActivityStateMachine(mergedConfig));
  const callbacksRef = useRef({ onSpeechStart, onSpeechEnd, onNoSpeechTimeout, onMaxAnswerTimeout, onVadFrame });

  callbacksRef.current = { onSpeechStart, onSpeechEnd, onNoSpeechTimeout, onMaxAnswerTimeout, onVadFrame };

  const stopVad = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect?.(); } catch {}
    try { audioContextRef.current?.close?.(); } catch {}
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    machineRef.current.stop(performance.now());
    setVadState('idle');
    setIsSpeechDetected(false);
  }, []);

  const startVad = useCallback(async ({ stream: overrideStream = null, ignoreFirstMs = mergedConfig.warmupIgnoreMs } = {}) => {
    if (!enabled) return false;
    const activeStream = overrideStream || stream;
    if (!activeStream) return false;

    stopVad();
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.2;
    const source = audioContext.createMediaStreamSource(activeStream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;
    const byteData = new Uint8Array(analyser.frequencyBinCount);
    const startedAt = performance.now();
    machineRef.current = createVoiceActivityStateMachine({ ...mergedConfig, warmupIgnoreMs: ignoreFirstMs });
    machineRef.current.start(startedAt);
    setVadState('listening');
    setVadMetrics({ startedAt });

    intervalRef.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(byteData);
      const rms = calculateRms(byteData);
      callbacksRef.current.onVadFrame?.({ rms, at: performance.now() });
      const result = machineRef.current.update(rms, performance.now());
      if (result.state) setVadState(result.state);

      if (result.event === 'speech_start') {
        setIsSpeechDetected(true);
        setVadMetrics((current) => ({ ...(current || {}), ...(result.metrics || {}) }));
        callbacksRef.current.onSpeechStart?.(result.metrics || {});
      }

      if (result.event === 'speech_end') {
        setIsSpeechDetected(false);
        setVadMetrics((current) => ({ ...(current || {}), ...(result.metrics || {}) }));
        callbacksRef.current.onSpeechEnd?.(result.metrics || {});
      }

      if (result.event === 'no_speech_timeout') {
        callbacksRef.current.onNoSpeechTimeout?.(result.metrics || {});
      }

      if (result.event === 'max_answer_timeout') {
        callbacksRef.current.onMaxAnswerTimeout?.(result.metrics || {});
      }
    }, mergedConfig.frameIntervalMs);

    return true;
  }, [enabled, mergedConfig.frameIntervalMs, mergedConfig.speechThreshold, mergedConfig.silenceThreshold, mergedConfig.minSpeechMs, mergedConfig.silenceToStopMs, mergedConfig.maxAnswerMs, mergedConfig.preSpeechGraceMs, mergedConfig.warmupIgnoreMs, stopVad, stream]);

  const resetVad = useCallback(() => {
    stopVad();
    setVadMetrics(null);
  }, [stopVad]);

  useEffect(() => () => stopVad(), [stopVad]);

  return {
    startVad,
    stopVad,
    resetVad,
    isSpeechDetected,
    vadState,
    vadMetrics,
    config: mergedConfig,
  };
}
