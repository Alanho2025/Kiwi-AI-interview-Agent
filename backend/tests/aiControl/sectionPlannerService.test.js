import { describe, expect, it } from 'vitest';
import { inferInterviewSection, buildSectionState } from '../../src/services/aiControl/sectionPlannerService.js';

describe('sectionPlannerService', () => {
  it('infers technical section from topic', () => {
    expect(inferInterviewSection({ currentStage: 'technical_core', currentTopic: 'api_security' })).toBe('technical');
  });

  it('marks a section complete when target topics are already covered', () => {
    const state = buildSectionState({
      currentSection: 'motivation',
      coverageState: { coveredTopics: ['motivation', 'role_fit'], missingTopics: [] },
      dynamicSlotState: { activeSlotTopics: [] },
    });
    expect(state.isSectionComplete).toBe(true);
    expect(state.nextSectionKey).toBe('experience');
  });

  it('does not mark a section complete when coverage is partial even if missingTopics is empty', () => {
    const state = buildSectionState({
      currentSection: 'technical',
      coverageState: { coveredTopics: ['api_security'], missingTopics: [] },
      dynamicSlotState: { activeSlotTopics: [] },
    });
    expect(state.sectionCoverageScore).toBe(0.33);
    expect(state.isSectionComplete).toBe(false);
  });
});
