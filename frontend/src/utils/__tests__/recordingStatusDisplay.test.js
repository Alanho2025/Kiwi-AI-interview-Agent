import { describe, expect, it } from 'vitest';
import { getRecordingStatusLabel } from '../recordingStatusDisplay.js';

describe('recording status display', () => {
  it.each([
    ['captured_locally', 'Recording saved on this device'],
    ['uploading', 'Uploading recording — 40%'],
    ['waiting_for_network', 'Waiting for connection'],
    ['processing', 'Processing recording'],
    ['ready', 'Recording ready'],
    ['recoverable_failed', 'Recording upload needs attention'],
  ])('maps %s to an actionable label', (state, expected) => {
    expect(getRecordingStatusLabel({ state, progressPercent: 40 }, true)).toBe(expected);
  });

  it('keeps the pre-completion availability label', () => {
    expect(getRecordingStatusLabel({ state: 'recording' }, false)).toBe('Available after the session ends');
  });
});
