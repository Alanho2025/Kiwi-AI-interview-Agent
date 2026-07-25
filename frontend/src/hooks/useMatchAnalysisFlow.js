/**
 * File responsibility: Own Match streaming and interview-plan state transitions.
 */

import { useCallback, useReducer, useRef } from 'react';

import { generateInterviewPlan, matchCVStream } from '../api/analyzeApi.js';

const initialState = {
  matchStatus: 'idle',
  planStatus: 'idle',
  analysisResult: null,
  generatedSessionId: null,
  questionPoolInfo: null,
  currentStage: null,
  progressStages: {},
  lastSequence: 0,
  matchError: null,
  planError: null,
};

const reduceMatchEvent = (state, event = {}) => {
  const sequence = Number(event.sequence || 0);
  if (sequence && sequence <= state.lastSequence) return state;

  if (event.type === 'stage_progress' && event.stage?.id) {
    return {
      ...state,
      matchStatus: 'running',
      currentStage: event.stage.id,
      lastSequence: sequence || state.lastSequence,
      progressStages: {
        ...state.progressStages,
        [event.stage.id]: {
          ...event.stage,
          sequence,
        },
      },
    };
  }

  if (event.type === 'match_completed') {
    return {
      ...state,
      matchStatus: 'completed',
      analysisResult: event.data?.result || state.analysisResult,
      lastSequence: sequence || state.lastSequence,
    };
  }

  if (event.type === 'match_failed') {
    return {
      ...state,
      matchStatus: 'failed',
      matchError: event.data || null,
      lastSequence: sequence || state.lastSequence,
    };
  }

  return {
    ...state,
    lastSequence: sequence || state.lastSequence,
  };
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'RESET':
      return initialState;
    case 'MATCH_STARTED':
      return {
        ...initialState,
        matchStatus: 'running',
      };
    case 'MATCH_EVENT':
      return reduceMatchEvent(state, action.event);
    case 'MATCH_COMPLETED':
      return {
        ...state,
        matchStatus: 'completed',
        analysisResult: action.result,
        matchError: null,
      };
    case 'MATCH_FAILED':
      return {
        ...state,
        matchStatus: 'failed',
        matchError: action.error,
      };
    case 'PLAN_PREPARING':
      return {
        ...state,
        planStatus: 'preparing',
        planError: null,
      };
    case 'PLAN_READY':
      return {
        ...state,
        planStatus: action.degraded ? 'degraded' : 'ready',
        generatedSessionId: action.response.sessionId,
        questionPoolInfo: action.response.questionPool || null,
        planError: null,
      };
    case 'PLAN_FAILED':
      return {
        ...state,
        planStatus: 'failed',
        planError: action.error,
      };
    case 'HYDRATE':
      return {
        ...initialState,
        matchStatus: 'completed',
        planStatus: action.questionPoolInfo?.readiness === 'degraded' ? 'degraded' : 'ready',
        analysisResult: action.analysisResult,
        generatedSessionId: action.generatedSessionId,
        questionPoolInfo: action.questionPoolInfo || null,
      };
    default:
      return state;
  }
};

const withPhase = (error, phase) => {
  const normalized = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
  normalized.phase = phase;
  return normalized;
};

const isDegradedPlan = (response = {}) => response.questionPool?.readiness === 'degraded'
  || response.questionPool?.proofStrategy?.status === 'degraded';

export function useMatchAnalysisFlow() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const planInputRef = useRef(null);
  const matchResultRef = useRef(null);

  const preparePlan = useCallback(async (planInput, matchResult) => {
    dispatch({ type: 'PLAN_PREPARING' });
    try {
      const response = await generateInterviewPlan({
        ...planInput,
        matchAnalysisId: matchResult.matchAnalysisId,
      });
      dispatch({
        type: 'PLAN_READY',
        response,
        degraded: isDegradedPlan(response),
      });
      return response;
    } catch (error) {
      const phasedError = withPhase(error, 'plan');
      dispatch({ type: 'PLAN_FAILED', error: phasedError });
      throw phasedError;
    }
  }, []);

  const run = useCallback(async ({ matchInput, planInput }) => {
    dispatch({ type: 'MATCH_STARTED' });
    planInputRef.current = planInput;

    let matchResult;
    try {
      matchResult = await matchCVStream({
        ...matchInput,
        onEvent: (event) => dispatch({ type: 'MATCH_EVENT', event }),
      });
      matchResultRef.current = matchResult;
      dispatch({ type: 'MATCH_COMPLETED', result: matchResult });
    } catch (error) {
      const phasedError = withPhase(error, 'match');
      dispatch({ type: 'MATCH_FAILED', error: phasedError });
      throw phasedError;
    }

    const planResponse = await preparePlan(planInput, matchResult);
    return { matchResult, planResponse };
  }, [preparePlan]);

  const retryPlan = useCallback(async () => {
    if (!planInputRef.current || !matchResultRef.current?.matchAnalysisId) {
      throw new Error('A completed Match is required before retrying interview preparation.');
    }
    return preparePlan(planInputRef.current, matchResultRef.current);
  }, [preparePlan]);

  const reset = useCallback(() => {
    planInputRef.current = null;
    matchResultRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const hydrate = useCallback(({ analysisResult, generatedSessionId, questionPoolInfo = null }) => {
    matchResultRef.current = analysisResult;
    dispatch({
      type: 'HYDRATE',
      analysisResult,
      generatedSessionId,
      questionPoolInfo,
    });
  }, []);

  return {
    ...state,
    matchRate: state.analysisResult?.matchScore ?? null,
    analysisStatus: state.matchStatus === 'running'
      ? 'matching'
      : state.matchStatus === 'completed'
        ? 'success'
        : state.matchStatus === 'failed'
          ? 'error'
          : 'idle',
    run,
    retryPlan,
    reset,
    hydrate,
  };
}
