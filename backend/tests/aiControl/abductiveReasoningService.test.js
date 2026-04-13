import { describe, expect, it } from 'vitest';
import { deriveAbductiveState } from '../../src/services/aiControl/abductiveReasoningService.js';

describe('abductiveReasoningService', () => {
  it('detects deployment depth gap from production wording', () => {
    const state = deriveAbductiveState({
      latestAnswer: 'I worked on the project but not in production yet.',
      currentTopic: 'deployment',
      candidateState: { specificityLevel: 'low' },
      dynamicSlotState: { activeSlotTopics: [] },
    });

    expect(state.shouldProbe).toBe(true);
    expect(state.hiddenGap).toBe('deployment_depth');
  });
});
