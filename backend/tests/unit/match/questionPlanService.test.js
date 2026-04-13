import { describe, expect, it } from 'vitest';
import { buildQuestionPlanHints } from '../../../src/services/match/questionPlanService.js';

describe('buildQuestionPlanHints', () => {
  it('builds probing hints from rubric, unmet requirements, and project stack', () => {
    const hints = buildQuestionPlanHints({
      rubric: {
        roleCanonical: 'backend_engineer',
        roleFamily: 'software',
        roleLevel: 'mid',
        interviewTargets: {
          prioritySkills: ['Node.js', 'System Design'],
          experienceFocus: ['API delivery'],
          behaviouralFocus: ['ownership'],
        },
      },
      requirementChecks: [{ label: 'AWS', status: 'partial' }],
      microScores: [{ label: 'Distributed Systems', score: 60 }],
      cvEvidenceProfile: {
        sections: { projects: [{ techStack: ['Postgres', 'Docker'] }] },
        behaviouralCapabilities: ['stakeholder_collaboration'],
      },
      settings: { enableNZCultureFit: true },
      transitionProfile: { careerTransitionSignal: 0.75 },
    });

    expect(hints.mustProbeSkills).toEqual(expect.arrayContaining(['Node.js', 'System Design', 'AWS', 'Postgres']));
    expect(hints.mustProbeBehavioural).toEqual(expect.arrayContaining(['ownership', 'teamwork', 'communication', 'adaptability']));
    expect(hints.mustProbeExperience).toContain('career transition story');
  });
});
