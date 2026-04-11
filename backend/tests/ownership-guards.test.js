import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('interview controller uses owned-session loading for every session-bound endpoint', async () => {
  const source = await readSource('src/controllers/interviewController.js');

  assert.match(source, /loadOwnedSessionOrThrow/);
  assert.doesNotMatch(source, /loadSessionOrThrow/);

  const ownedLoadUsages = source.match(/loadOwnedSessionOrThrow\(\{ sessionId, userId: user\.id \}\)/g) || [];
  assert.equal(ownedLoadUsages.length, 6);
});

test('interview session service loads sessions through ownership-aware lookup', async () => {
  const source = await readSource('src/services/interview/interviewSessionService.js');

  assert.match(source, /getOwnedSessionById/);
  assert.match(source, /getOwnedSessionById\(sessionId, userId\)/);
  assert.doesNotMatch(source, /getSessionById/);
});

test('report controller validates ownership before generate, qa, and get', async () => {
  const source = await readSource('src/controllers/reportController.js');

  const ownershipChecks = source.match(/getOwnedSessionById\(sessionId, user\.id\)/g) || [];
  assert.equal(ownershipChecks.length, 3);
  assert.match(source, /generate this report/);
  assert.match(source, /QA this report/);
  assert.match(source, /view this report/);
});
