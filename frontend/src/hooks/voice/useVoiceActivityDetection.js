import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createVoiceActivityStateMachine, DEFAULT_VAD_CONFIG } from '../../utils/voiceActivityDetectionCore.js';

const EMPTY_CONFIG = {};
const VAD_FRAME_TRACE_INTERVAL_MS = 500;

const calculateRms = (byteData) => {
  if (!byteData?.length) return 0;
  let sum = 0;
  for (let i = 0; i < byteData.length; i += 1) {
    const normalized = (byteData[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / byteData.length);
};

const buildTraceMetrics = (metrics = {}) => ({
  speechDurationMs: Math.round(Number(metrics?.speechDurationMs || 0)),
  silenceDurationMs: Math.round(Number(metrics?.silenceDurationMs || 0)),
  waitedMs: Math.round(Number(metrics?.waitedMs || 0)),
  speechStartedAt: metrics?.speechStartedAt ? Math.round(metrics.speechStartedAt) : null,
  speechEndedAt: metrics?.speechEndedAt ? Math.round(metrics.speechEndedAt) : null,
  silenceDetectedAt: metrics?.silenceDetectedAt ? Math.round(metrics.silenceDetectedAt) : null,
  thresholds: metrics?.thresholds || null,
  calibrationSamples: metrics?.calibrationSamples ?? null,
});

export function useVoiceActivityDetection({
  stream = null,
  config = EMPTY_CONFIG,
  enabled = true,
  onSpeechStart,
  onSpeechEnd,
  onNoSpeechTimeout,
  onMaxAnswerTimeout,
  onVadFrame,
} = {}) {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_VAD_CONFIG, ...config }), [config]);
  const [vadState, setVadState] = useState('idle');
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [vadMetrics, setVadMetrics] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const intervalRef = useRef(null);
  const machineRef = useRef(createVoiceActivityStateMachine(mergedConfig));
  const callbacksRef = useRef({ onSpeechStart, onSpeechEnd, onNoSpeechTimeout, onMaxAnswerTimeout, onVadFrame });
  const traceSessionRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFrameTraceAtRef = useRef(0);
  const lastStateRef = useRef('idle');

  callbacksRef.current = { onSpeechStart, onSpeechEnd, onNoSpeechTimeout, onMaxAnswerTimeout, onVadFrame };

  const stopVad = useCallback(() => {
    const stoppedAt = performance.now();
    const stopResult = machineRef.current.stop(stoppedAt);
    console.info('[FRONTEND-VAD-TRACE] stopVad', {
      traceSession: traceSessionRef.current,
      stoppedAt: Math.round(stoppedAt),
      previousState: lastStateRef.current,
      event: stopResult?.event || null,
      metrics: buildTraceMetrics(stopResult?.metrics || {}),
    });
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect?.(); } catch {}
    try { audioContextRef.current?.close?.(); } catch {}
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    setVadState('idle');
    setIsSpeechDetected(false);
    lastStateRef.current = 'idle';
  }, []);

  const startVad = useCallback(async ({ stream: overrideStream = null, ignoreFirstMs = mergedConfig.warmupIgnoreMs } = {}) => {
    if (!enabled) {
      console.warn('[FRONTEND-VAD-TRACE] startVad skipped because VAD is disabled.');
      return false;
    }
    const activeStream = overrideStream || stream;
    if (!activeStream) {
      console.warn('[FRONTEND-VAD-TRACE] startVad skipped because no stream exists.');
      return false;
    }

    stopVad();
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextCtor();
    if (audioContext.state === 'suspended') await audioContext.resume();
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
    traceSessionRef.current += 1;
    frameCountRef.current = 0;
    lastFrameTraceAtRef.current = 0;
    lastStateRef.current = 'listening';
    machineRef.current = createVoiceActivityStateMachine({ ...mergedConfig, warmupIgnoreMs: ignoreFirstMs });
    machineRef.current.start(startedAt);
    console.info('[FRONTEND-VAD-TRACE] startVad', {
      traceSession: traceSessionRef.current,
      startedAt: Math.round(startedAt),
      ignoreFirstMs,
      config: { ...mergedConfig, warmupIgnoreMs: ignoreFirstMs },
      audioContextSampleRate: audioContext.sampleRate,
      streamTrackStates: activeStream.getAudioTracks?.().map((track) => ({
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        label: track.label,
      })) || [],
    });
    setVadState('listening');
    setVadMetrics({ startedAt });

    intervalRef.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(byteData);
      const rms = calculateRms(byteData);
      const at = performance.now();
      const result = machineRef.current.update(rms, at);
      const runtimeMetrics = result.metrics || machineRef.current.getRuntimeMetrics?.() || null;
      frameCountRef.current += 1;

      callbacksRef.current.onVadFrame?.({
        rms,
        at,
        state: result.state,
        event: result.event,
        metrics: runtimeMetrics,
      });
      if (result.state) setVadState(result.state);

      const shouldTraceFrame = result.event
        || result.state !== lastStateRef.current
        || at - lastFrameTraceAtRef.current >= VAD_FRAME_TRACE_INTERVAL_MS;
      if (shouldTraceFrame) {
        lastFrameTraceAtRef.current = at;
        console.debug('[FRONTEND-VAD-TRACE] frame', {
          traceSession: traceSessionRef.current,
          frame: frameCountRef.current,
          at: Math.round(at),
          rms: Number(rms.toFixed(5)),
          state: result.state,
          previousState: lastStateRef.current,
          event: result.event || null,
          metrics: buildTraceMetrics(runtimeMetrics || {}),
        });
      }
      if (result.state) lastStateRef.current = result.state;

      if (result.event === 'speech_start') {
        console.info('[FRONTEND-VAD-TRACE] EVENT speech_start', {
          traceSession: traceSessionRef.current,
          at: Math.round(at),
          rms: Number(rms.toFixed(5)),
          metrics: buildTraceMetrics(result.metrics || {}),
        });
        setIsSpeechDetected(true);
        setVadMetrics((current) => ({ ...(current || {}), ...(result.metrics || {}) }));
        callbacksRef.current.onSpeechStart?.(result.metrics || {});
      }

      if (result.event === 'speech_end') {
        console.info('[FRONTEND-VAD-TRACE] EVENT speech_end', {
          traceSession: traceSessionRef.current,
          at: Math.round(at),
          rms: Number(rms.toFixed(5)),
          metrics: buildTraceMetrics(result.metrics || {}),
        });
        setIsSpeechDetected(false);
        setVadMetrics((current) => ({ ...(current || {}), ...(result.metrics || {}) }));
        callbacksRef.current.onSpeechEnd?.(result.metrics || {});
      }

      if (result.event === 'no_speech_timeout') {
        console.warn('[FRONTEND-VAD-TRACE] EVENT no_speech_timeout', {
          traceSession: traceSessionRef.current,
          at: Math.round(at),
          rms: Number(rms.toFixed(5)),
          metrics: buildTraceMetrics(result.metrics || {}),
        });
        callbacksRef.current.onNoSpeechTimeout?.(result.metrics || {});
      }

      if (result.event === 'max_answer_timeout') {
        console.warn('[FRONTEND-VAD-TRACE] EVENT max_answer_timeout', {
          traceSession: traceSessionRef.current,
          at: Math.round(at),
          rms: Number(rms.toFixed(5)),
          metrics: buildTraceMetrics(result.metrics || {}),
        });
        callbacksRef.current.onMaxAnswerTimeout?.(result.metrics || {});
      }
    }, mergedConfig.frameIntervalMs);

    return true;
  }, [enabled, mergedConfig, stopVad, stream]);

  const resetVad = useCallback(() => {
    console.info('[FRONTEND-VAD-TRACE] resetVad', { traceSession: traceSessionRef.current });
    stopVad();
    setVadMetrics(null);
  }, [stopVad]);

  const extendSilenceDeadline = useCallback(({ durationMs = 2500, reason = 'vocalized_pause' } = {}) => {
    return machineRef.current.extendCurrentSilenceDeadline({ durationMs, reason });
  }, []);

  useEffect(() => () => stopVad(), [stopVad]);

  return {
    startVad,
    stopVad,
    resetVad,
    extendSilenceDeadline,
    isSpeechDetected,
    vadState,
    vadMetrics,
    config: mergedConfig,
  };
}
