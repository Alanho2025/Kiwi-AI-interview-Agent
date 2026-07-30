import { describe, expect, it } from 'vitest';

import { resolveStoredSeniorityLevel } from '../../../src/services/session/sessionLifecycleService.js';

describe('session lifecycle seniority persistence', () => {
  it('stores new session seniority with the canonical policy key while accepting legacy display labels', () => {
    expect(resolveStoredSeniorityLevel('Senior')).toBe('senior');
    expect(resolveStoredSeniorityLevel('Advanced')).toBe('senior');
    expect(resolveStoredSeniorityLevel('Junior/Grad')).toBe('junior');
  });
});
