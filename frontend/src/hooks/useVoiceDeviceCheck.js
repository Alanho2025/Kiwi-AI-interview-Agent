/**
 * File responsibility: Voice device readiness hook.
 * Main responsibilities:
 * - Check browser support, secure context, microphone permission, input level, and speaker output.
 * - Detect audio device changes and stale readiness checks before a duplex voice interview starts.
 * - Keep browser MediaStream and AudioContext cleanup isolated from UI components.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export const DEFAULT_VOICE_DEVICE_CHECK = {
  browser: {
    status: 'idle',
    error: '',
  },
  mic: {
    status: 'idle',
    deviceLabel: '',
    inputLevel: 0,
    error: '',
  },
  speaker: {
    status: 'idle',
    error: '',
  },
  deviceState: {
    isStale: false,
    message: '',
  },
  checkedAt: '',
};

const nowIso = () => new Date().toISOString();
const stopStream = (stream) => stream?.getTracks?.().forEach((track) => track.stop());

const createAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : null;
};

const getBrowserStatus = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { status: 'unsupported', error: 'Voice checks require a browser environment.' };
  }
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (!window.isSecureContext && !isLocalhost) {
    return { status: 'insecure_context', error: 'Voice Mode requires HTTPS or localhost for microphone access.' };
  }
  if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
    return { status: 'unsupported', error: 'This browser does not support microphone device checks.' };
  }
  if (!createAudioContext()) {
    return { status: 'unsupported', error: 'This browser does not support AudioContext.' };
  }
  if (typeof WebSocket === 'undefined') {
    return { status: 'unsupported', error: 'This browser does not support WebSocket voice sessions.' };
  }
  return { status: 'ok', error: '' };
};

const getAudioInputLabel = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return '';
  const devices = await navigator.mediaDevices.enumerateDevices();
  const firstInput = devices.find((device) => device.kind === 'audioinput');
  return firstInput?.label || 'Microphone connected';
};

const sampleInputLevel = async (stream, durationMs = 1200) => {
  const audioContext = createAudioContext();
  if (!audioContext) return 0;
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let peak = 0;
  const startedAt = performance.now();
  while (performance.now() - startedAt < durationMs) {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const normalized = (data[i] - 128) / 128;
      sum += normalized * normalized;
    }
    peak = Math.max(peak, Math.sqrt(sum / data.length));
    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }
  try { source.disconnect(); } catch {}
  try { analyser.disconnect(); } catch {}
  try { await audioContext.close(); } catch {}
  return peak;
};

export function useVoiceDeviceCheck(initialStatus = DEFAULT_VOICE_DEVICE_CHECK) {
  const [deviceCheck, setDeviceCheck] = useState({
    ...DEFAULT_VOICE_DEVICE_CHECK,
    ...(initialStatus || {}),
    browser: { ...DEFAULT_VOICE_DEVICE_CHECK.browser, ...(initialStatus?.browser || {}) },
    mic: { ...DEFAULT_VOICE_DEVICE_CHECK.mic, ...(initialStatus?.mic || {}) },
    speaker: { ...DEFAULT_VOICE_DEVICE_CHECK.speaker, ...(initialStatus?.speaker || {}) },
    deviceState: { ...DEFAULT_VOICE_DEVICE_CHECK.deviceState, ...(initialStatus?.deviceState || {}) },
  });

  const updateDeviceCheck = useCallback((updater) => {
    setDeviceCheck((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return {
        ...DEFAULT_VOICE_DEVICE_CHECK,
        ...next,
        browser: { ...DEFAULT_VOICE_DEVICE_CHECK.browser, ...(next?.browser || {}) },
        mic: { ...DEFAULT_VOICE_DEVICE_CHECK.mic, ...(next?.mic || {}) },
        speaker: { ...DEFAULT_VOICE_DEVICE_CHECK.speaker, ...(next?.speaker || {}) },
        deviceState: { ...DEFAULT_VOICE_DEVICE_CHECK.deviceState, ...(next?.deviceState || {}) },
      };
    });
  }, []);

  const checkBrowser = useCallback(() => {
    const browser = getBrowserStatus();
    updateDeviceCheck((current) => ({ ...current, browser, checkedAt: nowIso() }));
    return browser.status === 'ok';
  }, [updateDeviceCheck]);

  const checkMicrophone = useCallback(async () => {
    const browserOk = checkBrowser();
    if (!browserOk) return false;

    updateDeviceCheck((current) => ({
      ...current,
      mic: { ...current.mic, status: 'checking', error: '' },
      deviceState: { isStale: false, message: '' },
    }));

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const label = await getAudioInputLabel();
      const inputLevel = await sampleInputLevel(stream);
      const status = inputLevel <= 0.002 ? 'silent' : inputLevel < 0.01 ? 'too_quiet' : 'ok';
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        mic: {
          status,
          deviceLabel: label,
          inputLevel,
          error: status === 'silent'
            ? 'Microphone was detected, but no input level was heard.'
            : status === 'too_quiet'
              ? 'Microphone input is very quiet. Move closer or check input volume.'
              : '',
        },
      }));
      return status === 'ok';
    } catch (error) {
      const blocked = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      const missing = error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError';
      const busy = error?.name === 'NotReadableError' || error?.name === 'TrackStartError';
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        mic: {
          ...current.mic,
          status: blocked ? 'blocked' : missing ? 'missing' : busy ? 'busy' : 'error',
          error: blocked
            ? 'Microphone permission is blocked. Allow mic access in the browser, then check again.'
            : missing
              ? 'No microphone was detected.'
              : busy
                ? 'The microphone exists but could not start. Another app may be using it.'
                : error?.message || 'Microphone check failed.',
        },
      }));
      return false;
    } finally {
      stopStream(stream);
    }
  }, [checkBrowser, updateDeviceCheck]);

  const checkSpeaker = useCallback(async () => {
    updateDeviceCheck((current) => ({
      ...current,
      speaker: { ...current.speaker, status: 'checking', error: '' },
    }));

    const audioContext = createAudioContext();
    if (!audioContext) {
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        speaker: { status: 'error', error: 'This browser does not support speaker checks.' },
      }));
      return false;
    }

    try {
      if (audioContext.state === 'suspended') await audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 660;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
      await audioContext.close();
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        speaker: { status: 'needs_confirmation', error: 'Confirm whether you heard the test sound.' },
      }));
      return true;
    } catch (error) {
      await audioContext.close?.().catch?.(() => {});
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        speaker: { status: 'error', error: error?.message || 'Speaker test failed.' },
      }));
      return false;
    }
  }, [updateDeviceCheck]);

  const confirmSpeakerHeard = useCallback(() => {
    updateDeviceCheck((current) => ({ ...current, speaker: { status: 'ok', error: '' }, checkedAt: nowIso() }));
  }, [updateDeviceCheck]);

  const confirmSpeakerNotHeard = useCallback(() => {
    updateDeviceCheck((current) => ({ ...current, speaker: { status: 'not_heard', error: 'Speaker test was not heard. Check output device and volume.' }, checkedAt: nowIso() }));
  }, [updateDeviceCheck]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) return undefined;
    const handleDeviceChange = () => updateDeviceCheck((current) => ({
      ...current,
      deviceState: { isStale: true, message: 'Audio device changed. Please run the voice device check again.' },
    }));
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [updateDeviceCheck]);

  const isBrowserReady = deviceCheck.browser.status === 'ok';
  const isMicReady = deviceCheck.mic.status === 'ok';
  const isSpeakerChecked = deviceCheck.speaker.status === 'ok';
  const isStale = Boolean(deviceCheck.deviceState?.isStale);

  const statusLabel = useMemo(() => {
    if (isStale) return 'Audio device changed. Please run the check again.';
    if (isBrowserReady && isMicReady && isSpeakerChecked) return 'Voice devices ready';
    if (!isBrowserReady) return deviceCheck.browser.error || 'Browser is not ready for Voice Mode.';
    if (!isMicReady) return 'Run the microphone check before starting a voice session.';
    if (!isSpeakerChecked) return 'Run and confirm the speaker test before starting.';
    return 'Voice device check incomplete.';
  }, [isBrowserReady, isMicReady, isSpeakerChecked, isStale, deviceCheck.browser.error]);

  return {
    deviceCheck,
    setDeviceCheck: updateDeviceCheck,
    checkBrowser,
    checkMicrophone,
    checkSpeaker,
    confirmSpeakerHeard,
    confirmSpeakerNotHeard,
    isBrowserReady,
    isMicReady,
    isSpeakerChecked,
    isStale,
    statusLabel,
  };
}
