import { describe, expect, it } from 'vitest';
import { buildDuplexSocketUrl } from '../voice/useDuplexVoiceSocket.js';

describe('useDuplexVoiceSocket URL builder & event contracts', () => {
  it('builds duplex socket URL with language and sample rate parameters', () => {
    const url = buildDuplexSocketUrl({
      sessionId: 'session_123',
      language: 'en-NZ',
      sampleRate: 16000,
    });
    expect(url).toContain('interview/session_123/voice/duplex');
    expect(url).toContain('language=en-NZ');
    expect(url).toContain('sampleRate=16000');
  });
});
