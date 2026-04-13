import { describe, expect, it } from 'vitest';
import { buildReflectionRecord, shouldWriteReflection } from '../../src/services/aiControl/reflectionWriterService.js';

describe('reflectionWriterService', () => {
  it('triggers reflection for misunderstood turns', () => {
    const result = shouldWriteReflection({
      evaluatorState: { misunderstandingFlag: true, evidenceGainScore: 0.2 },
      decisionContext: {},
      trajectoryStep: {},
    });
    expect(result).toBe(true);
  });

  it('builds a concrete lesson from weak evidence', () => {
    const reflection = buildReflectionRecord({
      sessionId: 'session-1',
      userId: 'user-1',
      evaluatorState: { misunderstandingFlag: false, evidenceGainScore: 0.3, repetitionRisk: true, overallInteractionScore: 0.48 },
      decisionContext: { currentTopic: 'system_design', currentStage: 'technical_core' },
      trajectoryStep: { section: 'technical_core', targetTopic: 'system_design' },
    });

    expect(reflection.pattern).toBe('low_evidence_gain');
    expect(reflection.lesson).toContain('system_design');
    expect(reflection.recommendedNextStrategy).toBe('probe_specific_example');
  });
});
