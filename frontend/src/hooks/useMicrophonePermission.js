import { useCallback, useEffect, useState } from 'react';

const SUPPORTED_PERMISSION_STATES = new Set(['granted', 'denied', 'prompt']);

const normalizePermissionState = (value) => {
  if (SUPPORTED_PERMISSION_STATES.has(value)) return value;
  return 'unknown';
};

export function useMicrophonePermission() {
  const [permissionState, setPermissionState] = useState('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let permissionStatus;

    const syncPermission = async () => {
      if (!navigator?.permissions?.query) return;
      try {
        permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        setPermissionState(normalizePermissionState(permissionStatus.state));
        permissionStatus.onchange = () => {
          setPermissionState(normalizePermissionState(permissionStatus.state));
        };
      } catch {
        // Safari and some mobile browsers may not support this permission query.
      }
    };

    syncPermission();

    return () => {
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      const message = 'This browser does not support microphone access for voice practice.';
      setError(message);
      setPermissionState('unsupported');
      return { ok: false, error: message };
    }

    setIsRequesting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');
      return { ok: true };
    } catch (requestError) {
      const nextState = requestError?.name === 'NotAllowedError' ? 'denied' : 'unknown';
      const message = requestError?.message || 'Could not access the microphone on this device.';
      setPermissionState(nextState);
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsRequesting(false);
    }
  }, []);

  return {
    permissionState,
    isRequesting,
    error,
    requestPermission,
    isSupported: permissionState !== 'unsupported',
  };
}
