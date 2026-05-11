/**
 * File responsibility: Voice device check UI.
 * Main responsibilities:
 * - Render browser, microphone, and speaker checks inside the Start New Session settings panel.
 * - Keep status wording close to Voice Start so setup issues are visible before session start.
 * - Delegate browser API calls to useVoiceDeviceCheck.
 */

import { useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Mic, Volume2 } from 'lucide-react';
import { cn } from '../../utils/formatters.js';
import { useVoiceDeviceCheck } from '../../hooks/useVoiceDeviceCheck.js';

const statusCopy = {
  idle: 'Not checked', checking: 'Checking...', ok: 'Ready', blocked: 'Permission blocked', missing: 'No device',
  error: 'Check failed', unsupported: 'Unsupported', insecure_context: 'HTTPS required', busy: 'Device busy',
  silent: 'No input heard', too_quiet: 'Too quiet', needs_confirmation: 'Confirm sound', not_heard: 'Not heard',
};

const formatCheckedAt = (value) => {
  if (!value) return '';
  try { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)); } catch { return ''; }
};

function DeviceStatusRow({ icon: Icon, label, status, detail, error }) {
  const isOk = status === 'ok';
  const isChecking = status === 'checking';
  const StatusIcon = isOk ? CheckCircle2 : AlertCircle;
  return (
    <div className="rounded-xl border border-theme glass px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-chip p-2 text-muted"><Icon className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-medium text-primary">{label}</p>
            {detail ? <p className="mt-1 text-xs text-faint">{detail}</p> : null}
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          </div>
        </div>
        <div className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', isOk ? '[background:var(--accent-glow)] text-accent' : isChecking ? 'bg-blue-50 text-blue-700' : 'bg-chip text-muted')}>
          <StatusIcon className="h-3.5 w-3.5" />{statusCopy[status] || statusCopy.idle}
        </div>
      </div>
    </div>
  );
}

export function VoiceDeviceCheckPanel({ value, onChange }) {
  const { deviceCheck, checkMicrophone, checkSpeaker, confirmSpeakerHeard, confirmSpeakerNotHeard, isMicReady, statusLabel } = useVoiceDeviceCheck(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onChangeRef.current?.(deviceCheck); }, [deviceCheck]);
  const checkedAtLabel = formatCheckedAt(deviceCheck.checkedAt);

  return (
    <div className="rounded-2xl border border-theme bg-transparent p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-primary">Voice readiness</h4>
          <p className="mt-1 text-xs text-faint">Check browser support, microphone input, and speaker output before starting Voice Mode.</p>
          {checkedAtLabel ? <p className="mt-1 text-xs text-gray-400">Last checked: {checkedAtLabel}</p> : null}
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', isMicReady ? '[background:var(--accent-glow)] text-accent' : 'bg-yellow-50 text-yellow-700')}>{statusLabel}</span>
      </div>
      <div className="space-y-3">
        <DeviceStatusRow icon={AlertCircle} label="Browser" status={deviceCheck.browser?.status || 'idle'} detail="HTTPS/localhost, MediaDevices, AudioContext, and WebSocket are required." error={deviceCheck.browser?.error || deviceCheck.deviceState?.message} />
        <DeviceStatusRow icon={Mic} label="Microphone" status={deviceCheck.mic.status} detail={deviceCheck.mic.deviceLabel || 'Required for voice interview.'} error={deviceCheck.mic.error} />
        <DeviceStatusRow icon={Volume2} label="Speaker" status={deviceCheck.speaker.status} detail="You should hear a short tone after running the test." error={deviceCheck.speaker.error} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="rounded-full border border-emerald-200 glass px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60" onClick={checkMicrophone} disabled={deviceCheck.mic.status === 'checking'}>Check Microphone</button>
        <button type="button" className="rounded-full border border-emerald-200 glass px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60" onClick={checkSpeaker} disabled={deviceCheck.speaker.status === 'checking'}>Play Speaker Test</button>
        {deviceCheck.speaker.status === 'needs_confirmation' ? (
          <>
            <button type="button" className="rounded-full border border-emerald-200 glass px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50" onClick={confirmSpeakerHeard}>I heard it</button>
            <button type="button" className="rounded-full border border-red-200 glass px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50" onClick={confirmSpeakerNotHeard}>I did not hear it</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
