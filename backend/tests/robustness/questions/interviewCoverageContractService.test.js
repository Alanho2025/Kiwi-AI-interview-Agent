import { describe, expect, it } from 'vitest';

import { trackInterviewCoverage } from '../../../src/services/questions/interviewCoverageContractService.js';

describe('interviewCoverageContractService', () => {
  const proofStrategy = {
    mustCover: [
      { coverageId: 'cov-react', roleIntentId: 'intent-react', minQuestions: 2, status: 'pending' },
      { coverageId: 'cov-node', roleIntentId: 'intent-node', minQuestions: 1, status: 'pending' },
      { coverageId: 'cov-generic', roleIntentId: null, minQuestions: 1, status: 'degraded' },
    ],
  };
  const poolItems = [
    { questionId: 'q-react-1', coverageContractIds: ['cov-react'], testedRoleIntentIds: ['intent-react'] },
    { questionId: 'q-react-2', coverageContractIds: ['cov-react'], testedRoleIntentIds: ['intent-react'] },
  ];

  it('honours minQuestions and ignores repair or confirmation turns', () => {
    const tracked = trackInterviewCoverage({
      proofStrategy,
      poolItems,
      transcript: [
        { role: 'ai', questionId: 'q-react-1', metadata: { countsAsQuestion: true, turnType: 'interview_question' } },
        { role: 'ai', questionId: 'q-react-2', metadata: { countsAsQuestion: false, turnType: 'transcript_confirmation' } },
      ],
    });

    expect(tracked.find((item) => item.coverageId === 'cov-react')).toMatchObject({
      status: 'pending',
      askedQuestionCount: 1,
      minQuestions: 2,
    });
  });

  it('marks missing active coverage as unresolved and preserves degraded contracts', () => {
    const tracked = trackInterviewCoverage({ proofStrategy, poolItems, transcript: [] });

    expect(tracked.find((item) => item.coverageId === 'cov-node').status).toBe('unresolved');
    expect(tracked.find((item) => item.coverageId === 'cov-generic').status).toBe('degraded');
  });
});
