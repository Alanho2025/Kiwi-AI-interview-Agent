import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  matchCVStream: vi.fn(),
  generateInterviewPlan: vi.fn(),
}));

vi.mock('../../api/analyzeApi.js', () => ({
  matchCVStream: apiMocks.matchCVStream,
  generateInterviewPlan: apiMocks.generateInterviewPlan,
}));

import { useMatchAnalysisFlow } from '../useMatchAnalysisFlow.js';

const matchInput = {
  cvId: 'cv-1',
  rawJD: 'Reviewed JD',
  jdRubric: { roleFit: { id: 'role-fit-1' } },
  settings: {},
};

const planInput = {
  cvId: 'cv-1',
  rawJD: 'Reviewed JD',
  jdText: 'Structured JD',
  jdRubric: { roleFit: { id: 'role-fit-1' } },
  settings: {},
  mode: 'voice',
};

describe('useMatchAnalysisFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the completed Match while interview preparation is still running', async () => {
    let resolvePlan;
    const planPromise = new Promise((resolve) => {
      resolvePlan = resolve;
    });
    apiMocks.matchCVStream.mockImplementation(async ({ onEvent }) => {
      onEvent({
        type: 'stage_progress',
        sequence: 1,
        stage: { id: 'evidence_match', label: 'Matching your CV evidence', status: 'started' },
      });
      onEvent({
        type: 'match_completed',
        sequence: 2,
        data: { result: { matchScore: 78, matchAnalysisId: 'match-1' } },
      });
      return { matchScore: 78, matchAnalysisId: 'match-1' };
    });
    apiMocks.generateInterviewPlan.mockReturnValue(planPromise);

    const { result } = renderHook(() => useMatchAnalysisFlow());
    let runPromise;
    act(() => {
      runPromise = result.current.run({ matchInput, planInput });
    });

    await waitFor(() => {
      expect(result.current.matchStatus).toBe('completed');
      expect(result.current.planStatus).toBe('preparing');
    });
    expect(result.current.analysisResult).toEqual(expect.objectContaining({ matchScore: 78 }));
    expect(result.current.currentStage).toBe('evidence_match');

    await act(async () => {
      resolvePlan({
        sessionId: 'session-voice-1',
        questionPool: {
          count: 6,
          readiness: 'ready',
          proofStrategy: { status: 'ready', focusAreas: [] },
        },
      });
      await runPromise;
    });

    expect(result.current.planStatus).toBe('ready');
    expect(result.current.generatedSessionId).toBe('session-voice-1');
  });

  it('keeps the Match result when preparation fails and supports plan-only retry', async () => {
    apiMocks.matchCVStream.mockResolvedValue({
      matchScore: 78,
      matchAnalysisId: 'match-1',
    });
    apiMocks.generateInterviewPlan
      .mockRejectedValueOnce(new Error('plan unavailable'))
      .mockResolvedValueOnce({
        sessionId: 'session-voice-1',
        questionPool: {
          count: 6,
          readiness: 'ready',
          proofStrategy: { status: 'ready', focusAreas: [] },
        },
      });

    const { result } = renderHook(() => useMatchAnalysisFlow());

    await act(async () => {
      await expect(result.current.run({ matchInput, planInput })).rejects.toMatchObject({
        phase: 'plan',
      });
    });

    expect(result.current.matchStatus).toBe('completed');
    expect(result.current.planStatus).toBe('failed');
    expect(result.current.analysisResult.matchAnalysisId).toBe('match-1');

    await act(async () => {
      await result.current.retryPlan();
    });

    expect(apiMocks.matchCVStream).toHaveBeenCalledTimes(1);
    expect(apiMocks.generateInterviewPlan).toHaveBeenCalledTimes(2);
    expect(result.current.planStatus).toBe('ready');
    expect(result.current.generatedSessionId).toBe('session-voice-1');
  });

  it('does not start preparation when the canonical Match fails', async () => {
    apiMocks.matchCVStream.mockRejectedValue(Object.assign(new Error('Corrupted CV'), {
      code: 'CORRUPTED',
      repairTarget: 'cv',
    }));

    const { result } = renderHook(() => useMatchAnalysisFlow());

    await act(async () => {
      await expect(result.current.run({ matchInput, planInput })).rejects.toMatchObject({
        phase: 'match',
        code: 'CORRUPTED',
      });
    });

    expect(result.current.matchStatus).toBe('failed');
    expect(result.current.planStatus).toBe('idle');
    expect(apiMocks.generateInterviewPlan).not.toHaveBeenCalled();
  });
});
