import { describe, expect, it } from 'vitest';
import { cleanDisplayTitle, buildCanonicalRoleMeta, buildInterviewPlanPayload } from '../../../src/services/session/sessionShared.js';
import { getOpeningQuestionText } from '../../../src/services/interviewStateService.js';

describe('session display title cleanup', () => {
  it.each([
    ['We are hiring a Software Engineer (agentic)', 'Software Engineer (agentic)'],
    ['Hiring for a Senior Backend Engineer', 'Senior Backend Engineer'],
    ['We are looking for a Full Stack Developer', 'Full Stack Developer'],
    ['Join us as a Data Engineer', 'Data Engineer'],
    ['Open role: Platform Engineer', 'Platform Engineer'],
  ])('cleans cached bad display title %s', (input, expected) => {
    expect(cleanDisplayTitle(input)).toBe(expected);
  });

  it.each(['Hiring Manager', 'Hiring Coordinator', 'Recruitment Manager', 'Talent Acquisition Specialist', 'People & Culture Advisor'])('keeps legitimate hiring-related role titles: %s', (input) => {
    expect(cleanDisplayTitle(input)).toBe(input);
  });

  it('cleans cached bad title before building the opening question', () => {
    const normalizedAnalysis = {
      jobTitle: 'We are hiring a Software Engineer (agentic)',
      parsedJdProfile: { title: 'We are hiring a Software Engineer (agentic)' },
      matchingDetails: { questionPlanHints: {}, rubric: {} },
    };

    const plan = buildInterviewPlanPayload({
      normalizedAnalysis,
      settings: { seniorityLevel: 'Junior', focusArea: 'Combined' },
      resolvedCandidateName: 'Candidate',
      resolvedTargetRole: '',
    });

    const opening = getOpeningQuestionText({ interviewPlan: plan });
    expect(opening).toContain('Software Engineer (Agentic) interview');
    expect(opening).not.toMatch(/we are hiring/i);
  });

  it('cleans cached bad resolved title before building role metadata', () => {
    const roleMeta = buildCanonicalRoleMeta({
      resolvedTargetRole: 'We are hiring a Software Engineer (agentic)',
      normalizedAnalysis: {},
      settings: { seniorityLevel: 'Junior', focusArea: 'Combined' },
    });

    expect(roleMeta.displayTitle).toBe('Software Engineer (Agentic)');
    expect(roleMeta.compactRoleLabel).toBe('Software Engineer (Agentic)');
  });
});
