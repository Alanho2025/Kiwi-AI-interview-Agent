/**
 * File responsibility: Per-session turn lock.
 * Main responsibilities:
 * - Prevent duplicate auto-submit events from generating overlapping interview turns.
 * - Preserve question order when realtime STT fallback and final events arrive close together.
 */

const locks = new Map();

export const withSessionTurnLock = async (sessionId, task) => {
  if (!sessionId) {
    return task();
  }

  const previous = locks.get(sessionId) || Promise.resolve();
  let releaseCurrent;
  const current = new Promise((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = previous.then(() => current);

  locks.set(sessionId, tail);
  await previous;

  try {
    return await task();
  } finally {
    releaseCurrent();
    if (locks.get(sessionId) === tail) {
      locks.delete(sessionId);
    }
  }
};
