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
if (!globalThis.SpeechSynthesisUtterance) {
  globalThis.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  };
}
if (!window.speechSynthesis) {
  window.speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn((utterance) => {
      utterance.onstart?.();
      utterance.onend?.();
    }),
    getVoices: vi.fn(() => [{ lang: 'en-NZ', name: 'Test NZ Voice' }]),
  };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
