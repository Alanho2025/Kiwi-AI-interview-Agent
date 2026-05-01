import { describe, expect, it } from 'vitest';
import { buildRealtimeVoiceLatencySummary } from '../../../src/utils/realtimeVoiceLatencySummary.js';

describe('adaptive trace contract', () => {
  it('keeps backend adaptive markers populated so the UI does not fall back to n/a', () => {
    const latency = {
      totalMs: 6200,
      steps: [
        { step: 'backend_request_received', msFromStart: 1 },
        { step: 'adaptive.indexing_check_start', msFromStart: 10 },
        { step: 'adaptive.indexing_check', durationMs: 40 },
        { step: 'adaptive.indexing_check_end', msFromStart: 50 },
        { step: 'adaptive.retrieval_start', msFromStart: 51 },
        { step: 'adaptive.retrieval', durationMs: 320 },
        { step: 'adaptive.retrieval_end', msFromStart: 371 },
        { step: 'adaptive.environment_build_start', msFromStart: 372 },
        { step: 'adaptive.environment_build', durationMs: 5 },
        { step: 'adaptive.environment_build_end', msFromStart: 377 },
        { step: 'adaptive.turn_evaluation_start', msFromStart: 378 },
        { step: 'adaptive.turn_evaluation', durationMs: 1 },
        { step: 'adaptive.turn_evaluation_end', msFromStart: 379 },
        { step: 'adaptive.decision_context_start', msFromStart: 380 },
        { step: 'adaptive.decision_context', durationMs: 180 },
        { step: 'adaptive.decision_context_end', msFromStart: 560 },
        { step: 'adaptive.action_selection_start', msFromStart: 561 },
        { step: 'adaptive.action_selection', durationMs: 2 },
        { step: 'adaptive.action_selection_end', msFromStart: 563 },
        { step: 'adaptive.action_execution_start', msFromStart: 564 },
        { step: 'adaptive.action_execution', durationMs: 3350 },
        { step: 'adaptive.action_execution_end', msFromStart: 3914 },
        { step: 'adaptive.llm_first_sentence', msFromStart: 3000 },
        { step: 'adaptive.tts_first_audio', msFromStart: 4800 },
      ],
    };

    const summary = buildRealtimeVoiceLatencySummary(latency);
    [
      'adaptiveIndexingCheck',
      'adaptiveRetrieval',
      'adaptiveEnvironmentBuild',
      'adaptiveTurnEvaluation',
      'adaptiveDecisionContext',
      'adaptiveActionSelection',
      'adaptiveActionExecution',
      'adaptiveLlmFirstSentence',
      'adaptiveTtsFirstAudio',
    ].forEach((key) => {
      expect(summary[key]).not.toBe('n/a');
    });
  });
});
