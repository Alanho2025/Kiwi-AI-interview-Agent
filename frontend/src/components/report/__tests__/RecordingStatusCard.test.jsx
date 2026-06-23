import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecordingStatusCard } from '../RecordingStatusCard.jsx';

describe('RecordingStatusCard', () => {
  it.each([
    ['captured_locally', 'Recording saved on this device'],
    ['uploading', 'Uploading recording — 65%'],
    ['waiting_for_network', 'Waiting for connection'],
    ['queued', 'Processing recording'],
    ['processing', 'Processing recording'],
    ['ready', 'Recording ready'],
  ])('renders accessible status for %s', (state, expected) => {
    render(<RecordingStatusCard recordingStatus={{ state, progressPercent: 65, available: state === 'ready' }} />);

    expect(screen.getByRole('status')).toHaveTextContent(expected);
  });

  it('shows safe-close guidance only after the server has the complete recording', () => {
    const { rerender } = render(<RecordingStatusCard recordingStatus={{ state: 'locally_durable', available: false }} />);
    expect(screen.queryByText(/safe to close/i)).not.toBeInTheDocument();

    rerender(<RecordingStatusCard recordingStatus={{ state: 'processing', available: false, serverDurable: true }} />);
    expect(screen.getByText(/safe to close/i)).toBeInTheDocument();
  });

  it('offers retry only for recoverable failures', () => {
    const onRetry = vi.fn();
    render(<RecordingStatusCard recordingStatus={{ state: 'recoverable_failed', retryable: true }} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /retry recording upload/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
