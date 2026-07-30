import { describe, expect, it } from 'vitest';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';

describe('actionPlanner Priority Chain & Smart Gates (V6 Blueprint)', () => {
  it('triggers EARLY_TOPIC_CLOSE (SWITCH_TOPIC) when assessment contract is satisfied', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'postgresql_optimization',
      evaluatorState: { specificity: 'high', evidenceGainScore: 0.85 },
      assessmentContract: { satisfactionStatus: 'satisfied', missingSignals: [] },
      coverageState: { missingTopics: ['redis'], coveredTopics: ['postgresql_optimization'] },
      sectionState: { sectionKey: 'technical', isSectionComplete: false },
      interviewStructure: { focusAreaKey: 'technical', isFinalPlannedTurn: false },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.SWITCH_TOPIC);
    expect(plan.rationale).toMatch(/early_topic_close|satisfied/i);
  });

  it('triggers Candidate Denial Fast Pivot when candidateDenial is true', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'technical_core',
      currentTopic: 'kafka_streaming',
      evaluatorState: { specificity: 'low', candidateDenial: true, evidenceStatus: 'EXPLICIT_NO_EXPERIENCE' },
      assessmentContract: { satisfactionStatus: 'unsatisfied', missingSignals: ['kafka_ownership'] },
      coverageState: { missingTopics: ['docker_containers'], coveredTopics: ['kafka_streaming'] },
      sectionState: { sectionKey: 'technical', isSectionComplete: false },
      interviewStructure: { focusAreaKey: 'technical', isFinalPlannedTurn: false },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.SWITCH_TOPIC);
    expect(plan.rationale).toMatch(/denial|fast_pivot/i);
  });
});
