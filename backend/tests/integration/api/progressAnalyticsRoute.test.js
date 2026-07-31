import { describe, it, expect } from 'vitest';
import sessionRoutes from '../../../src/api/routes/sessionRoutes.js';


describe('sessionRoutes Route Ordering Integration Test', () => {
  it('registers /progress-analytics before /:sessionId in stack', () => {
    const stack = sessionRoutes.stack || [];
    const routes = stack.map((layer) => ({
      path: layer.route?.path,
      method: Object.keys(layer.route?.methods || {})[0],
    }));

    const progressIdx = routes.findIndex((r) => r.path === '/progress-analytics');
    const paramIdx = routes.findIndex((r) => r.path === '/:sessionId');

    expect(progressIdx).toBeGreaterThan(-1);
    expect(paramIdx).toBeGreaterThan(-1);
    expect(progressIdx).toBeLessThan(paramIdx);
  });
});
