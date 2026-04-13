import { describe, expect, it } from 'vitest';
import { buildReflectionRecord, shouldWriteReflection } from '../../../src/services/aiControl/reflectionWriterService.js';
import { buildMemorySummary } from '../../../src/services/aiControl/experienceMemoryService.js';

describe('Reflexion behavior scenarios', () => {
  it('writes reflection after misunderstanding and compresses memory into a summary', () => {
    const shouldReflect = shouldWriteReflection({
      evaluatorState: { misunderstandingFlag: true, evidenceGainScore: 0.22 },
      decisionContext: { currentTopic: 'system_design', currentStage: 'technical_core' },
      trajectoryStep: { section: 'technical_core', targetTopic: 'system_design' },
    });
    expect(shouldReflect).toBe(true);

    const reflection = buildReflectionRecord({
      sessionId: 's1',
      userId: 'u1',
      evaluatorState: { misunderstandingFlag: true, evidenceGainScore: 0.22, overallInteractionScore: 0.4 },
      decisionContext: { currentTopic: 'system_design', currentStage: 'technical_core' },
      trajectoryStep: { section: 'technical_core', targetTopic: 'system_design' },
    });

    const summary = buildMemorySummary([reflection]);
    expect(reflection.lesson).toMatch(/one concrete example/i);
    expect(summary).toMatch(/one concrete example/i);
  });

  it('captures hidden-gap lessons when abductive probing is active', () => {
    const reflection = buildReflectionRecord({
      sessionId: 's2',
      userId: 'u2',
      evaluatorState: { misunderstandingFlag: false, evidenceGainScore: 0.71, overallInteractionScore: 0.7 },
      decisionContext: { currentTopic: 'api_security', currentStage: 'technical_core', abductiveState: { shouldProbe: true, hiddenGap: 'production security trade-offs' } },
      trajectoryStep: { section: 'technical_core', targetTopic: 'api_security' },
    });

    expect(reflection.pattern).toBe('hidden_gap_detected');
    expect(reflection.lesson).toMatch(/production security trade-offs/i);
  });
});
