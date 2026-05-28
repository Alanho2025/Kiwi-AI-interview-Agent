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
import { renderHook, waitFor } from '@testing-library/react';
import { useReportData } from '../useReportData.js';
import * as reportApi from '../../api/reportApi.js';
import * as recordingApi from '../../api/recordingApi.js';

vi.mock('../../api/reportApi.js');
vi.mock('../../api/recordingApi.js');

describe('useReportData', () => {
    const mockSessionId = 'test-session-123';

    beforeEach(() => {
        vi.clearAllMocks();
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

        it('should auto-generate report if missing on first load', async () => {
            const missingError = new Error('Report not found');
            const generatedReport = {
                sessionId: mockSessionId,
                latestStatus: 'ready',
                report: { summary: 'Generated summary' }
            };

            vi.mocked(reportApi.getReport)
                .mockRejectedValueOnce(missingError)
                .mockResolvedValueOnce(generatedReport);
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

    describe('Recording Status', () => {
        it('should check recording status on mount', async () => {
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: true });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.recordingStatus.state).toBe('ready');
            });

            expect(result.current.recordingStatus.available).toBe(true);
        });

        it('should handle recording not available', async () => {
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockResolvedValue({ available: false });

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.recordingStatus.state).toBe('missing');
            });

            expect(result.current.recordingStatus.available).toBe(false);
        });

        it('should handle recording status check failure', async () => {
            const error = new Error('Network error');
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
            vi.mocked(recordingApi.getSessionRecordingStatus).mockRejectedValue(error);

            const { result } = renderHook(() => useReportData(mockSessionId));

            await waitFor(() => {
                expect(result.current.recordingStatus.state).toBe('failed');
            });

            expect(result.current.recordingStatus.error).toContain('Network error');
        });
    });

    describe('Generate Report', () => {
        it('should successfully generate a new report', async () => {
            const existingReport = { sessionId: mockSessionId, latestStatus: 'ready' };
            const newReport = { sessionId: mockSessionId, latestStatus: 'ready', report: { summary: 'New report' } };

            vi.mocked(reportApi.getReport).mockResolvedValue(existingReport);
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
            expect(result.current.status.variant).toBe('success');
            expect(result.current.status.title).toContain('generated');
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
            expect(result.current.status.message).toContain('Generation failed');
        });
    });

    describe('QA Report', () => {
        it('should successfully run QA without rewrite', async () => {
            const qaResult = { qaResult: { flags: [] }, rewriteApplied: false };
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
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
            expect(result.current.status.title).toContain('QA completed');
        });

        it('should successfully run QA with rewrite', async () => {
            const qaResult = { qaResult: { flags: [] }, rewriteApplied: true };
            vi.mocked(reportApi.getReport).mockResolvedValue({ sessionId: mockSessionId });
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
            expect(result.current.status.title).toContain('QA rewrite completed');
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
            expect(result.current.status.title).toContain('QA failed');
        });
    });

    describe('Export Report', () => {
        beforeEach(() => {
            // Mock DOM APIs for file download
            global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
            global.URL.revokeObjectURL = vi.fn();
            document.createElement = vi.fn((tag) => {
                if (tag === 'a') {
                    return {
                        click: vi.fn(),
                        href: '',
                        download: '',
                    };
                }
                return {};
            });
        });

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
            expect(result.current.status.message).toContain('downloaded');
        });

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

            expect(result.current.status.variant).toBe('error');
            expect(result.current.status.message).toContain('Export failed');
        });
    });

    describe('Download Recording', () => {
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
            expect(result.current.status.message).toContain('MP3 downloaded');
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
            expect(result.current.status.message).toContain('MP3 download failed');
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

            // Rerender should not trigger another auto-generation
            rerender();

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(reportApi.generateReport).toHaveBeenCalledTimes(1);
        });
    });
});
