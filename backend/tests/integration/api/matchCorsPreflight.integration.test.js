import express from 'express';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const frontendOrigin = 'https://frontend.example.test';
const originalEnv = {
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  JWT_SECRET: process.env.JWT_SECRET,
};

const listen = (server) => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const closeServer = (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

const restoreEnv = () => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
};

describe('Match stream CORS preflight', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    process.env.FRONTEND_ORIGIN = frontendOrigin;
    process.env.GOOGLE_CLIENT_ID = 'cors-test-google-client';
    process.env.JWT_SECRET = 'cors-test-jwt-secret';
    vi.resetModules();

    const api = (await import('../../../src/api.js')).default;
    const app = express();
    app.use('/api', api);
    server = http.createServer(app);
    const port = await listen(server);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    if (server?.listening) await closeServer(server);
    restoreEnv();
  });

  it('allows the request ID header used by the Match stream client', async () => {
    const response = await fetch(`${baseUrl}/api/analyze/match/stream`, {
      method: 'OPTIONS',
      headers: {
        Origin: frontendOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-match-request-id',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(frontendOrigin);
    expect(response.headers.get('access-control-allow-headers')).toContain('X-Match-Request-Id');
  });
});
