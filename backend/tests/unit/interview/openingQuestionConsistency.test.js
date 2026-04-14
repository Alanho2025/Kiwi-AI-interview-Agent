import { describe, expect, it } from 'vitest';
import { getOpeningQuestionText } from '../../../src/services/interviewStateService.js';
import { buildCanonicalRoleMeta, buildInterviewPlanPayload } from '../../../src/services/session/sessionShared.js';

const normalizedAnalysis = {
  jobTitle: 'Data Analyst',
  matchingDetails: {
    questionPlanHints: {
      mustProbeSkills: ['React', 'Node.js'],
      mustProbeBehavioural: ['teamwork', 'ownership'],
      roleCanonical: 'senior_web_software_engineer',
    },
    rubric: { roleCanonical: 'senior_web_software_engineer' },
  },
  parsedJdProfile: { title: 'Data Analyst', roleCanonical: 'senior_web_software_engineer' },
};

describe('opening question consistency', () => {
  it('locks the opening question to the resolved target role instead of stale analysis titles', () => {
    const plan = buildInterviewPlanPayload({
      normalizedAnalysis,
      settings: { seniorityLevel: 'Advanced', focusArea: 'Combined' },
      resolvedCandidateName: 'Alan Ho',
      resolvedTargetRole: 'Senior Web Software Engineer',
    });

    const session = { interviewPlan: plan };
    expect(getOpeningQuestionText(session)).toContain('Senior Web Software Engineer interview');
    expect(getOpeningQuestionText(session)).not.toContain('Data Analyst');
  });

  it('builds canonical role metadata from the resolved target role for the UI', () => {
    const roleMeta = buildCanonicalRoleMeta({
      resolvedTargetRole: 'Senior Web Software Engineer',
      normalizedAnalysis,
      settings: { seniorityLevel: 'Advanced', focusArea: 'Combined' },
    });
    expect(roleMeta.displayTitle).toBe('Senior Web Software Engineer');
    expect(roleMeta.compactRoleLabel).toBe('Senior Web Software Engineer');
    expect(roleMeta.interviewModeKey).toBe('advanced_combined');
  });
});
