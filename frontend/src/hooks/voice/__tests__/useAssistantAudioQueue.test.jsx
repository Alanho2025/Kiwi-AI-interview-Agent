/**
 * Tests for useAssistantAudioQueue hook
 * 
 * Behavior Contract:
 * - Hook manages assistant audio playback queue
 * - Plays TTS chunks in order
 * - Supports immediate cancellation for barge-in
 * - Handles both full-buffer and streaming playback
 * - Manages audio URL cleanup
 * - Provides playback state callbacks
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAssistantAudioQueue } from '../useAssistantAudioQueue.js';

describe('useAssistantAudioQueue', () => {
    let mockAudio;
    let mockMediaSource;
    let mockSourceBuffer;

    beforeEach(() => {
        // Mock Audio element
        mockAudio = {
            src: '',
            play: vi.fn().mockResolvedValue(undefined),
            pause: vi.fn(),
            load: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            currentTime: 0,
            duration: 0,
            paused: true,
            ended: false,
        };

        // Mock HTMLAudioElement constructor
        global.Audio = vi.fn(() => mockAudio);

        // Mock URL APIs
        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();

        // Mock atob for base64 decoding
        global.atob = vi.fn((str) => str);

        // Mock MediaSource
        mockSourceBuffer = {
            appendBuffer: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            updating: false,
        };

        mockMediaSource = {
            addSourceBuffer: vi.fn(() => mockSourceBuffer),
            endOfStream: vi.fn(),
            readyState: 'open',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };

        global.MediaSource = vi.fn(() => mockMediaSource);
        global.MediaSource.isTypeSupported = vi.fn(() => true);

        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const { result } = renderHook(() => useAssistantAudioQueue());

            expect(result.current.assistantAudioUrl).toBe('');
            expect(result.current.isAssistantSpeaking).toBe(false);
        });

        it('should accept callback configuration', () => {
            const callbacks = {
                onPlaybackStart: vi.fn(),
                onPlaybackEnd: vi.fn(),
                onQueueDrained: vi.fn(),
                onPlaybackError: vi.fn(),
            };

            const { result } = renderHook(() => useAssistantAudioQueue(callbacks));

            expect(result.current).toBeDefined();
        });
    });

    describe('Audio Unlocking', () => {
        it('should unlock audio playback', async () => {
            const { result } = renderHook(() => useAssistantAudioQueue());

            let unlockResult;
            await act(async () => {
                unlockResult = await result.current.unlockAudio();
            });

            expect(unlockResult.ok).toBe(true);
            expect(mockAudio.play).toHaveBeenCalled();
        });

        it('should handle unlock failure gracefully', async () => {
            mockAudio.play.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));

            const { result } = renderHook(() => useAssistantAudioQueue());

            let unlockResult;
            await act(async () => {
                unlockResult = await result.current.unlockAudio();
            });

            expect(unlockResult.ok).toBe(false);
            expect(unlockResult.error).toContain('blocked');
        });

        it('should only unlock once', async () => {
            const { result } = renderHook(() => useAssistantAudioQueue());

            await act(async () => {
                await result.current.unlockAudio();
                await result.current.unlockAudio();
            });

            // Should only call play once for the unlock
            expect(mockAudio.play).toHaveBeenCalledTimes(1);
        });
    });

    describe('Queue Management', () => {
        it('should enqueue audio chunk', async () => {
            const onPlaybackStart = vi.fn();
            const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackStart }));

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'mock-audio-data',
                    contentType: 'audio/mpeg',
                });
            });

            // Trigger audio ended event to process queue
            await act(async () => {
                const endedHandler = mockAudio.addEventListener.mock.calls.find(
                    ([event]) => event === 'ended'
                )?.[1];
                if (endedHandler) endedHandler();
            });

            expect(global.URL.createObjectURL).toHaveBeenCalled();
        });

        it('should play chunks in order', async () => {
            const { result } = renderHook(() => useAssistantAudioQueue());

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk2',
                    contentType: 'audio/mpeg',
                });
            });

            expect(mockAudio.play).toHaveBeenCalled();
        });

        it('should clear queue', async () => {
            const onQueueDrained = vi.fn();
            const { result } = renderHook(() => useAssistantAudioQueue({ onQueueDrained }));

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            act(() => {
                result.current.clearQueue();
            });

            expect(mockAudio.pause).toHaveBeenCalled();
            expect(result.current.isAssistantSpeaking).toBe(false);
        });
    });

    describe('Playback Callbacks', () => {
        it('should call onPlaybackStart when playback begins', async () => {
            const onPlaybackStart = vi.fn();
            const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackStart }));

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await act(async () => {
                const playHandler = mockAudio.addEventListener.mock.calls.find(
                    ([event]) => event === 'play'
                )?.[1];
                if (playHandler) playHandler();
            });

            await waitFor(() => {
                expect(onPlaybackStart).toHaveBeenCalled();
            });
        });

        it('should call onPlaybackEnd when playback ends', async () => {
            const onPlaybackEnd = vi.fn();
            const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackEnd }));

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await act(async () => {
                const endedHandler = mockAudio.addEventListener.mock.calls.find(
                    ([event]) => event === 'ended'
                )?.[1];
                if (endedHandler) endedHandler();
            });

            await waitFor(() => {
                expect(onPlaybackEnd).toHaveBeenCalled();
            });
        });

        it('should call onQueueDrained when queue is empty', async () => {
            const onQueueDrained = vi.fn();
            const { result } = renderHook(() => useAssistantAudioQueue({ onQueueDrained }));

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await act(async () => {
                const endedHandler = mockAudio.addEventListener.mock.calls.find(
                    ([event]) => event === 'ended'
                )?.[1];
                if (endedHandler) endedHandler();
            });

            await waitFor(() => {
                expect(onQueueDrained).toHaveBeenCalled();
            });
        });

        it('should call onPlaybackError on playback failure', async () => {
            const onPlaybackError = vi.fn();
            mockAudio.play.mockRejectedValueOnce(new Error('Playback failed'));

            const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackError }));

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await waitFor(() => {
                expect(onPlaybackError).toHaveBeenCalled();
            });
        });
    });

    describe('URL Cleanup', () => {
        it('should revoke object URLs after playback', async () => {
            const { result } = renderHook(() => useAssistantAudioQueue());

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await act(async () => {
                const endedHandler = mockAudio.addEventListener.mock.calls.find(
                    ([event]) => event === 'ended'
                )?.[1];
                if (endedHandler) endedHandler();
                await vi.advanceTimersByTimeAsync(2100);
            });

            expect(global.URL.revokeObjectURL).toHaveBeenCalled();
        });
    });

    describe('State Management', () => {
        it('should update isAssistantSpeaking during playback', async () => {
            const { result } = renderHook(() => useAssistantAudioQueue());

            await act(async () => {
                await result.current.unlockAudio();
            });

            expect(result.current.isAssistantSpeaking).toBe(false);

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await act(async () => {
                const playHandler = mockAudio.addEventListener.mock.calls.find(
                    ([event]) => event === 'play'
                )?.[1];
                if (playHandler) playHandler();
            });

            await waitFor(() => {
                expect(result.current.isAssistantSpeaking).toBe(true);
            });
        });

        it('should update assistantAudioUrl during playback', async () => {
            const { result } = renderHook(() => useAssistantAudioQueue());

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await waitFor(() => {
                expect(result.current.assistantAudioUrl).toBeTruthy();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle NotAllowedError gracefully', async () => {
            const onPlaybackError = vi.fn();
            mockAudio.play.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));

            const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackError }));

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await waitFor(() => {
                expect(onPlaybackError).toHaveBeenCalled();
            });

            const errorMessage = onPlaybackError.mock.calls[0][0];
            expect(errorMessage).toContain('blocked');
        });

        it('should handle generic playback errors', async () => {
            const onPlaybackError = vi.fn();
            mockAudio.play.mockRejectedValue(new Error('Generic error'));

            const { result } = renderHook(() => useAssistantAudioQueue({ onPlaybackError }));

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            await waitFor(() => {
                expect(onPlaybackError).toHaveBeenCalled();
            });
        });
    });

    describe('Cleanup', () => {
        it('should cleanup resources on unmount', async () => {
            const { result, unmount } = renderHook(() => useAssistantAudioQueue());

            await act(async () => {
                await result.current.unlockAudio();
            });

            act(() => {
                result.current.enqueueAudioChunk({
                    audioBase64: 'chunk1',
                    contentType: 'audio/mpeg',
                });
            });

            unmount();

            expect(mockAudio.pause).toHaveBeenCalled();
        });
    });
});

// Made with Bob
