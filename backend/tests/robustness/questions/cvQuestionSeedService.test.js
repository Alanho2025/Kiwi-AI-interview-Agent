import { describe, expect, it } from 'vitest';
import { buildCvProfile } from '../../../src/services/cv/cvProfileBuilderService.js';
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
    expect(seeds.map((seed) => seed.questionIntent)).toEqual(expect.arrayContaining([
      'validate_ownership',
      'validate_depth',
      'behavioural_star',
      'validate_result',
    ]));
    expect(seeds.every((seed) => seed.userId === 'user-1' && seed.cvFileId === 'cv-1')).toBe(true);
    expect(seeds.every((seed) => !seed.rawText && !seed.normalizedText)).toBe(true);
    const projectSeed = seeds.find((seed) => seed.sourceType === 'cv_project');
    expect(projectSeed.draftQuestion).toMatch(/Your CV says you used React in Analytics dashboard/i);
    expect(projectSeed.draftQuestion).toMatch(/actual implementation/i);
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

  it('keeps parsed Alan-style project evidence as project-specific question seeds', () => {
    const profile = buildCvProfile(`Alan Ho
alan.ho0828@gmail.com | +64 020 4184 4951 | Auckland CBD

PERSONAL STATEMENT
Master of Information Technology student building full-stack AI products.

PROJECTS
March 2026 –
current
KIWI Mock Interview AI Agent, University of Auckland | Web: https://kiwi-ai-interview-
agent.vercel.app/
Tech: React, Express, Python, PostgreSQL, MongoDB, DeepSeek API, Azure Speech,
WebSocket
Built a full-stack AI interview coaching system with CV-JD matching, adaptive questioning,
voice interaction, and structured feedback.
• Developed a real-time voice interview prototype using Azure Speech and WebSocket.
-- 1 of 2 --
March 2026 – May
2026
Full-Stack Food AI agent, University of Auckland | Web: https://forkcast.win/
Tech: React, Express, JavaScript, MongoDB, DeepSeek API, Tailwind CSS
Built a full-stack AI food recommendation web app for campus food choices.
• Collected and cleaned data for 50 restaurants and 1,900 menu items.

WORK EXPERIENCE
Oct 2021 - Jul 2024 Senior Electrical Engineer, Foxconn
Improved test process outcomes by using design of experiments and failure analysis.`);

    const seeds = buildCvQuestionSeedCandidates({
      userId: 'user-1',
      cvFileId: 'cv-1',
      cvProfile: profile,
    });
    const projectSeeds = seeds.filter((seed) => seed.sourceType === 'cv_project');
    const projectTags = projectSeeds.map((seed) => seed.projectTags[0]);

    expect(projectTags).toEqual(expect.arrayContaining([
      expect.stringMatching(/KIWI Mock Interview AI Agent/i),
      expect.stringMatching(/Full-Stack Food AI agent/i),
    ]));
    expect(projectTags).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^March 2026/i),
    ]));
    expect(projectSeeds.every((seed) => seed.skillTags.includes('react'))).toBe(true);
    expect(projectSeeds.every((seed) => !seed.skillTags.includes('c'))).toBe(true);
    expect(projectSeeds.every((seed) => /Your CV says you used/i.test(seed.draftQuestion))).toBe(true);
  });
});
