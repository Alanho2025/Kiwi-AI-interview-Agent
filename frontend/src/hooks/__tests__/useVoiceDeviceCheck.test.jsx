/**
 * Tests for useVoiceDeviceCheck hook
 * 
 * Behavior Contract:
 * - Hook checks browser support, microphone, and speaker readiness
 * - Detects secure context requirements (HTTPS or localhost)
 * - Validates microphone permission and input level
 * - Tests speaker output with confirmation flow
 * - Monitors device changes and marks checks as stale
 * - Provides comprehensive status labels
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVoiceDeviceCheck, DEFAULT_VOICE_DEVICE_CHECK } from '../useVoiceDeviceCheck.js';

describe('useVoiceDeviceCheck', () => {
    let mockMediaDevices;
    let mockAudioContext;
    let mockWebSocket;

    beforeEach(() => {
        // Mock navigator.mediaDevices
        mockMediaDevices = {
            getUserMedia: vi.fn(),
            enumerateDevices: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };

        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: mockMediaDevices,
        });

        // Mock AudioContext
        mockAudioContext = vi.fn().mockImplementation(() => ({
            state: 'running',
            createAnalyser: vi.fn(() => ({
                fftSize: 1024,
                frequencyBinCount: 512,
                connect: vi.fn(),
                disconnect: vi.fn(),
                getByteTimeDomainData: vi.fn((data) => {
                    // Simulate audio data
                    for (let i = 0; i < data.length; i++) {
                        data[i] = 128 + Math.random() * 20;
                    }
                }),
            })),
            createMediaStreamSource: vi.fn(() => ({
                connect: vi.fn(),
                disconnect: vi.fn(),
            })),
            createOscillator: vi.fn(() => ({
                type: 'sine',
                frequency: { value: 0 },
                connect: vi.fn(),
                disconnect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
            })),
            createGain: vi.fn(() => ({
                gain: { value: 0 },
                connect: vi.fn(),
                disconnect: vi.fn(),
            })),
            destination: {},
            resume: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
        }));

        window.AudioContext = mockAudioContext;
        window.webkitAudioContext = mockAudioContext;

        // Mock WebSocket
        mockWebSocket = vi.fn();
        global.WebSocket = mockWebSocket;

        // Mock window.isSecureContext
        Object.defineProperty(window, 'isSecureContext', {
            configurable: true,
            value: true,
        });

        // Mock window.location
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { hostname: 'localhost' },
        });

        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            expect(result.current.deviceCheck).toEqual(DEFAULT_VOICE_DEVICE_CHECK);
            expect(result.current.isBrowserReady).toBe(false);
            expect(result.current.isMicReady).toBe(false);
            expect(result.current.isSpeakerChecked).toBe(false);
            expect(result.current.isStale).toBe(false);
        });

        it('should accept custom initial state', () => {
            const customStatus = {
                browser: { status: 'ok', error: '' },
                mic: { status: 'ok', deviceLabel: 'Test Mic', inputLevel: 0.5, error: '' },
            };

            const { result } = renderHook(() => useVoiceDeviceCheck(customStatus));

            expect(result.current.deviceCheck.browser.status).toBe('ok');
            expect(result.current.deviceCheck.mic.status).toBe('ok');
        });
    });

    describe('Browser Check', () => {
        it('should pass check in supported browser', () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            act(() => {
                result.current.checkBrowser();
            });

            expect(result.current.deviceCheck.browser.status).toBe('ok');
            expect(result.current.isBrowserReady).toBe(true);
        });

        it('should fail in insecure context (non-localhost)', () => {
            Object.defineProperty(window, 'isSecureContext', {
                configurable: true,
                value: false,
            });
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: { hostname: 'example.com' },
            });

            const { result } = renderHook(() => useVoiceDeviceCheck());

            act(() => {
                result.current.checkBrowser();
            });

            expect(result.current.deviceCheck.browser.status).toBe('insecure_context');
            expect(result.current.deviceCheck.browser.error).toContain('HTTPS');
            expect(result.current.isBrowserReady).toBe(false);
        });

        it('should fail when getUserMedia is missing', () => {
            Object.defineProperty(navigator, 'mediaDevices', {
                configurable: true,
                value: { enumerateDevices: vi.fn() },
            });

            const { result } = renderHook(() => useVoiceDeviceCheck());

            act(() => {
                result.current.checkBrowser();
            });

            expect(result.current.deviceCheck.browser.status).toBe('unsupported');
            expect(result.current.isBrowserReady).toBe(false);
        });

        it('should fail when AudioContext is missing', () => {
            delete window.AudioContext;
            delete window.webkitAudioContext;

            const { result } = renderHook(() => useVoiceDeviceCheck());

            act(() => {
                result.current.checkBrowser();
            });

            expect(result.current.deviceCheck.browser.status).toBe('unsupported');
            expect(result.current.deviceCheck.browser.error).toContain('AudioContext');
        });

        it('should fail when WebSocket is missing', () => {
            delete global.WebSocket;

            const { result } = renderHook(() => useVoiceDeviceCheck());

            act(() => {
                result.current.checkBrowser();
            });

            expect(result.current.deviceCheck.browser.status).toBe('unsupported');
            expect(result.current.deviceCheck.browser.error).toContain('WebSocket');
        });
    });

    describe('Microphone Check', () => {
        it('should successfully check microphone', async () => {
            const mockStream = {
                getTracks: () => [{ stop: vi.fn() }],
            };

            mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
            mockMediaDevices.enumerateDevices.mockResolvedValue([
                { kind: 'audioinput', label: 'Built-in Microphone' },
            ]);

            const { result } = renderHook(() => useVoiceDeviceCheck());

            // Run checkMicrophone and advance timers concurrently
            await act(async () => {
                const checkPromise = result.current.checkMicrophone();
                // Advance timers to allow sampleInputLevel to complete
                await vi.advanceTimersByTimeAsync(1500);
                await checkPromise;
            });

            expect(result.current.deviceCheck.mic.status).toBe('ok');
            expect(result.current.deviceCheck.mic.deviceLabel).toBe('Built-in Microphone');
            expect(result.current.isMicReady).toBe(true);
        });

        it('should detect silent microphone', async () => {
            const mockStream = {
                getTracks: () => [{ stop: vi.fn() }],
            };

            mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
            mockMediaDevices.enumerateDevices.mockResolvedValue([
                { kind: 'audioinput', label: 'Microphone' },
            ]);

            // Mock analyser to return silent data
            mockAudioContext.mockImplementation(() => ({
                createAnalyser: vi.fn(() => ({
                    fftSize: 1024,
                    frequencyBinCount: 512,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                    getByteTimeDomainData: vi.fn((data) => {
                        for (let i = 0; i < data.length; i++) {
                            data[i] = 128; // Silent
                        }
                    }),
                })),
                createMediaStreamSource: vi.fn(() => ({
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                })),
                close: vi.fn().mockResolvedValue(undefined),
            }));

            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                const checkPromise = result.current.checkMicrophone();
                await vi.advanceTimersByTimeAsync(1500);
                await checkPromise;
            });

            expect(result.current.deviceCheck.mic.status).toBe('silent');
            expect(result.current.deviceCheck.mic.error).toContain('no input level');
        });

        it('should handle denied microphone permission', async () => {
            const error = new DOMException('Permission denied', 'NotAllowedError');
            mockMediaDevices.getUserMedia.mockRejectedValue(error);

            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                await result.current.checkMicrophone();
            });

            expect(result.current.deviceCheck.mic.status).toBe('blocked');
            expect(result.current.deviceCheck.mic.error).toContain('blocked');
            expect(result.current.isMicReady).toBe(false);
        });

        it('should handle missing microphone', async () => {
            const error = new DOMException('No device found', 'NotFoundError');
            mockMediaDevices.getUserMedia.mockRejectedValue(error);

            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                await result.current.checkMicrophone();
            });

            expect(result.current.deviceCheck.mic.status).toBe('missing');
            expect(result.current.deviceCheck.mic.error).toContain('No microphone');
        });

        it('should handle microphone in use', async () => {
            const error = new DOMException('Device in use', 'NotReadableError');
            mockMediaDevices.getUserMedia.mockRejectedValue(error);

            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                await result.current.checkMicrophone();
            });

            expect(result.current.deviceCheck.mic.status).toBe('busy');
            expect(result.current.deviceCheck.mic.error).toContain('Another app');
        });

        it('should check browser support before checking microphone', async () => {
            delete window.AudioContext;
            delete window.webkitAudioContext;

            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                const success = await result.current.checkMicrophone();
                expect(success).toBe(false);
            });

            expect(mockMediaDevices.getUserMedia).not.toHaveBeenCalled();
        });
    });

    describe('Speaker Check', () => {
        it('should play test sound and wait for confirmation', async () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                const checkPromise = result.current.checkSpeaker();
                await vi.advanceTimersByTimeAsync(400);
                await checkPromise;
            });

            expect(result.current.deviceCheck.speaker.status).toBe('needs_confirmation');
            expect(result.current.deviceCheck.speaker.error).toContain('Confirm');
        });

        it('should handle user confirming heard test sound', async () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                const checkPromise = result.current.checkSpeaker();
                await vi.advanceTimersByTimeAsync(400);
                await checkPromise;
            });

            act(() => {
                result.current.confirmSpeakerHeard();
            });

            expect(result.current.deviceCheck.speaker.status).toBe('ok');
            expect(result.current.isSpeakerChecked).toBe(true);
        });

        it('should handle user not hearing test sound', async () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                const checkPromise = result.current.checkSpeaker();
                await vi.advanceTimersByTimeAsync(400);
                await checkPromise;
            });

            act(() => {
                result.current.confirmSpeakerNotHeard();
            });

            expect(result.current.deviceCheck.speaker.status).toBe('not_heard');
            expect(result.current.deviceCheck.speaker.error).toContain('not heard');
            expect(result.current.isSpeakerChecked).toBe(false);
        });

        it('should fail when AudioContext is unavailable', async () => {
            delete window.AudioContext;
            delete window.webkitAudioContext;

            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                await result.current.checkSpeaker();
            });

            expect(result.current.deviceCheck.speaker.status).toBe('error');
            expect(result.current.deviceCheck.speaker.error).toContain('does not support');
        });

        it('should handle AudioContext errors', async () => {
            mockAudioContext.mockImplementation(() => ({
                state: 'running',
                createOscillator: vi.fn(() => {
                    throw new Error('Audio error');
                }),
                close: vi.fn().mockResolvedValue(undefined),
            }));

            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                await result.current.checkSpeaker();
            });

            expect(result.current.deviceCheck.speaker.status).toBe('error');
        });
    });

    describe('Device Change Monitoring', () => {
        it('should listen for device change events', () => {
            renderHook(() => useVoiceDeviceCheck());

            expect(mockMediaDevices.addEventListener).toHaveBeenCalledWith(
                'devicechange',
                expect.any(Function)
            );
        });

        it('should mark as stale on device change', () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            const deviceChangeHandler = mockMediaDevices.addEventListener.mock.calls[0][1];

            act(() => {
                deviceChangeHandler();
            });

            expect(result.current.isStale).toBe(true);
            expect(result.current.deviceCheck.deviceState.message).toContain('device changed');
        });

        it('should remove event listener on unmount', () => {
            const { unmount } = renderHook(() => useVoiceDeviceCheck());

            unmount();

            expect(mockMediaDevices.removeEventListener).toHaveBeenCalledWith(
                'devicechange',
                expect.any(Function)
            );
        });
    });

    describe('Status Labels', () => {
        it('should show ready when all checks pass', async () => {
            const mockStream = {
                getTracks: () => [{ stop: vi.fn() }],
            };

            mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
            mockMediaDevices.enumerateDevices.mockResolvedValue([
                { kind: 'audioinput', label: 'Microphone' },
            ]);

            const { result } = renderHook(() => useVoiceDeviceCheck());

            await act(async () => {
                result.current.checkBrowser();
            });

            await act(async () => {
                const micPromise = result.current.checkMicrophone();
                await vi.advanceTimersByTimeAsync(1500);
                await micPromise;
            });

            await act(async () => {
                const speakerPromise = result.current.checkSpeaker();
                await vi.advanceTimersByTimeAsync(400);
                await speakerPromise;
            });

            act(() => {
                result.current.confirmSpeakerHeard();
            });

            expect(result.current.statusLabel).toContain('ready');
        });

        it('should show error when browser is unsupported', () => {
            delete window.AudioContext;
            delete window.webkitAudioContext;

            const { result } = renderHook(() => useVoiceDeviceCheck());

            act(() => {
                result.current.checkBrowser();
            });

            expect(result.current.statusLabel).toContain('does not support AudioContext');
        });

        it('should show stale message on device change', () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            const deviceChangeHandler = mockMediaDevices.addEventListener.mock.calls[0][1];

            act(() => {
                deviceChangeHandler();
            });

            expect(result.current.statusLabel).toContain('device changed');
        });
    });

    describe('State Updates', () => {
        it('should support manual device check state updates', () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            act(() => {
                result.current.setDeviceCheck({
                    browser: { status: 'ok', error: '' },
                    mic: { status: 'ok', deviceLabel: 'Custom Mic', inputLevel: 0.5, error: '' },
                });
            });

            expect(result.current.deviceCheck.browser.status).toBe('ok');
            expect(result.current.deviceCheck.mic.deviceLabel).toBe('Custom Mic');
        });

        it('should support functional updates', () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            act(() => {
                result.current.setDeviceCheck((current) => ({
                    ...current,
                    mic: { ...current.mic, status: 'ok' },
                }));
            });

            expect(result.current.deviceCheck.mic.status).toBe('ok');
        });
    });

    describe('checkedAt Timestamp', () => {
        it('should update checkedAt on check', () => {
            const { result } = renderHook(() => useVoiceDeviceCheck());

            const beforeCheck = result.current.deviceCheck.checkedAt;

            act(() => {
                result.current.checkBrowser();
            });

            expect(result.current.deviceCheck.checkedAt).not.toBe(beforeCheck);
            expect(result.current.deviceCheck.checkedAt).toBeTruthy();
        });
    });
});

// Made with Bob
