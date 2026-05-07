import { describe, expect, it } from 'vitest';
import { isAllowedAudioUpload } from '../../../src/api/routes/recordingRoutes.js';

describe('recording upload guard', () => {
  it('accepts browser audio recordings and rejects arbitrary files', () => {
    expect(isAllowedAudioUpload({ originalname: 'session.webm', mimetype: 'audio/webm' })).toBe(true);
    expect(isAllowedAudioUpload({ originalname: 'session.m4a', mimetype: 'audio/mp4' })).toBe(true);
    expect(isAllowedAudioUpload({ originalname: 'payload.js', mimetype: 'application/javascript' })).toBe(false);
    expect(isAllowedAudioUpload({ originalname: 'session.webm', mimetype: 'application/octet-stream' })).toBe(false);
  });
});
