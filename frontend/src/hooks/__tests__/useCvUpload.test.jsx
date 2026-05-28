/**
 * Tests for useCvUpload hook
 * 
 * Behavior Contract:
 * - Hook manages CV file upload with drag & drop support
 * - Validates file types (PDF and DOCX only)
 * - Manages upload state (uploading, success, error)
 * - Provides drag state for UI feedback
 * - Auto-clears success message after 3 seconds
 * - Resets file input after selection
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCvUpload } from '../useCvUpload.js';

describe('useCvUpload', () => {
    let mockOnUpload;

    beforeEach(() => {
        mockOnUpload = vi.fn();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            expect(result.current.isDragging).toBe(false);
            expect(result.current.isUploading).toBe(false);
            expect(result.current.uploadSuccess).toBe(false);
            expect(result.current.localValidationMessage).toBe('');
        });
    });

    describe('Drag and Drop Upload', () => {
        it('should set isDragging to true on dragOver', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            };

            act(() => {
                result.current.handleDragOver(mockEvent);
            });

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockEvent.stopPropagation).toHaveBeenCalled();
            expect(result.current.isDragging).toBe(true);
        });

        it('should set isDragging to false on dragLeave', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            };

            act(() => {
                result.current.handleDragOver(mockEvent);
            });

            expect(result.current.isDragging).toBe(true);

            act(() => {
                result.current.handleDragLeave(mockEvent);
            });

            expect(result.current.isDragging).toBe(false);
        });

        it('should successfully handle PDF file drop', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: {
                    files: [mockFile],
                },
            };

            await act(async () => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(result.current.isDragging).toBe(false);
            expect(mockOnUpload).toHaveBeenCalledWith(mockFile);
            expect(result.current.uploadSuccess).toBe(true);
        });

        it('should successfully handle DOCX file drop', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: {
                    files: [mockFile],
                },
            };

            await act(async () => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).toHaveBeenCalledWith(mockFile);
            expect(result.current.uploadSuccess).toBe(true);
        });

        it('should reject unsupported file types', async () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.txt', { type: 'text/plain' });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: {
                    files: [mockFile],
                },
            };

            act(() => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).not.toHaveBeenCalled();
            expect(result.current.localValidationMessage).toContain('Only PDF and DOCX');
        });

        it('should handle drop event with no files', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: {
                    files: [],
                },
            };

            act(() => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).not.toHaveBeenCalled();
            expect(result.current.isDragging).toBe(false);
        });
    });

    describe('File Selection Upload', () => {
        it('should successfully handle file selection', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
            const mockEvent = {
                target: {
                    files: [mockFile],
                    value: 'C:\\fakepath\\resume.pdf',
                },
            };

            await act(async () => {
                result.current.handleFileChange(mockEvent);
            });

            expect(mockOnUpload).toHaveBeenCalledWith(mockFile);
            expect(result.current.uploadSuccess).toBe(true);
            expect(mockEvent.target.value).toBeNull();
        });

        it('should reset input value to allow reselecting same file', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
            const mockEvent = {
                target: {
                    files: [mockFile],
                    value: 'resume.pdf',
                },
            };

            await act(async () => {
                result.current.handleFileChange(mockEvent);
            });

            expect(mockEvent.target.value).toBeNull();
        });

        it('should handle selection event with no files', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockEvent = {
                target: {
                    files: [],
                },
            };

            act(() => {
                result.current.handleFileChange(mockEvent);
            });

            expect(mockOnUpload).not.toHaveBeenCalled();
        });
    });

    describe('Upload State Management', () => {
        it('should set isUploading during upload', async () => {
            let resolveUpload;
            mockOnUpload.mockReturnValue(
                new Promise((resolve) => {
                    resolveUpload = resolve;
                })
            );

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

            act(() => {
                result.current.processUpload(mockFile);
            });

            await waitFor(() => {
                expect(result.current.isUploading).toBe(true);
            });

            await act(async () => {
                resolveUpload(true);
            });

            expect(result.current.isUploading).toBe(false);
        });

        it('should show uploadSuccess after successful upload', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

            await act(async () => {
                await result.current.processUpload(mockFile);
            });

            expect(result.current.uploadSuccess).toBe(true);
        });

        it('should auto-clear uploadSuccess after 3 seconds', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

            await act(async () => {
                await result.current.processUpload(mockFile);
            });

            expect(result.current.uploadSuccess).toBe(true);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(3000);
            });

            expect(result.current.uploadSuccess).toBe(false);
        });

        it('should not set uploadSuccess on upload failure', async () => {
            mockOnUpload.mockResolvedValue(false);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

            await act(async () => {
                await result.current.processUpload(mockFile);
            });

            expect(result.current.uploadSuccess).toBe(false);
            expect(result.current.isUploading).toBe(false);
        });

        it('should clear previous state when new upload starts', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            // 設置一些初始狀態
            act(() => {
                result.current.setLocalValidationMessage('Previous error');
            });

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

            await act(async () => {
                await result.current.processUpload(mockFile);
            });

            expect(result.current.localValidationMessage).toBe('');
            expect(result.current.uploadSuccess).toBe(true);
        });
    });

    describe('Validation Message Management', () => {
        it('should be able to manually set validation message', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            act(() => {
                result.current.setLocalValidationMessage('Custom error message');
            });

            expect(result.current.localValidationMessage).toBe('Custom error message');
        });

        it('should clear validation message on new upload', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            act(() => {
                result.current.setLocalValidationMessage('Error message');
            });

            expect(result.current.localValidationMessage).toBe('Error message');

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

            await act(async () => {
                await result.current.processUpload(mockFile);
            });

            expect(result.current.localValidationMessage).toBe('');
        });
    });

    describe('File Type Validation', () => {
        it('should accept .pdf extension (lowercase)', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: { files: [mockFile] },
            };

            await act(async () => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).toHaveBeenCalled();
            expect(result.current.localValidationMessage).toBe('');
        });

        it('should accept .PDF extension (uppercase)', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.PDF', { type: 'application/pdf' });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: { files: [mockFile] },
            };

            await act(async () => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).toHaveBeenCalled();
        });

        it('should accept .docx extension', async () => {
            mockOnUpload.mockResolvedValue(true);

            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: { files: [mockFile] },
            };

            await act(async () => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).toHaveBeenCalled();
        });

        it('should reject .doc extension', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.doc', { type: 'application/msword' });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: { files: [mockFile] },
            };

            act(() => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).not.toHaveBeenCalled();
            expect(result.current.localValidationMessage).toContain('Only PDF and DOCX');
        });

        it('should reject .txt extension', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume.txt', { type: 'text/plain' });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: { files: [mockFile] },
            };

            act(() => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).not.toHaveBeenCalled();
            expect(result.current.localValidationMessage).toContain('Only PDF and DOCX');
        });

        it('should reject files without extension', () => {
            const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

            const mockFile = new File(['content'], 'resume', { type: 'application/octet-stream' });
            const mockEvent = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: { files: [mockFile] },
            };

            act(() => {
                result.current.handleDrop(mockEvent);
            });

            expect(mockOnUpload).not.toHaveBeenCalled();
            expect(result.current.localValidationMessage).toContain('Only PDF and DOCX');
        });
    });
});

// Made with Bob
