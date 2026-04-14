import { describe, expect, it } from 'vitest';
import { buildQuestionPoolFromAnalysis } from '../../../src/services/session/sessionShared.js';

const analysis = {
  jobTitle: 'Senior Web Software Engineer',
  matchingDetails: {
    questionPlanHints: {
      mustProbeSkills: ['React', 'Node.js', 'AWS'],
      mustProbeBehavioural: ['teamwork', 'stakeholder communication', 'ownership'],
    },
    rubric: { roleCanonical: 'senior_web_software_engineer' },
  },
  parsedJdProfile: { title: 'Senior Web Software Engineer', roleCanonical: 'senior_web_software_engineer' },
};

describe('interview mode coverage scenarios', () => {
  it('advanced combined covers both behavioural and technical questions before wrap-up', () => {
    const pool = buildQuestionPoolFromAnalysis(analysis, { seniorityLevel: 'Advanced', focusArea: 'Combined' }, { resolvedTargetRole: 'Senior Web Software Engineer' });
    const categoriesBeforeWrap = pool.filter((item) => item.stage !== 'wrap_up').map((item) => item.category);
    expect(categoriesBeforeWrap[0]).toBe('opening');
    expect(categoriesBeforeWrap.includes('technical')).toBe(true);
    expect(categoriesBeforeWrap.includes('behavioural')).toBe(true);
  });

  it('intermediate technical never leaks behavioural prompts', () => {
    const pool = buildQuestionPoolFromAnalysis(analysis, { seniorityLevel: 'Intermediate', focusArea: 'Technical' }, { resolvedTargetRole: 'Senior Web Software Engineer' });
    expect(pool.some((item) => item.stage === 'behavioural')).toBe(false);
  });

  it('intermediate behavioural never leaks technical prompts', () => {
    const pool = buildQuestionPoolFromAnalysis(analysis, { seniorityLevel: 'Intermediate', focusArea: 'Behavioral' }, { resolvedTargetRole: 'Senior Web Software Engineer' });
    expect(pool.some((item) => item.stage === 'technical')).toBe(false);
  });
});
