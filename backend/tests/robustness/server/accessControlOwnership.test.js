import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

describe('access control ownership contracts', () => {
  it('keeps owned session lookups constrained by both session id and user id', () => {
    const sessionSharedSource = read('src/services/session/sessionShared.js');

    expect(sessionSharedSource).toMatch(/fetchOwnedSessionRowById/);
    expect(sessionSharedSource).toMatch(/WHERE id = \$1 AND user_id = \$2 AND deleted_at IS NULL LIMIT 1/);
  });

  it('requires ownership checks before report view, generation, QA, and export', () => {
    const reportControllerSource = read('src/controllers/reportController.js');

    for (const functionName of ['generateReport', 'qaReport', 'getReport', 'exportReport']) {
      const functionStart = reportControllerSource.indexOf(`export const ${functionName}`);
      expect(functionStart).toBeGreaterThanOrEqual(0);
      const nextFunctionStart = reportControllerSource.indexOf('\nexport const ', functionStart + 1);
      const functionSource = reportControllerSource.slice(
        functionStart,
        nextFunctionStart === -1 ? reportControllerSource.length : nextFunctionStart,
      );

      expect(functionSource).toContain('resolveUserFromRequest(req)');
      expect(functionSource).toContain('getOwnedSessionById(sessionId, user.id)');
      expect(functionSource).toContain('access denied');
    }
  });

  it('loads duplex voice sessions through user-owned session lookup', () => {
    const socketSource = read('src/api/duplexVoiceSocket.js');
    const interviewSessionServiceSource = read('src/services/interview/interviewSessionService.js');

    expect(socketSource).toContain('const userId = context.auth?.id');
    expect(socketSource).toContain('loadOwnedSessionOrThrow({ sessionId: context.sessionId, userId })');
    expect(interviewSessionServiceSource).toContain('getOwnedSessionById(sessionId, userId)');
    expect(interviewSessionServiceSource).toContain('Session not found or access denied');
  });
});
