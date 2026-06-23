/**
 * Tests for useReportData hook
 * 
 * Behavior Contract:
 * - Hook manages report data loading, generation, QA, and export
 * - Auto-generates report on mount if missing
 * - Provides handlers for generate, QA, export, and recording download
 * - Manages loading states and status messages
 * - Checks recording availability on mount
 * - Supports JSON, TXT, and PDF export formats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useReportData } from '../useReportData.js';
import * as reportApi from '../../api/reportApi.js';
import * as recordingApi from '../../api/recordingApi.js';

vi.mock('../../api/reportApi.js');
vi.mock('../../api/recordingApi.js');

describe('useReportData', () => {
    const mockSessionId = 'test-session-123';

    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        // Mock DOM APIs for file download
        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();

        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'a') {
                const element = originalCreateElement(tag);
                element.click = vi.fn();
                return element;
            }
            return originalCreateElement(tag);
        });
    });

    describe('Initial Load', () => {
        it('should load existing report on mount', async () => {
            const mockReport = {
                sessionId: mockSessionId,
                latestStatus: 'ready',
                report: { summary: 'Test summary' }
            };

            vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: true });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.reportData).toEqual(mockReport);
            expect(result.current.status.variant).toBe('success');
        });

        it('loads v5 reports without changing historical scores and recommends regeneration', async () => {
            const mockReport = {
                sessionId: mockSessionId,
                latestStatus: 'ready',
                report: {
                    schemaVersion: 'v5',
                    scores: { overall: 58.6, cvJdMatch: 64.3 },
                    candidateFeedback: { answerRewriteExamples: [{ better: '[補充情境]' }] },
                },
            };
            vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: true });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.reportData.report.scores).toEqual({ overall: 58.6, cvJdMatch: 64.3 });
            expect(result.current.status.message).toMatch(/regenerate/i);
        });

        it('should auto-generate report if missing on first load', async () => {
            const missingError = new Error('Report not found');
            const generatedReport = {
                sessionId: mockSessionId,
                latestStatus: 'ready',
                report: { summary: 'Generated report' }
            };

            vi.mocked(reportApi.getReport)
                .mockRejectedValueOnce(missingError)
                .mockResolvedValue(generatedReport);
            vi.mocked(reportApi.generateReport).mockResolvedValue(generatedReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(reportApi.generateReport).toHaveBeenCalledWith({ sessionId: mockSessionId });
            expect(result.current.reportData).toEqual(generatedReport);
        });
    });

    describe('Generate Report', () => {
        it('should successfully generate a new report', async () => {
            const existingReport = { sessionId: mockSessionId, latestStatus: 'ready', report: { summary: 'Old' } };
            const newReport = { sessionId: mockSessionId, latestStatus: 'ready', report: { summary: 'New report' } };

            vi.mocked(reportApi.getReport)
                .mockResolvedValueOnce(existingReport)
                .mockResolvedValueOnce(newReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.generateReport).mockResolvedValue(newReport);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleGenerate();
            });

            expect(reportApi.generateReport).toHaveBeenCalledWith({ sessionId: mockSessionId });
            expect(result.current.status.title).toBe('Report loaded');
            expect(result.current.reportData).toEqual(newReport);
        });

        it('should handle generation failure', async () => {
            const error = new Error('Generation failed');
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.generateReport).mockRejectedValue(error);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleGenerate();
            });

            expect(result.current.status.variant).toBe('error');
            expect(result.current.status.title).toBe('Generation failed');
        });
    });

    describe('QA Report', () => {
        it('should successfully run QA without rewrite', async () => {
            const qaResult = { qaResult: { flags: [] }, rewriteApplied: false };
            const mockReport = { sessionId: mockSessionId, report: { summary: 'Test' } };

            vi.mocked(reportApi.getReport)
                .mockResolvedValueOnce(mockReport)
                .mockResolvedValueOnce(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.qaReport).mockResolvedValue(qaResult);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleQa();
            });

            expect(reportApi.qaReport).toHaveBeenCalledWith({ sessionId: mockSessionId, userPrompt: '' });
            expect(result.current.status.title).toBe('Report loaded');
        });

        it('should successfully run QA with rewrite', async () => {
            const qaResult = { qaResult: { flags: [] }, rewriteApplied: true };
            const mockReport = { sessionId: mockSessionId, report: { summary: 'Test' } };

            vi.mocked(reportApi.getReport)
                .mockResolvedValueOnce(mockReport)
                .mockResolvedValueOnce(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.qaReport).mockResolvedValue(qaResult);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleQa('Make it more professional');
            });

            expect(reportApi.qaReport).toHaveBeenCalledWith({
                sessionId: mockSessionId,
                userPrompt: 'Make it more professional'
            });
            expect(result.current.status.title).toBe('Report loaded');
        });

        it('should handle QA failure', async () => {
            const error = new Error('QA failed');
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.qaReport).mockRejectedValue(error);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleQa();
            });

            expect(result.current.status.variant).toBe('error');
            expect(result.current.status.title).toBe('QA failed');
        });
    });

    describe('Export Report', () => {
        it('should export report as JSON', async () => {
            const mockReport = { sessionId: mockSessionId, report: { summary: 'Test' } };
            vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.exportReport).mockResolvedValue({ success: true });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleExport('json');
            });

            expect(reportApi.exportReport).toHaveBeenCalledWith({ sessionId: mockSessionId, format: 'json' });
            expect(result.current.status.variant).toBe('success');
            expect(result.current.status.message).toContain('JSON');
        });

        it('should export report as TXT', async () => {
            const mockReport = { sessionId: mockSessionId, report: { summary: 'Test' } };
            vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.exportReport).mockResolvedValue({ success: true });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleExport('txt');
            });

            expect(reportApi.exportReport).toHaveBeenCalledWith({ sessionId: mockSessionId, format: 'txt' });
            expect(result.current.status.message).toContain('TXT');
        });

        it('should export report as PDF', async () => {
            const mockReport = { sessionId: mockSessionId, report: { summary: 'Test' } };
            vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.generateReportPDF).mockResolvedValue(undefined);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleExport('pdf');
            });

            expect(reportApi.generateReportPDF).toHaveBeenCalledWith(mockReport);
            expect(result.current.status.message).toContain('PDF');
        });

        it('should handle export when no report data available', async () => {
            vi.mocked(reportApi.getReport).mockRejectedValue(new Error('No report'));
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleExport('json');
            });

            expect(result.current.status.variant).toBe('error');
            expect(result.current.status.message).toContain('No report data');
        });

        it('should handle export audit timeout gracefully', async () => {
            const mockReport = { sessionId: mockSessionId, report: { summary: 'Test' } };
            vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.exportReport).mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 10000))
            );

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleExport('json');
            });

            expect(result.current.status.variant).toBe('info');
            expect(result.current.status.title).toBe('Report downloaded');
        }, 10000);

        it('should handle export failure', async () => {
            const mockReport = { sessionId: mockSessionId, report: { summary: 'Test' } };
            const error = new Error('Export failed');
            vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.generateReportPDF).mockRejectedValue(error);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleExport('pdf');
            });

            await waitFor(() => {
                expect(result.current.status.variant).toBe('error');
            });

            expect(result.current.status.title).toBe('Export failed');
        });
    });

    describe('Download Recording', () => {
        it('polls recording status until a delayed MP3 becomes available', async () => {
            vi.useFakeTimers();
            try {
                vi.setSystemTime(new Date('2026-06-13T10:00:00.000Z'));
                vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
                vi.mocked(recordingApi.getSessionRecordingStatus)
                    .mockResolvedValueOnce({ available: false })
                    .mockResolvedValueOnce({ available: true });

                const { result } = renderHook(() => useReportData(mockSessionId));

                await act(async () => {
                    await Promise.resolve();
                    await Promise.resolve();
                });

                expect(result.current.recordingStatus.state).toBe('missing');

                await act(async () => {
                    vi.setSystemTime(new Date('2026-06-13T10:00:02.000Z'));
                    await vi.advanceTimersByTimeAsync(2000);
                });

                expect(result.current.recordingStatus.state).toBe('ready');
                expect(result.current.recordingStatus.available).toBe(true);
                expect(recordingApi.getSessionRecordingStatus).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it('keeps polling while a long recording conversion remains pending', async () => {
            vi.useFakeTimers();
            try {
                vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
                vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({
                    state: 'processing',
                    available: false,
                });

                renderHook(() => useReportData(mockSessionId));

                await act(async () => {
                    await Promise.resolve();
                    await vi.advanceTimersByTimeAsync(60000);
                });
                const callsAtOneMinute = recordingApi.getSessionRecordingStatus.mock.calls.length;

                await act(async () => {
                    await vi.advanceTimersByTimeAsync(2000);
                });

                expect(recordingApi.getSessionRecordingStatus.mock.calls.length).toBeGreaterThan(callsAtOneMinute);
            } finally {
                vi.useRealTimers();
            }
        });

        it('preserves resumable upload progress while the report remains available', async () => {
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId, report: { summary: 'Ready' } });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({
                state: 'uploading',
                available: false,
                progressPercent: 65,
                retryable: true,
            });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => expect(result.current.reportData).not.toBeNull());
            expect(result.current.recordingStatus).toMatchObject({
                state: 'uploading',
                progressPercent: 65,
                available: false,
            });
        });

        it('retries a recoverable recording conversion', async () => {
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({
                uploadId: 'upload-1', state: 'recoverable_failed', available: false, retryable: true,
            });
            vi.mocked(recordingApi.retryRecordingUpload).mockResolvedValue({
                uploadId: 'upload-1', state: 'queued', available: false,
            });
            const { result } = renderHook(() => useReportData(mockSessionId));
            await waitFor(() => expect(result.current.recordingStatus.state).toBe('recoverable_failed'));

            await act(async () => result.current.handleRetryRecording());

            expect(recordingApi.retryRecordingUpload).toHaveBeenCalledWith('upload-1');
            expect(result.current.recordingStatus.state).toBe('queued');
        });

        it('should successfully download MP3 recording', async () => {
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: true });
            vi.mocked(recordingApi.downloadSessionRecording).mockResolvedValue(undefined);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleDownloadRecording();
            });

            expect(recordingApi.downloadSessionRecording).toHaveBeenCalledWith(mockSessionId);
            expect(result.current.status.variant).toBe('success');
            expect(result.current.status.message).toContain('Voice recording downloaded');
        });

        it('should handle recording download failure', async () => {
            const error = new Error('Recording not found');
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(recordingApi.downloadSessionRecording).mockRejectedValue(error);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleDownloadRecording();
            });

            expect(result.current.status.variant).toBe('error');
            expect(result.current.status.title).toBe('MP3 download failed');
        });
    });

    describe('Loading States', () => {
        it('should set loading to true during operations', async () => {
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.generateReport).mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 100))
            );

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.handleGenerate();
            });

            expect(result.current.loading).toBe(true);
        });

        it('should set loading to false after operation completes', async () => {
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });
            vi.mocked(reportApi.generateReport).mockResolvedValue({ sessionId: mockSessionId });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleGenerate();
            });

            expect(result.current.loading).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle initial load error gracefully', async () => {
            const error = new Error('Load failed');
            vi.mocked(reportApi.getReport).mockRejectedValue(error);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.reportData).toBeNull();
            expect(result.current.status.variant).toBe('info');
        });

        it('should not auto-generate twice', async () => {
            const missingError = new Error('Report not found');
            const generatedReport = { sessionId: mockSessionId, latestStatus: 'ready' };

            vi.mocked(reportApi.getReport)
                .mockRejectedValueOnce(missingError)
                .mockResolvedValue(generatedReport);
            vi.mocked(reportApi.generateReport).mockResolvedValue(generatedReport);
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });

            const { result, rerender } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(reportApi.generateReport).toHaveBeenCalledTimes(1);

            rerender();

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(reportApi.generateReport).toHaveBeenCalledTimes(1);
        });
    });
});

// Made with Bob
