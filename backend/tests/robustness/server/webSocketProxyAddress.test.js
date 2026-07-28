import { afterEach, describe, expect, it } from 'vitest';

import { resolveWebSocketClientAddress } from '../../../src/api/webSocketSecurity.js';

const originalTrustProxyHops = process.env.TRUST_PROXY_HOPS;

const buildRequest = ({
  remoteAddress = '198.51.100.20',
  forwardedFor,
} = {}) => ({
  headers: forwardedFor === undefined
    ? {}
    : { 'x-forwarded-for': forwardedFor },
  socket: { remoteAddress },
});

afterEach(() => {
  if (originalTrustProxyHops === undefined) {
    delete process.env.TRUST_PROXY_HOPS;
    return;
  }

  process.env.TRUST_PROXY_HOPS = originalTrustProxyHops;
});

describe('WebSocket proxy client address resolution', () => {
  it('uses the direct socket address when trusted proxy handling is disabled', () => {
    delete process.env.TRUST_PROXY_HOPS;
    const request = buildRequest({
      remoteAddress: '198.51.100.20',
      forwardedFor: '203.0.113.90',
    });

    expect(resolveWebSocketClientAddress(request)).toBe('198.51.100.20');
  });

  it('uses the right-most forwarded address when exactly one proxy hop is trusted', () => {
    process.env.TRUST_PROXY_HOPS = '1';
    const request = buildRequest({
      remoteAddress: '172.17.0.1',
      forwardedFor: '192.0.2.99, 203.0.113.40',
    });

    expect(resolveWebSocketClientAddress(request)).toBe('203.0.113.40');
  });

  it('does not trust a spoofed forwarded address for unsupported hop settings', () => {
    process.env.TRUST_PROXY_HOPS = '2';
    const request = buildRequest({
      remoteAddress: '198.51.100.21',
      forwardedFor: '203.0.113.91',
    });

    expect(resolveWebSocketClientAddress(request)).toBe('198.51.100.21');
  });

  it('falls back to the socket address when the trusted forwarded value is invalid', () => {
    process.env.TRUST_PROXY_HOPS = '1';
    const request = buildRequest({
      remoteAddress: '172.17.0.1',
      forwardedFor: 'not-an-ip',
    });

    expect(resolveWebSocketClientAddress(request)).toBe('172.17.0.1');
  });
});
