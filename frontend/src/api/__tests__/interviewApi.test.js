import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.hoisted(() => vi.fn());

vi.mock('../client.js', () => ({ apiClient }));

import { replyInterview } from '../interviewApi.js';

describe('interviewApi reply correlation', () => {
  beforeEach(() => {
    apiClient.mockReset();
    apiClient.mockResolvedValue({ session: {} });
  });

  it('sends a client turn id without changing the public function signature', async () => {
    await replyInterview('session-text-1', 'My answer');

    expect(apiClient).toHaveBeenCalledWith('/interview/reply', {
      method: 'POST',
      body: {
        sessionId: 'session-text-1',
        answer: 'My answer',
        clientTurnId: expect.stringMatching(/^(?:[0-9a-f-]{36}|text-turn-\d+)$/),
      },
    });
  });
});
