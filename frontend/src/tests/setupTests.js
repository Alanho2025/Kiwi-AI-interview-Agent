/**
 * File responsibility: Frontend test runtime setup.
 * Main responsibilities:
 * - Install browser API shims needed by voice tests.
 * - Keep global mocks small and predictable.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

const createMemoryStorage = () => {
  const values = new Map();

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key) => values.get(String(key)) ?? null),
    key: vi.fn((index) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key) => values.delete(String(key))),
    setItem: vi.fn((key, value) => values.set(String(key), String(value))),
  };
};

const installLocalStorageShim = () => {
  if (globalThis.window?.localStorage) return;

  const storage = createMemoryStorage();
  Object.defineProperty(globalThis.window, 'localStorage', {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
};

installLocalStorageShim();

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
  window.localStorage?.clear?.();
});
