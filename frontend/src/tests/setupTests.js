/**
 * File responsibility: Frontend test runtime setup.
 * Main responsibilities:
 * - Install browser API shims needed by voice tests.
 * - Keep global mocks small and predictable.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:test-audio');
}
if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = vi.fn();
}
if (!globalThis.atob) {
  globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary');
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
