import { describe, expect, it } from 'vitest';
import { buildInterviewModeKey, resolveInterviewModeConfig } from '../../../src/config/interviewBlueprints.js';
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

describe('interview mode matrix', () => {
  it('builds all 9 mode keys through the two-dimensional settings contract', () => {
    const keys = new Set();
    for (const seniorityLevel of ['Junior/Grad', 'Intermediate', 'Advanced']) {
      for (const focusArea of ['Technical', 'Behavioral', 'Combined']) {
        keys.add(buildInterviewModeKey({ seniorityLevel, focusArea }));
      }
    }
    expect(keys.size).toBe(9);
    expect(keys.has('advanced_combined')).toBe(true);
  });

  it('restricts behavioural mode to opening, behavioural, and wrap-up questions', () => {
    const pool = buildQuestionPoolFromAnalysis(analysis, { seniorityLevel: 'Intermediate', focusArea: 'Behavioral' }, { resolvedTargetRole: 'Senior Web Software Engineer' });
    expect(pool.every((item) => ['opening', 'behavioural', 'wrap_up'].includes(item.stage))).toBe(true);
    expect(pool.some((item) => item.category === 'technical')).toBe(false);
  });

  it('restricts technical mode to opening, technical, and wrap-up questions', () => {
    const pool = buildQuestionPoolFromAnalysis(analysis, { seniorityLevel: 'Intermediate', focusArea: 'Technical' }, { resolvedTargetRole: 'Senior Web Software Engineer' });
    expect(pool.every((item) => ['opening', 'technical', 'wrap_up'].includes(item.stage))).toBe(true);
    expect(pool.some((item) => item.category === 'behavioural')).toBe(false);
  });

  it('keeps combined mode coverage for both behavioural and technical questions', () => {
    const pool = buildQuestionPoolFromAnalysis(analysis, { seniorityLevel: 'Advanced', focusArea: 'Combined' }, { resolvedTargetRole: 'Senior Web Software Engineer' });
    expect(pool.some((item) => item.category === 'technical')).toBe(true);
    expect(pool.some((item) => item.category === 'behavioural')).toBe(true);
    expect(pool[0].text).toContain('Senior Web Software Engineer interview');
  });

  it('maps advanced combined to deeper technical coverage requirements', () => {
    const config = resolveInterviewModeConfig({ seniorityLevel: 'Advanced', focusArea: 'Combined' });
    expect(config.interviewModeKey).toBe('advanced_combined');
    expect(config.minTechnicalQuestions).toBe(2);
    expect(config.minBehaviouralQuestions).toBe(1);
  });
});
