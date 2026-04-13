import { describe, expect, it } from 'vitest';
import { buildNormalizedCvProfile } from '../../src/services/cv/cvProfileContractBuilder.js';

describe('buildNormalizedCvProfile', () => {
  it('normalizes projects, work history, and evidence profile for controller use', () => {
    const profile = buildNormalizedCvProfile({
      candidateName: 'Alan',
      skills: [{ label: 'Python' }, { label: 'SQL' }],
      projects: [{ title: 'Forkcast', description: 'Built a campus recommendation API and deployed it' }],
      workHistory: [{ role: 'Engineer', company: 'Foxconn', responsibilities: 'Improved failure analysis throughput by 50%' }],
      achievements: ['Reduced abnormal retest rate from 15% to 5%'],
      evidenceProfile: { quantifiedEvidence: ['50% improvement'] },
    }, {});

    expect(profile.skills).toContain('Python');
    expect(profile.projects[0].title).toBe('Forkcast');
    expect(profile.evidenceProfile.quantifiedEvidence.some((item) => item.includes('50%'))).toBe(true);
  });
});
