import { describe, expect, it, vi } from 'vitest';
import { createRecordingUploadRegistry } from '../recordingUploadRegistry.js';

describe('recording upload registry', () => {
  it('reuses one manager per session across interview and report pages', () => {
    const manager = { start: vi.fn(), stop: vi.fn() };
    const managerFactory = vi.fn(() => manager);
    const registry = createRecordingUploadRegistry({ managerFactory, store: {} });

    const interviewManager = registry.getOrCreate('session-1');
    const reportManager = registry.getOrCreate('session-1');

    expect(interviewManager).toBe(reportManager);
    expect(managerFactory).toHaveBeenCalledTimes(1);
  });

  it('updates the voice priority state without replacing the manager', () => {
    let readPriorityState;
    const managerFactory = vi.fn((options) => {
      readPriorityState = options.getVoicePriorityState;
      return {};
    });
    const registry = createRecordingUploadRegistry({ managerFactory, store: {} });
    registry.getOrCreate('session-1');

    registry.setVoicePriorityState('session-1', 'user_speaking');

    expect(readPriorityState()).toBe('user_speaking');
  });
});
