import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('cross-role product copy', () => {
  it('uses role-specific language on landing, login, and onboarding', () => {
    const landing = source('../../pages/LandingPage.jsx');
    const login = source('../../pages/Login.jsx');
    const home = source('../../pages/HomePage.jsx');

    expect(landing).toContain('Role-specific deep-dives');
    expect(landing).not.toContain('Mid-level technical deep-dives');
    expect(login).toContain('NZ job interview');
    expect(login).not.toContain('NZ Tech Interview');
    expect(home).toContain('your next interview');
    expect(home).not.toContain('your next Tech Interview');
  });
});
