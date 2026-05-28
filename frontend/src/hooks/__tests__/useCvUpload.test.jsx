import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCvUpload } from '../useCvUpload.js';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const buildDropEvent = (file) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  dataTransfer: { files: file ? [file] : [] },
});

describe('useCvUpload', () => {
  let mockOnUpload;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockOnUpload = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

    expect(result.current.isDragging).toBe(false);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadSuccess).toBe(false);
    expect(result.current.localValidationMessage).toBe('');
  });

  it('updates drag state', () => {
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };

    act(() => result.current.handleDragOver(event));
    expect(result.current.isDragging).toBe(true);

    act(() => result.current.handleDragLeave(event));
    expect(result.current.isDragging).toBe(false);
  });

  it('uploads a dropped PDF file', async () => {
    mockOnUpload.mockResolvedValue(true);
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    const event = buildDropEvent(file);

    await act(async () => {
      result.current.handleDrop(event);
      await flushPromises();
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
    expect(mockOnUpload).toHaveBeenCalledWith(file);
    expect(result.current.uploadSuccess).toBe(true);
  });

  it('uploads a dropped DOCX file', async () => {
    mockOnUpload.mockResolvedValue(true);
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await act(async () => {
      result.current.handleDrop(buildDropEvent(file));
      await flushPromises();
    });

    expect(mockOnUpload).toHaveBeenCalledWith(file);
    expect(result.current.uploadSuccess).toBe(true);
  });

  it('rejects unsupported dropped files', () => {
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], 'resume.txt', { type: 'text/plain' });

    act(() => result.current.handleDrop(buildDropEvent(file)));

    expect(mockOnUpload).not.toHaveBeenCalled();
    expect(result.current.localValidationMessage).toContain('Only PDF and DOCX');
  });

  it('ignores empty drop and file-selection events', () => {
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));

    act(() => result.current.handleDrop(buildDropEvent(null)));
    act(() => result.current.handleFileChange({ target: { files: [] } }));

    expect(mockOnUpload).not.toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
  });

  it('uploads a selected file and resets the input value', async () => {
    mockOnUpload.mockResolvedValue(true);
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    const event = { target: { files: [file], value: 'resume.pdf' } };

    await act(async () => {
      result.current.handleFileChange(event);
      await flushPromises();
    });

    expect(mockOnUpload).toHaveBeenCalledWith(file);
    expect(event.target.value).toBeNull();
    expect(result.current.uploadSuccess).toBe(true);
  });

  it('sets isUploading while upload promise is pending', async () => {
    let resolveUpload;
    mockOnUpload.mockReturnValue(new Promise((resolve) => {
      resolveUpload = resolve;
    }));
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.processUpload(file);
    });

    expect(result.current.isUploading).toBe(true);

    await act(async () => {
      resolveUpload(true);
      await flushPromises();
    });

    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadSuccess).toBe(true);
  });

  it('auto-clears uploadSuccess after 3 seconds', async () => {
    vi.useFakeTimers();
    mockOnUpload.mockResolvedValue(true);
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.processUpload(file);
    });

    expect(result.current.uploadSuccess).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.uploadSuccess).toBe(false);
  });

  it('does not set uploadSuccess on upload failure', async () => {
    mockOnUpload.mockResolvedValue(false);
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.processUpload(file);
    });

    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadSuccess).toBe(false);
  });

  it('allows local validation messages to be set and clears them on upload', async () => {
    mockOnUpload.mockResolvedValue(true);
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });

    act(() => result.current.setLocalValidationMessage('Old error'));
    expect(result.current.localValidationMessage).toBe('Old error');

    await act(async () => {
      await result.current.processUpload(file);
    });

    expect(result.current.localValidationMessage).toBe('');
  });

  it.each(['resume.pdf', 'resume.PDF', 'resume.docx'])('accepts %s', (fileName) => {
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], fileName);

    act(() => result.current.handleDrop(buildDropEvent(file)));

    expect(mockOnUpload).toHaveBeenCalledWith(file);
  });

  it.each(['resume.doc', 'resume.txt', 'resume'])('rejects %s', (fileName) => {
    const { result } = renderHook(() => useCvUpload({ onUpload: mockOnUpload }));
    const file = new File(['content'], fileName);

    act(() => result.current.handleDrop(buildDropEvent(file)));

    expect(mockOnUpload).not.toHaveBeenCalled();
    expect(result.current.localValidationMessage).toContain('Only PDF and DOCX');
  });
});
