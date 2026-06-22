export const getRecordingStatusLabel = (recordingStatus = {}, isCompleted = true) => {
  if (!isCompleted) return 'Available after the session ends';
  switch (recordingStatus.state) {
    case 'captured_locally':
    case 'locally_durable':
      return 'Recording saved on this device';
    case 'uploading':
      return `Uploading recording${Number.isFinite(recordingStatus.progressPercent) ? ` — ${recordingStatus.progressPercent}%` : ''}`;
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
    default:
      return 'Recording is still being processed';
  }
};
