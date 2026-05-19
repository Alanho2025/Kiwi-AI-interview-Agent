import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';

import { optionalAuth } from '../../../src/middleware/authMiddleware.js';
import { csrfProtection } from '../../../src/middleware/csrfMiddleware.js';

const createResponse = () => ({
  status: vi.fn(function status() { return this; }),
  json: vi.fn(function json() { return this; }),
});

describe('auth fallback robustness', () => {
  it('accepts Authorization bearer tokens when the auth cookie is unavailable', () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET);
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const next = vi.fn();

    optionalAuth(req, createResponse(), next);

    expect(req.user).toEqual({ id: 'user-123' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not require a CSRF cookie for the Google login token exchange', () => {
    const req = {
      method: 'POST',
      path: '/auth/google',
      headers: {},
    };
    const res = createResponse();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not require a CSRF cookie for bearer-authenticated unsafe requests', () => {
    const req = {
      method: 'POST',
      path: '/interview/start',
      headers: {
        authorization: 'Bearer token-123',
      },
    };
    const res = createResponse();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
