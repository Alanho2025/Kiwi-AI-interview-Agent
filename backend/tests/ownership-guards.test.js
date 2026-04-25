import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const readSource = async (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

describe('ownership guards', () => {
  it('interview controller uses owned-session loading for every session-bound endpoint', async () => {
    const source = await readSource('src/controllers/interviewController.js');

    expect(source).toMatch(/loadOwnedSessionOrThrow/);
    expect(source).not.toMatch(/loadSessionOrThrow/);

    const ownedLoadUsages = source.match(/loadOwnedSessionOrThrow\(\{ sessionId, userId: user\.id \}\)/g) || [];
    expect(ownedLoadUsages.length).toBe(7);
  });

  it('interview session service loads sessions through ownership-aware lookup', async () => {
    const source = await readSource('src/services/interview/interviewSessionService.js');

    expect(source).toMatch(/getOwnedSessionById/);
    expect(source).toMatch(/getOwnedSessionById\(sessionId, userId\)/);
    expect(source).not.toMatch(/getSessionById/);
  });

  it('report controller validates ownership before generate, qa, get, and export', async () => {
    const source = await readSource('src/controllers/reportController.js');

    const ownershipChecks = source.match(/getOwnedSessionById\(sessionId, user\.id\)/g) || [];
    expect(ownershipChecks.length).toBe(4);
    expect(source).toMatch(/generate this report/);
    expect(source).toMatch(/QA this report/);
    expect(source).toMatch(/view this report/);
    expect(source).toMatch(/export this report/);
  });
});
