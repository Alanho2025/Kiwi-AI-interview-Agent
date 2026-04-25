import { describe, expect, it } from 'vitest';
import { isAllowedVoiceFile } from '../../../src/middleware/voiceUploadMiddleware.js';

describe('voice upload middleware helpers', () => {
  it('accepts WAV files by extension or MIME type', () => {
    expect(isAllowedVoiceFile({ originalname: 'answer.wav', mimetype: 'application/octet-stream' })).toBe(true);
    expect(isAllowedVoiceFile({ originalname: 'answer.bin', mimetype: 'audio/wav' })).toBe(true);
    expect(isAllowedVoiceFile({ originalname: 'answer.bin', mimetype: 'audio/x-wav' })).toBe(true);
  });

  it('rejects non-WAV files before they reach the voice controller', () => {
    expect(isAllowedVoiceFile({ originalname: 'answer.mp3', mimetype: 'audio/mpeg' })).toBe(false);
    expect(isAllowedVoiceFile({ originalname: '../answer.txt', mimetype: 'text/plain' })).toBe(false);
  });
});
