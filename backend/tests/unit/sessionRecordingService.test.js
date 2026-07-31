import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadOwnedSessionOrThrow = vi.fn();
const mockGetSessionStatus = vi.fn();
const mockGetPublishedMp3Path = vi.fn();

vi.mock(
    '../../src/services/interview/interviewSessionService.js',
    () => ({
        loadOwnedSessionOrThrow: mockLoadOwnedSessionOrThrow,
        requireSessionId: vi.fn(),
    }),
);

vi.mock(
    '../../src/services/recording/recordingUploadService.js',
    () => ({
        recordingUploadService: {
            getSessionStatus: mockGetSessionStatus,
        },
    }),
);

vi.mock(
    '../../src/services/recording/recordingChunkStorageService.js',
    () => ({
        recordingChunkStorageService: {
            getPublishedMp3Path: mockGetPublishedMp3Path,
        },
    }),
);

vi.mock('fs/promises', () => ({
    default: {
        mkdir: vi.fn(),
        stat: vi.fn(),
    },
}));

const fs = await import('fs/promises');

const {
    getSessionRecordingStatus,
    loadSessionRecordingForDownload,
} = await import(
    '../../src/services/recording/sessionRecordingService.js'
);

describe('sessionRecordingService recording source resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockLoadOwnedSessionOrThrow.mockResolvedValue({
            id: 'session-1',
            user_id: 'user-1',
        });

        mockGetPublishedMp3Path.mockReturnValue(
            '/recordings/resumable/session-1.mp3',
        );
    });

    it('blocks stale legacy MP3 when resumable upload is incomplete', async () => {
        mockGetSessionStatus.mockResolvedValue({
            state: 'awaiting_missing_chunks',
            available: false,
            receivedChunks: 2,
            totalChunks: 3,
            missingSequences: [2],
        });

        fs.default.stat.mockImplementation(async (filePath) => {
            if (String(filePath).includes('/mp3/session-1.mp3')) {
                return {
                    isFile: () => true,
                    size: 8192,
                };
            }

            throw new Error('File missing');
        });

        const status = await getSessionRecordingStatus({
            sessionId: 'session-1',
            userId: 'user-1',
        });

        expect(status.available).toBe(false);
        expect(status.status).toBe('awaiting_missing_chunks');
        expect(status.recordingSource).toBe('resumable_chunks');

        await expect(
            loadSessionRecordingForDownload({
                sessionId: 'session-1',
                userId: 'user-1',
            }),
        ).rejects.toThrow();

        expect(fs.default.stat).not.toHaveBeenCalledWith(
            expect.stringContaining('/mp3/session-1.mp3'),
        );
    });

    it('uses published resumable MP3 when resumable upload is ready', async () => {
        mockGetSessionStatus.mockResolvedValue({
            state: 'ready',
            available: true,
            receivedChunks: 3,
            totalChunks: 3,
            missingSequences: [],
        });

        fs.default.stat.mockImplementation(async (filePath) => {
            if (filePath === '/recordings/resumable/session-1.mp3') {
                return {
                    isFile: () => true,
                    size: 2_000_000,
                };
            }

            throw new Error('File missing');
        });

        const status = await getSessionRecordingStatus({
            sessionId: 'session-1',
            userId: 'user-1',
        });

        expect(status.available).toBe(true);
        expect(status.recordingSource).toBe('resumable_chunks');
        expect(status.fileSizeBytes).toBe(2_000_000);

        const download = await loadSessionRecordingForDownload({
            sessionId: 'session-1',
            userId: 'user-1',
        });

        expect(download.mp3Path).toBe(
            '/recordings/resumable/session-1.mp3',
        );
    });

    it('uses legacy MP3 only when no resumable manifest exists', async () => {
        mockGetSessionStatus.mockResolvedValue(null);

        fs.default.stat.mockImplementation(async (filePath) => {
            if (String(filePath).includes('/mp3/session-1.mp3')) {
                return {
                    isFile: () => true,
                    size: 1_000_000,
                };
            }

            throw new Error('File missing');
        });

        const status = await getSessionRecordingStatus({
            sessionId: 'session-1',
            userId: 'user-1',
        });

        expect(status.available).toBe(true);
        expect(status.recordingSource).toBe('legacy_single_file');
        expect(status.fileSizeBytes).toBe(1_000_000);
    });
});