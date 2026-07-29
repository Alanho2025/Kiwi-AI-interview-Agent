import { describe, expect, it } from 'vitest';

import { sanitizeSessionSettings, seniorityOptions } from '../sessionSettings.js';

describe('sessionSettings seniority compatibility', () => {
  it('uses Senior in new payloads and maps old Advanced defaults forward', () => {
    expect(seniorityOptions).toContain('Senior');
    expect(sanitizeSessionSettings({ seniorityLevel: 'Senior' }).seniorityLevel).toBe('Senior');
    expect(sanitizeSessionSettings({ seniorityLevel: 'Advanced' }).seniorityLevel).toBe('Senior');
  });
});
