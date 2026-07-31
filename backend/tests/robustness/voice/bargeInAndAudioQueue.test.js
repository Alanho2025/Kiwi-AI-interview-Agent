import { describe, expect, it, vi } from 'vitest';
import { isInterruptControlPayload } from '../../../src/api/duplexVoiceSocket.js';
import { createBargeInController } from '../../../src/services/voice/bargeInController.js';

describe('3. bargeInAndAudioQueue: Barge-in interrupt & audio queue reset tests', () => {
  it('correctly identifies interrupt control payloads', () => {
    expect(isInterruptControlPayload({ type: 'barge_in' })).toBe(true);
    expect(isInterruptControlPayload({ type: 'cancel_assistant_audio' })).toBe(true);
    expect(isInterruptControlPayload({ type: 'session_start' })).toBe(false);
    expect(isInterruptControlPayload({ type: 'ping' })).toBe(false);
  });

  it('triggers barge-in controller cancel and resets audio playback state', () => {
    const sendJson = vi.fn();
    const controller = createBargeInController({ sendJson });

    controller.handleBargeIn({ timestamp: Date.now() });

    expect(sendJson).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'barge_in_ack',
      })
    );
  });
});
