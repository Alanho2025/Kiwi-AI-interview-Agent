import { describe, expect, it } from 'vitest';
import { buildCvQuestionSeedCandidates } from '../../../src/services/questions/cvQuestionSeedService.js';

describe('cvQuestionSeedService', () => {
  it('produces technical, experience, and behavioural seeds from a rich CV profile', () => {
    const seeds = buildCvQuestionSeedCandidates({
      userId: 'user-1',
      cvFileId: 'cv-1',
      cvProfile: {
        confidence: 0.8,
        skills: [{ label: 'React' }, { label: 'SQL' }],
        achievements: ['Reduced dashboard load time by 40%.'],
        evidenceProfile: {
          sections: {
            projects: [{ title: 'Analytics dashboard', skills: ['React'], summary: 'Built a reporting UI.' }],
          },
          functionalCapabilities: [{ label: 'SQL', summary: 'Database reporting.' }],
          behaviouralCapabilities: [{ label: 'stakeholder communication' }],
          quantifiedEvidence: ['Improved reporting speed by 40%.'],
        },
      },
    });

    expect(seeds.some((seed) => seed.category === 'technical')).toBe(true);
    expect(seeds.some((seed) => seed.category === 'behavioural')).toBe(true);
    expect(seeds.some((seed) => seed.questionIntent === 'validate_result')).toBe(true);
    expect(seeds.every((seed) => seed.userId === 'user-1' && seed.cvFileId === 'cv-1')).toBe(true);
    expect(seeds.every((seed) => !seed.rawText && !seed.normalizedText)).toBe(true);
  });

  it('does not crash on a sparse CV profile', () => {
    const seeds = buildCvQuestionSeedCandidates({
      userId: 'user-1',
      cvFileId: 'cv-1',
      cvProfile: { summary: 'Junior developer.' },
    });

    expect(seeds.length).toBeGreaterThan(0);
    expect(seeds[0]).toEqual(expect.objectContaining({
      questionIntent: expect.any(String),
      draftQuestion: expect.any(String),
      status: 'active',
    }));
  });
});
