import { describe, expect, it } from 'vitest';
import {
  buildInterviewQuestionPoolItems,
  buildPreparedRootQuestionPoolQuery,
} from '../../../src/services/questions/questionPoolComposerService.js';

const baseArgs = {
  userId: 'user-1',
  sessionId: 'session-1',
  cvFileId: 'cv-1',
  matchAnalysisId: 'match-1',
  jdFingerprint: 'jd-1',
  settings: { focusArea: 'Combined', seniorityLevel: 'Junior/Grad' },
};

describe('questionPoolComposerService', () => {
  it('creates opening, motivation, role requirement, gap, behavioural, and wrap-up questions', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        jobTitle: 'Frontend Developer',
        gaps: ['testing evidence'],
        requirementChecks: [{ requirement: 'React', met: false, category: 'technical' }],
        matchingDetails: {
          questionPlanHints: {
            mustProbeSkills: ['React'],
            mustProbeBehavioural: ['teamwork'],
            priorityTopics: ['React'],
          },
        },
      },
      cvSeeds: [{
        seedId: 'seed-1',
        sourceType: 'cv_project',
        topic: 'React',
        category: 'technical',
        questionIntent: 'validate_ownership',
        draftQuestion: 'Tell me about one React project.',
        skillTags: ['React'],
        confidence: 0.8,
        priorityWeight: 0.7,
      }],
      jdFilter: { filterDecisions: [{ seedId: 'seed-1', decision: 'boost', scoreDelta: 0.2 }] },
    });

    expect(pool.some((item) => item.category === 'opening')).toBe(true);
    expect(pool.some((item) => item.category === 'motivation')).toBe(true);
    expect(pool.some((item) => item.sourceType === 'jd_requirement')).toBe(true);
    expect(pool.some((item) => item.sourceStage === 'match_gap')).toBe(true);
    expect(pool.some((item) => item.category === 'behavioural')).toBe(true);
    expect(pool.some((item) => item.category === 'closing')).toBe(true);
    expect(pool.every((item) => ['root_question', 'fallback_root', 'wrap_up'].includes(item.questionRole))).toBe(true);
    expect(pool.every((item) => Number.isFinite(item.maxFollowUps))).toBe(true);
    expect(pool.every((item) => Array.isArray(item.followUpStrategies))).toBe(true);
    expect(pool.find((item) => item.category === 'closing').questionRole).toBe('wrap_up');
    expect(pool.find((item) => item.sourceStage === 'match_gap').questionRole).toBe('root_question');
  });

  it('deduplicates similar questions and keeps fallback technical and behavioural coverage', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        matchingDetails: { questionPlanHints: { mustProbeSkills: [], mustProbeBehavioural: [] } },
      },
      cvSeeds: [
        {
          seedId: 'seed-1',
          sourceType: 'cv_skill',
          topic: 'React',
          category: 'technical',
          questionIntent: 'validate_depth',
          draftQuestion: 'Tell me about React.',
          confidence: 0.8,
        },
        {
          seedId: 'seed-2',
          sourceType: 'cv_skill',
          topic: 'React',
          category: 'technical',
          questionIntent: 'validate_depth',
          draftQuestion: 'Tell me about another React example.',
          confidence: 0.8,
        },
      ],
    });

    const reactDepthItems = pool.filter((item) => item.topic === 'React' && item.questionIntent === 'validate_depth');
    expect(reactDepthItems).toHaveLength(1);
    expect(pool.some((item) => ['technical', 'role_competency'].includes(item.category))).toBe(true);
    expect(pool.some((item) => item.category === 'behavioural')).toBe(true);
  });

  it('queries prepared root questions with backward compatibility for legacy records', () => {
    const query = buildPreparedRootQuestionPoolQuery({
      sessionId: 'session-1',
      category: 'Technical',
      status: 'active',
    });

    expect(query).toEqual({
      sessionId: 'session-1',
      status: 'active',
      category: 'technical',
      $or: [
        { questionRole: 'root_question' },
        { questionRole: { $exists: false } },
        { questionRole: null },
        { questionRole: '' },
      ],
    });
  });
});
