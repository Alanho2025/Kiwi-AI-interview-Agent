/**
 * Tests for useDirectWavRecorder hook
 * 
 * Behavior Contract:
 * - Hook manages direct WAV recording from microphone
 * - Provides start/stop recording controls
 * - Tracks recording duration in real-time
 * - Generates audio level history for UI visualization
 * - Returns recorded file on stop
 * - Cleans up media resources properly
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDirectWavRecorder } from '../useDirectWavRecorder.js';

describe('useDirectWavRecorder', () => {
    let mockMediaRecorder;
    let mockStream;
    let mockTrack;

    beforeEach(() => {
        mockTrack = {
            stop: vi.fn(),
        };

        mockStream = {
            getTracks: vi.fn(() => [mockTrack]),
        };

        mockMediaRecorder = {
            state: 'inactive',
            mimeType: 'audio/webm',
            ondataavailable: null,
            onstop: null,
            start: vi.fn(function () {
                this.state = 'recording';
            }),
            stop: vi.fn(function () {
                this.state = 'inactive';
                if (this.onstop) {
                    setTimeout(() => this.onstop(), 0);
                }
            }),
        };

        global.MediaRecorder = vi.fn(() => mockMediaRecorder);

        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: {
                getUserMedia: vi.fn().mockResolvedValue(mockStream),
            },
        });

        vi.spyOn(performance, 'now').mockReturnValue(1000);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            expect(result.current.isRecording).toBe(false);
            expect(result.current.recordingError).toBeNull();
            expect(result.current.levelHistory).toEqual([]);
            expect(result.current.recordingDurationMs).toBe(0);
        });
    });

    describe('Start Recording', () => {
        it('should successfully start recording', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
            expect(mockMediaRecorder.start).toHaveBeenCalledWith(250);
            expect(result.current.isRecording).toBe(true);
            expect(result.current.recordingError).toBeNull();
        });

        it('should clear previous recording error', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            // 設置一個錯誤
            act(() => {
                result.current.recordingError = 'Previous error';
            });

            await act(async () => {
                await result.current.startRecording();
            });

            expect(result.current.recordingError).toBeNull();
        });

        it('should reset duration and level history', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            expect(result.current.recordingDurationMs).toBe(0);
            expect(result.current.levelHistory).toEqual([]);
        });

        it('should update duration during recording', async () => {
            vi.spyOn(performance, 'now')
                .mockReturnValueOnce(1000) // startRecording
                .mockReturnValueOnce(1150) // first interval
                .mockReturnValueOnce(1300); // second interval

            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            await act(async () => {
                await vi.advanceTimersByTimeAsync(150);
            });

            expect(result.current.recordingDurationMs).toBeGreaterThan(0);
        });

        it('should update level history during recording', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            await act(async () => {
                await vi.advanceTimersByTimeAsync(300);
            });

            expect(result.current.levelHistory.length).toBeGreaterThan(0);
        });

        it('should limit level history length', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            // 模擬長時間錄音
            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });

            // 應該保持在 42 個樣本以內（-41 slice + 1 new）
            expect(result.current.levelHistory.length).toBeLessThanOrEqual(42);
        });
    });

    describe('Stop Recording', () => {
        it('should successfully stop recording and return file', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            // 模擬 MediaRecorder 收集資料
            const mockData = new Blob(['audio data'], { type: 'audio/webm' });
            act(() => {
                if (mockMediaRecorder.ondataavailable) {
                    mockMediaRecorder.ondataavailable({ data: mockData });
                }
            });

            let recordingResult;
            await act(async () => {
                recordingResult = await result.current.stopRecording();
            });

            expect(mockMediaRecorder.stop).toHaveBeenCalled();
            expect(mockTrack.stop).toHaveBeenCalled();
            expect(result.current.isRecording).toBe(false);
            expect(recordingResult.file).toBeInstanceOf(File);
            expect(recordingResult.file.name).toContain('voice-answer');
            expect(recordingResult.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('should return recording duration', async () => {
            vi.spyOn(performance, 'now')
                .mockReturnValueOnce(1000) // startRecording
                .mockReturnValueOnce(3500); // stopRecording

            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            let recordingResult;
            await act(async () => {
                recordingResult = await result.current.stopRecording();
            });

            expect(recordingResult.durationMs).toBe(2500);
        });

        it('should handle case with no MediaRecorder', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            let recordingResult;
            await act(async () => {
                recordingResult = await result.current.stopRecording();
            });

            expect(recordingResult.file).toBeNull();
            expect(result.current.isRecording).toBe(false);
        });

        it('should handle errors when stopping recording', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            mockMediaRecorder.stop = vi.fn(() => {
                throw new Error('Stop failed');
            });

            let recordingResult;
            await act(async () => {
                recordingResult = await result.current.stopRecording();
            });

            expect(result.current.recordingError).toContain('Could not stop');
            expect(result.current.isRecording).toBe(false);
            expect(recordingResult.file).toBeNull();
        });

        it('should cleanup timer', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

            await act(async () => {
                await result.current.stopRecording();
            });

            expect(clearIntervalSpy).toHaveBeenCalled();
        });

        it('should cleanup media resources', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            await act(async () => {
                await result.current.stopRecording();
            });

            expect(mockTrack.stop).toHaveBeenCalled();
        });

        it('should handle already stopped MediaRecorder', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            mockMediaRecorder.state = 'inactive';

            let recordingResult;
            await act(async () => {
                recordingResult = await result.current.stopRecording();
            });

            expect(recordingResult).toBeDefined();
        });
    });

    describe('Cleanup Resources', () => {
        it('should cleanup all recording resources', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            await act(async () => {
                await result.current.clearResources();
            });

            expect(mockTrack.stop).toHaveBeenCalled();
            expect(result.current.isRecording).toBe(false);
        });

        it('should stop MediaRecorder when recording', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            mockMediaRecorder.state = 'recording';

            await act(async () => {
                await result.current.clearResources();
            });

            expect(mockMediaRecorder.stop).toHaveBeenCalled();
        });

        it('should cleanup timer', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

            await act(async () => {
                await result.current.clearResources();
            });

            expect(clearIntervalSpy).toHaveBeenCalled();
        });

        it('should be safe to call multiple times', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.clearResources();
                await result.current.clearResources();
            });

            expect(result.current.isRecording).toBe(false);
        });
    });

    describe('MediaRecorder Data Collection', () => {
        it('should collect multiple audio chunks', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            // 模擬多個資料事件
            const mockData1 = new Blob(['chunk1'], { type: 'audio/webm' });
            const mockData2 = new Blob(['chunk2'], { type: 'audio/webm' });

            act(() => {
                if (mockMediaRecorder.ondataavailable) {
                    mockMediaRecorder.ondataavailable({ data: mockData1 });
                    mockMediaRecorder.ondataavailable({ data: mockData2 });
                }
            });

            let recordingResult;
            await act(async () => {
                recordingResult = await result.current.stopRecording();
            });

            expect(recordingResult.file).toBeInstanceOf(File);
            expect(recordingResult.file.size).toBeGreaterThan(0);
        });

        it('should ignore empty data chunks', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            act(() => {
                if (mockMediaRecorder.ondataavailable) {
                    mockMediaRecorder.ondataavailable({ data: null });
                    mockMediaRecorder.ondataavailable({ data: { size: 0 } });
                }
            });

            let recordingResult;
            await act(async () => {
                recordingResult = await result.current.stopRecording();
            });

            expect(recordingResult.file).toBeDefined();
        });
    });

    describe('File Generation', () => {
        it('should use correct MIME type', async () => {
            mockMediaRecorder.mimeType = 'audio/webm;codecs=opus';

            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            const mockData = new Blob(['audio'], { type: 'audio/webm' });
            act(() => {
                if (mockMediaRecorder.ondataavailable) {
                    mockMediaRecorder.ondataavailable({ data: mockData });
                }
            });

            let recordingResult;
            await act(async () => {
                recordingResult = await result.current.stopRecording();
            });

            expect(recordingResult.file.type).toBe('audio/webm;codecs=opus');
        });

        it('should generate unique filenames', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            const mockData = new Blob(['audio'], { type: 'audio/webm' });
            act(() => {
                if (mockMediaRecorder.ondataavailable) {
                    mockMediaRecorder.ondataavailable({ data: mockData });
                }
            });

            let recordingResult1;
            await act(async () => {
                recordingResult1 = await result.current.stopRecording();
            });

            // 開始第二次錄音
            await act(async () => {
                await result.current.startRecording();
            });

            act(() => {
                if (mockMediaRecorder.ondataavailable) {
                    mockMediaRecorder.ondataavailable({ data: mockData });
                }
            });

            let recordingResult2;
            await act(async () => {
                recordingResult2 = await result.current.stopRecording();
            });

            expect(recordingResult1.file.name).not.toBe(recordingResult2.file.name);
        });
    });

    describe('Error Handling', () => {
        it('should handle getUserMedia failure', async () => {
            const error = new Error('Permission denied');
            navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(error);

            const { result } = renderHook(() => useDirectWavRecorder());

            await expect(
                act(async () => {
                    await result.current.startRecording();
                })
            ).rejects.toThrow('Permission denied');
        });

        it('should handle MediaRecorder creation failure', async () => {
            global.MediaRecorder = vi.fn(() => {
                throw new Error('MediaRecorder not supported');
            });

            const { result } = renderHook(() => useDirectWavRecorder());

            await expect(
                act(async () => {
                    await result.current.startRecording();
                })
            ).rejects.toThrow('MediaRecorder not supported');
        });
    });

    describe('State Consistency', () => {
        it('should keep isRecording true during recording', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            expect(result.current.isRecording).toBe(true);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
            });

            expect(result.current.isRecording).toBe(true);
        });

        it('should set isRecording to false after stop', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            expect(result.current.isRecording).toBe(true);

            await act(async () => {
                await result.current.stopRecording();
            });

            expect(result.current.isRecording).toBe(false);
        });
    });

    describe('Timer Behavior', () => {
        it('should update every 150ms', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            const initialDuration = result.current.recordingDurationMs;

            await act(async () => {
                await vi.advanceTimersByTimeAsync(150);
            });

            expect(result.current.recordingDurationMs).toBeGreaterThan(initialDuration);
        });

        it('should stop updating after stop', async () => {
            const { result } = renderHook(() => useDirectWavRecorder());

            await act(async () => {
                await result.current.startRecording();
            });

            await act(async () => {
                await result.current.stopRecording();
            });

            const finalDuration = result.current.recordingDurationMs;

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
            });

            expect(result.current.recordingDurationMs).toBe(finalDuration);
        });
    });
});

// Made with Bob
