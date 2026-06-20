import { describe, expect, it } from 'vitest';

import * as masterAiService from '../../../src/services/masterAiService.js';

const { shouldMarkPreparedRootQuestionAsked } = masterAiService;

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

  it('builds transcript metadata with role assessment context', () => {
    const metadata = masterAiService.buildQuestionTranscriptMetadata?.({
      stage: 'role_requirement',
      topic: 'clinical safety',
      questionType: 'validate_requirement',
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      roleDomain: 'healthcare',
      requirementCategory: 'compliance_or_safety',
      capabilityGroup: 'compliance_ethics_safety',
    });

    expect(metadata).toMatchObject({
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      roleDomain: 'healthcare',
      requirementCategory: 'compliance_or_safety',
      capabilityGroup: 'compliance_ethics_safety',
    });
  });
});
