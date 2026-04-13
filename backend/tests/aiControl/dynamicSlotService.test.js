import { describe, expect, it } from 'vitest';
import { deriveDynamicSlots } from '../../src/services/aiControl/dynamicSlotService.js';

describe('dynamicSlotService', () => {
  it('adds a new dynamic slot from answer signals', () => {
    const state = deriveDynamicSlots({
      latestAnswer: 'I designed the architecture and made scalability decisions.',
      coverageState: { coveredTopics: [] },
      existingState: { activeSlots: [], activeSlotTopics: [], prunedSlots: [] },
    });

    expect(state.activeSlotTopics).toContain('system_design');
  });
});
