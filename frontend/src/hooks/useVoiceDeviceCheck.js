/**
 * File responsibility: Voice device readiness hook.
 * Main responsibilities:
 * - Check microphone permission and available input devices before a voice interview starts.
 * - Play a short browser-generated tone so users can confirm speaker output.
 * - Return a small, serialisable status object that can be saved inside analyze settings.
 * Maintenance notes:
 * - Keep browser API calls isolated here so settings UI remains simple.
 * - Do not keep MediaStream tracks alive after the check finishes.
 */

import { useCallback, useMemo, useState } from 'react';

export const DEFAULT_VOICE_DEVICE_CHECK = {
  mic: {
    status: 'idle',
    deviceLabel: '',
    error: '',
  },
  speaker: {
    status: 'idle',
    error: '',
  },
  checkedAt: '',
};

const nowIso = () => new Date().toISOString();

const stopStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const getAudioInputLabel = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return '';
  const devices = await navigator.mediaDevices.enumerateDevices();
  const firstInput = devices.find((device) => device.kind === 'audioinput');
  return firstInput?.label || 'Microphone connected';
};

const createAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : null;
};

/**
 * Purpose: Run browser-level mic and speaker checks for the analyze page.
 * Inputs: initialStatus is the last saved check object, if present.
 * Returns: Device check state plus actions for microphone and speaker checks.
 */
export function useVoiceDeviceCheck(initialStatus = DEFAULT_VOICE_DEVICE_CHECK) {
  const [deviceCheck, setDeviceCheck] = useState({
    ...DEFAULT_VOICE_DEVICE_CHECK,
    ...(initialStatus || {}),
    mic: { ...DEFAULT_VOICE_DEVICE_CHECK.mic, ...(initialStatus?.mic || {}) },
    speaker: { ...DEFAULT_VOICE_DEVICE_CHECK.speaker, ...(initialStatus?.speaker || {}) },
  });

  const updateDeviceCheck = useCallback((updater) => {
    setDeviceCheck((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return {
        ...DEFAULT_VOICE_DEVICE_CHECK,
        ...next,
        mic: { ...DEFAULT_VOICE_DEVICE_CHECK.mic, ...(next?.mic || {}) },
        speaker: { ...DEFAULT_VOICE_DEVICE_CHECK.speaker, ...(next?.speaker || {}) },
      };
    });
  }, []);

  const checkMicrophone = useCallback(async () => {
    updateDeviceCheck((current) => ({
      ...current,
      mic: { ...current.mic, status: 'checking', error: '' },
    }));

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        mic: {
          ...current.mic,
          status: 'error',
          error: 'This browser does not support microphone checks.',
        },
      }));
      return false;
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const label = await getAudioInputLabel();
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        mic: {
          status: 'ok',
          deviceLabel: label,
          error: '',
        },
      }));
      return true;
    } catch (error) {
      const blocked = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      const missing = error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError';
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        mic: {
          ...current.mic,
          status: blocked ? 'blocked' : missing ? 'missing' : 'error',
          error: blocked
            ? 'Microphone permission is blocked. Allow mic access in the browser, then check again.'
            : missing
              ? 'No microphone was detected.'
              : error?.message || 'Microphone check failed.',
        },
      }));
      return false;
    } finally {
      stopStream(stream);
    }
  }, [updateDeviceCheck]);

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
        speaker: {
          status: 'error',
          error: 'This browser does not support speaker checks.',
        },
      }));
      return false;
    }

    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
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
        speaker: {
          status: 'ok',
          error: '',
        },
      }));
      return true;
    } catch (error) {
      await audioContext.close?.().catch?.(() => {});
      updateDeviceCheck((current) => ({
        ...current,
        checkedAt: nowIso(),
        speaker: {
          status: 'error',
          error: error?.message || 'Speaker test failed.',
        },
      }));
      return false;
    }
  }, [updateDeviceCheck]);

  const isMicReady = deviceCheck.mic.status === 'ok';
  const isSpeakerChecked = deviceCheck.speaker.status === 'ok';

  const statusLabel = useMemo(() => {
    if (isMicReady && isSpeakerChecked) return 'Voice devices ready';
    if (isMicReady) return 'Microphone ready. Speaker test is optional.';
    return 'Run the microphone check before starting a voice session.';
  }, [isMicReady, isSpeakerChecked]);

  return {
    deviceCheck,
    setDeviceCheck: updateDeviceCheck,
    checkMicrophone,
    checkSpeaker,
    isMicReady,
    isSpeakerChecked,
    statusLabel,
  };
}
