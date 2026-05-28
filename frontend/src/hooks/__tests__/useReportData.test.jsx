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
    });
});

// Made with Bob
