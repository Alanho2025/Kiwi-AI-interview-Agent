import { describe, expect, it } from 'vitest';

import { shouldUseSingleBlockingLlmVoicePath } from '../../../src/services/masterAiService.js';

describe('voice single blocking LLM policy', () => {
  it('applies the one-blocking-LLM live policy to realtime voice modes only', () => {
    expect(shouldUseSingleBlockingLlmVoicePath({ inputMode: 'duplex_voice' })).toBe(true);
    expect(shouldUseSingleBlockingLlmVoicePath({ inputMode: 'realtime_voice' })).toBe(true);
    expect(shouldUseSingleBlockingLlmVoicePath({ inputMode: 'text' })).toBe(false);
    expect(shouldUseSingleBlockingLlmVoicePath({ inputMode: '' })).toBe(false);
  });
});
