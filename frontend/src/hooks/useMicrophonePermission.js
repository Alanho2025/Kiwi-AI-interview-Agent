import { useCallback, useEffect, useState } from 'react';

const getPermissionErrorMessage = (permissionError) => {
  const errorName = String(permissionError?.name || '').trim();
  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return 'Microphone permission was denied. Allow microphone access and try again.';
  }
  return permissionError?.message || 'Microphone access was blocked.';
};

export function useMicrophonePermission() {
  const [permissionState, setPermissionState] = useState('prompt');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState(null);

  const isSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    let cancelled = false;
    if (!isSupported || !navigator.permissions?.query) {
      if (!isSupported) setPermissionState('unsupported');
      return undefined;
    }

    navigator.permissions.query({ name: 'microphone' }).then((status) => {
      if (cancelled) return;
      setPermissionState(status.state || 'prompt');
      status.onchange = () => setPermissionState(status.state || 'prompt');
    }).catch(() => {
      if (!cancelled) setPermissionState('prompt');
    });

    return () => { cancelled = true; };
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      const message = 'This browser does not support microphone access.';
      setPermissionState('unsupported');
      setError(message);
      return { ok: false, error: message };
    }

    setIsRequesting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');
      return { ok: true };
    } catch (permissionError) {
      const message = getPermissionErrorMessage(permissionError);
      setPermissionState('denied');
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsRequesting(false);
    }
  }, [isSupported]);

  return {
    permissionState,
    isRequesting,
    error,
    requestPermission,
    isSupported,
  };
}
