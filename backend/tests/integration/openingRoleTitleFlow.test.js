import { describe, expect, it } from 'vitest';
import { extractJobDescriptionHeader } from '../../src/services/jobDescription/jobDescriptionHeaderExtractor.js';
import { buildInterviewPlanPayload } from '../../src/services/session/sessionShared.js';
import { getOpeningQuestionText } from '../../src/services/interviewStateService.js';

describe('JD title to opening question integration flow', () => {
  it('does not leak JD marketing copy into the first interview script', () => {
    const jdText = `We are hiring a Software Engineer (agentic)
Auckland
About the role
Build agentic AI workflows.`;
    const header = extractJobDescriptionHeader({ rawJD: jdText });

    expect(header.title).toBe('Software Engineer (agentic)');

    const plan = buildInterviewPlanPayload({
      normalizedAnalysis: {
        jobTitle: header.title,
        parsedJdProfile: { title: header.title },
        matchingDetails: { questionPlanHints: {}, rubric: {} },
        interviewFocus: ['agentic AI', 'software engineering'],
      },
      settings: { seniorityLevel: 'Junior', focusArea: 'Combined' },
      resolvedCandidateName: 'Candidate',
      resolvedTargetRole: header.title,
    });

    const opening = getOpeningQuestionText({ interviewPlan: plan });
    expect(opening).toMatch(/Software Engineer \(Agentic\) interview/i);
    expect(opening).not.toMatch(/we are hiring/i);
  });
});
