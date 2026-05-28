/**
 * Tests for useTheme hook
 * 
 * Behavior Contract:
 * - Hook manages dark/light theme state
 * - Persists theme preference to localStorage
 * - Updates DOM class for theme styling
 * - Defaults to light mode
 * - Provides toggle function
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTheme } from '../useTheme.js';

describe('useTheme', () => {
    const STORAGE_KEY = 'kiwi-theme';

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove('dark');
    });

    afterEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove('dark');
    });

    describe('Initialization', () => {
        it('should default to light mode', () => {
            const { result } = renderHook(() => useTheme());

            expect(result.current.isDark).toBe(false);
            expect(document.documentElement.classList.contains('dark')).toBe(false);
        });

        it('should load dark mode from localStorage', () => {
            localStorage.setItem(STORAGE_KEY, 'dark');

            const { result } = renderHook(() => useTheme());

            expect(result.current.isDark).toBe(true);
            expect(document.documentElement.classList.contains('dark')).toBe(true);
        });

        it('should load light mode from localStorage', () => {
            localStorage.setItem(STORAGE_KEY, 'light');

            const { result } = renderHook(() => useTheme());

            expect(result.current.isDark).toBe(false);
            expect(document.documentElement.classList.contains('dark')).toBe(false);
        });

        it('should default to light mode when localStorage value is invalid', () => {
            localStorage.setItem(STORAGE_KEY, 'invalid-value');

            const { result } = renderHook(() => useTheme());

            expect(result.current.isDark).toBe(false);
        });
    });

    describe('Theme Toggle', () => {
        it('should toggle from light to dark', () => {
            const { result } = renderHook(() => useTheme());

            expect(result.current.isDark).toBe(false);

            act(() => {
                result.current.toggleTheme();
            });

            expect(result.current.isDark).toBe(true);
            expect(document.documentElement.classList.contains('dark')).toBe(true);
            expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
        });

        it('should toggle from dark to light', () => {
            localStorage.setItem(STORAGE_KEY, 'dark');

            const { result } = renderHook(() => useTheme());

            expect(result.current.isDark).toBe(true);

            act(() => {
                result.current.toggleTheme();
            });

            expect(result.current.isDark).toBe(false);
            expect(document.documentElement.classList.contains('dark')).toBe(false);
            expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
        });

        it('should support multiple toggles', () => {
            const { result } = renderHook(() => useTheme());

            act(() => {
                result.current.toggleTheme();
            });
            expect(result.current.isDark).toBe(true);

            act(() => {
                result.current.toggleTheme();
            });
            expect(result.current.isDark).toBe(false);

            act(() => {
                result.current.toggleTheme();
            });
            expect(result.current.isDark).toBe(true);
        });
    });

    describe('DOM Updates', () => {
        it('should add dark class when toggling to dark mode', () => {
            const { result } = renderHook(() => useTheme());

            act(() => {
                result.current.toggleTheme();
            });

            expect(document.documentElement.classList.contains('dark')).toBe(true);
        });

        it('should remove dark class when toggling to light mode', () => {
            localStorage.setItem(STORAGE_KEY, 'dark');

            const { result } = renderHook(() => useTheme());

            expect(document.documentElement.classList.contains('dark')).toBe(true);

            act(() => {
                result.current.toggleTheme();
            });

            expect(document.documentElement.classList.contains('dark')).toBe(false);
        });
    });

    describe('localStorage Persistence', () => {
        it('should update localStorage when toggling theme', () => {
            const { result } = renderHook(() => useTheme());

            act(() => {
                result.current.toggleTheme();
            });

            expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

            act(() => {
                result.current.toggleTheme();
            });

            expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
        });

        it('should set localStorage on initialization', () => {
            renderHook(() => useTheme());

            expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
        });
    });

    describe('toggleTheme Function Stability', () => {
        it('should maintain stable reference for toggleTheme function', () => {
            const { result, rerender } = renderHook(() => useTheme());

            const firstToggle = result.current.toggleTheme;

            rerender();

            expect(result.current.toggleTheme).toBe(firstToggle);
        });
    });
});

// Made with Bob
