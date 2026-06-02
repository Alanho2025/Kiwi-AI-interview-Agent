import { describe, expect, it } from 'vitest';

import { shouldMarkPreparedRootQuestionAsked } from '../../../src/services/masterAiService.js';

describe('question metadata persistence guards', () => {
  it('marks prepared pool items asked only for root questions', () => {
    expect(shouldMarkPreparedRootQuestionAsked({
      interviewerOutput: {
        turnKind: 'root_question',
        preparedQuestionId: 'prepared-root-1',
      },
    })).toBe(true);

    expect(shouldMarkPreparedRootQuestionAsked({
      interviewerOutput: {
        turnKind: 'follow_up',
        preparedQuestionId: 'prepared-root-1',
        parentPreparedQuestionId: 'prepared-root-1',
      },
    })).toBe(false);

    expect(shouldMarkPreparedRootQuestionAsked({
      interviewerOutput: {
        questionDecision: {
          turnKind: 'follow_up',
          parentPreparedQuestionId: 'prepared-root-1',
        },
      },
    })).toBe(false);
  });
});
