import { describe, expect, it } from 'vitest';
import { AGENT_ACTION_TYPES } from '../../src/constants/agentActionTypes.js';
import { buildRetrievalObjective } from '../../src/services/retrieval/retrievalObjectiveBuilder.js';

describe('buildRetrievalObjective', () => {
  it('builds a validation objective for validation questions', () => {
    const objective = buildRetrievalObjective({
      taskType: 'interview_next_turn',
      actionType: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      targetTopic: 'full-stack experience',
    });

    expect(objective.objective).toBe('VALIDATE_CANDIDATE_CLAIM');
    expect(objective.targetTopic).toBe('full-stack experience');
  });
});
