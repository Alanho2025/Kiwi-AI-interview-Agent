import { Button } from '../common/Button.jsx';

const getStatusText = ({ state, progressPercent }) => {
  switch (state) {
    case 'captured_locally':
    case 'locally_durable':
      return 'Recording saved on this device';
    case 'uploading':
      return `Uploading recording${Number.isFinite(progressPercent) ? ` — ${progressPercent}%` : ''}`;
    case 'waiting_for_network':
      return 'Waiting for connection';
    case 'queued':
    case 'processing':
      return 'Processing recording';
    case 'ready':
      return 'Recording ready';
    case 'recoverable_failed':
      return 'Recording upload needs attention';
    case 'failed':
      return 'Recording could not be prepared';
    case 'missing':
      return 'No recording is available yet';
    default:
      return 'Checking recording status';
  }
};

export function RecordingStatusCard({ recordingStatus = {}, onRetry }) {
  const progressPercent = Number.isFinite(recordingStatus.progressPercent)
    ? recordingStatus.progressPercent
    : null;
  const serverDurable = recordingStatus.serverDurable
    || ['queued', 'processing', 'ready'].includes(recordingStatus.state);
  const canRetry = recordingStatus.state === 'recoverable_failed' && recordingStatus.retryable && onRetry;

  return (
    <section className="rounded-2xl border border-theme glass p-4 shadow-sm" aria-label="Voice recording status">
      <div role="status" aria-live="polite">
        <p className="text-sm font-semibold text-primary">
          {getStatusText({ state: recordingStatus.state, progressPercent })}
        </p>
        {recordingStatus.state === 'waiting_for_network' ? (
          <p className="mt-1 text-xs text-muted">Upload will resume automatically when the connection returns.</p>
        ) : null}
        {serverDurable ? (
          <p className="mt-1 text-xs text-emerald-700">Recording uploaded safely. It is safe to close this page.</p>
        ) : null}
      </div>
      {progressPercent != null && recordingStatus.state === 'uploading' ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200" aria-label={`Recording upload ${progressPercent}%`}>
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      ) : null}
      {recordingStatus.error ? <p className="mt-2 text-xs text-red-600">{recordingStatus.error.message || recordingStatus.error}</p> : null}
      {canRetry ? (
        <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
          Retry recording upload
        </Button>
      ) : null}
    </section>
  );
}
