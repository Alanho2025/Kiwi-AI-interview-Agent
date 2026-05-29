import { describe, expect, it } from 'vitest';
import {
  applyJdFilterToCvSeeds,
  buildJdQuestionFilterProfile,
} from '../../../src/services/questions/jdQuestionFilterService.js';

describe('jdQuestionFilterService', () => {
  const jdProfile = buildJdQuestionFilterProfile({
    jdRubric: {
      technicalSkillRequirements: ['React', 'SQL'],
      softSkillRequirements: ['communication'],
    },
    analysisResult: {
      matchingDetails: {
        questionPlanHints: {
          priorityTopics: ['React'],
          mustProbeSkills: ['React'],
        },
      },
    },
  });

  it('boosts matching technical seeds', () => {
    const result = applyJdFilterToCvSeeds({
      jdProfile,
      cvSeeds: [{
        seedId: 'seed-react',
        topic: 'React',
        category: 'technical',
        skillTags: ['React'],
        confidence: 0.8,
      }],
      analysisResult: { matchingDetails: { questionPlanHints: { priorityTopics: ['React'] } } },
    });

    expect(result.boostedSeedIds).toContain('seed-react');
  });

  it('suppresses unrelated low-confidence seeds', () => {
    const result = applyJdFilterToCvSeeds({
      jdProfile,
      cvSeeds: [{
        seedId: 'seed-low',
        topic: 'photography',
        category: 'technical',
        skillTags: ['photography'],
        confidence: 0.2,
      }],
    });

    expect(result.suppressedSeedIds).toContain('seed-low');
  });

  it('adapts a CV seed angle based on a JD priority skill', () => {
    const result = applyJdFilterToCvSeeds({
      jdProfile,
      cvSeeds: [{
        seedId: 'seed-frontend',
        topic: 'frontend development',
        category: 'technical',
        skillTags: ['React', 'frontend'],
        confidence: 0.8,
        draftQuestion: 'Tell me about frontend development.',
      }],
    });

    const decision = result.decisions.find((item) => item.seedId === 'seed-frontend');
    expect(decision.decision).toBe('adapt');
    expect(decision.adaptedQuestionText).toContain('React');
  });
});
