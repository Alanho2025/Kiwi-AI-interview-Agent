/**
 * File responsibility: Voice device check UI.
 * Main responsibilities:
 * - Render microphone and speaker checks inside the Start New Session settings panel.
 * - Keep status wording close to Voice Start so setup issues are visible before session start.
 * - Delegate browser API calls to useVoiceDeviceCheck.
 * Maintenance notes:
 * - Keep this component presentational and pass status changes back to the parent settings object.
 */

import { useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Mic, Volume2 } from 'lucide-react';
import { cn } from '../../utils/formatters.js';
import { useVoiceDeviceCheck } from '../../hooks/useVoiceDeviceCheck.js';

const statusCopy = {
  idle: 'Not checked',
  checking: 'Checking...',
  ok: 'Connected',
  blocked: 'Permission blocked',
  missing: 'No device detected',
  error: 'Check failed',
};

const formatCheckedAt = (value) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
};

function DeviceStatusRow({ icon: Icon, label, status, detail, error }) {
  const isOk = status === 'ok';
  const isChecking = status === 'checking';
  const StatusIcon = isOk ? CheckCircle2 : AlertCircle;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-gray-100 p-2 text-gray-600">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">{label}</p>
            {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          </div>
        </div>
        <div className={cn(
          'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
          isOk ? 'bg-green-50 text-green-700' : isChecking ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
        )}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusCopy[status] || statusCopy.idle}
        </div>
      </div>
    </div>
  );
}

/**
 * Purpose: Show advanced voice readiness controls before the interview starts.
 * Inputs: value is the saved device check state; onChange persists updates into analyze settings.
 * Returns: React UI for microphone and speaker checks.
 */
export function VoiceDeviceCheckPanel({ value, onChange }) {
  const {
    deviceCheck,
    checkMicrophone,
    checkSpeaker,
    isMicReady,
    statusLabel,
  } = useVoiceDeviceCheck(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current?.(deviceCheck);
  }, [deviceCheck]);

  const checkedAtLabel = formatCheckedAt(deviceCheck.checkedAt);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Voice readiness</h4>
          <p className="mt-1 text-xs text-gray-500">
            Check your microphone before starting a voice interview. Speaker test is recommended but will not block the session.
          </p>
          {checkedAtLabel ? <p className="mt-1 text-xs text-gray-400">Last checked: {checkedAtLabel}</p> : null}
        </div>
        <span className={cn(
          'rounded-full px-3 py-1 text-xs font-medium',
          isMicReady ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
        )}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-3">
        <DeviceStatusRow
          icon={Mic}
          label="Microphone"
          status={deviceCheck.mic.status}
          detail={deviceCheck.mic.deviceLabel || 'Required for voice interview.'}
          error={deviceCheck.mic.error}
        />
        <DeviceStatusRow
          icon={Volume2}
          label="Speaker"
          status={deviceCheck.speaker.status}
          detail="You should hear a short tone after running the test."
          error={deviceCheck.speaker.error}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={checkMicrophone}
          disabled={deviceCheck.mic.status === 'checking'}
        >
          Check Microphone
        </button>
        <button
          type="button"
          className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={checkSpeaker}
          disabled={deviceCheck.speaker.status === 'checking'}
        >
          Play Speaker Test
        </button>
      </div>
    </div>
  );
}
