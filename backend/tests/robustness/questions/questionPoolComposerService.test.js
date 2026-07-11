import { describe, expect, it } from 'vitest';
import {
  buildQuestionPoolReconciliationPlan,
  buildInterviewQuestionPoolItems,
  buildPreparedRootQuestionPoolQuery,
} from '../../../src/services/questions/questionPoolComposerService.js';
import * as questionPoolComposerService from '../../../src/services/questions/questionPoolComposerService.js';
import { validatePreparedQuestionPool } from '../../../src/services/schemaValidationService.js';

const baseArgs = {
  userId: 'user-1',
  sessionId: 'session-1',
  cvFileId: 'cv-1',
  matchAnalysisId: 'match-1',
  jdFingerprint: 'jd-1',
  settings: { focusArea: 'Combined', seniorityLevel: 'Junior/Grad' },
};

describe('questionPoolComposerService', () => {
  it('uses a cross-role fallback while keeping the internal technical category', () => {
    const pool = questionPoolComposerService.ensureMinimumFallbacks?.([], {
      userId: 'user-cross-role',
      sessionId: 'session-cross-role',
      roleDomain: 'healthcare',
    }) || [];
    const fallback = pool.find((item) => item.sourceType === 'fallback' && item.category === 'technical');

    expect(fallback?.text || '').toContain('role-specific task');
    expect(fallback?.text || '').not.toMatch(/what did you build|technical task/i);
    expect(fallback).toMatchObject({
      questionFamily: 'role_specific',
      roleDomain: 'healthcare',
    });
  });

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

  it('deduplicates identical wording across different topics and merges evidence', () => {
    const repeatedText = 'Tell me about a time you showed ownership. What was the situation, what did you do, and what changed afterwards?';
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        matchingDetails: { questionPlanHints: { mustProbeSkills: [], mustProbeBehavioural: [] } },
      },
      cvSeeds: [
        {
          seedId: 'ownership-seed',
          sourceType: 'cv_behavioural',
          topic: 'ownership',
          category: 'behavioural',
          questionIntent: 'behavioural_star',
          draftQuestion: repeatedText,
          evidenceRefs: [{ text: 'Owned the delivery plan.' }],
        },
        {
          seedId: 'accountability-seed',
          sourceType: 'cv_behavioural',
          topic: 'accountability',
          category: 'behavioural',
          questionIntent: 'behavioural_star',
          draftQuestion: repeatedText,
          evidenceRefs: [{ text: 'Took accountability for the outcome.' }],
        },
      ],
    });

    const repeatedItems = pool.filter((item) => item.text === repeatedText);
    expect(repeatedItems).toHaveLength(1);
    expect(repeatedItems[0].linkedCvEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Owned the delivery plan.' }),
      expect.objectContaining({ text: 'Took accountability for the outcome.' }),
    ]));
    expect(repeatedItems[0]).toEqual(expect.objectContaining({
      assessmentKey: 'root:ownership:behavioural',
      questionFingerprint: expect.any(String),
    }));
  });

  it('deduplicates reworded behavioural roots that share a canonical assessment key', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        matchingDetails: { questionPlanHints: { mustProbeSkills: [], mustProbeBehavioural: [] } },
      },
      cvSeeds: [
        {
          seedId: 'teamwork-seed',
          sourceType: 'cv_behavioural',
          topic: 'teamwork',
          category: 'behavioural',
          questionIntent: 'behavioural_star',
          draftQuestion: 'Tell me about a teamwork challenge.',
        },
        {
          seedId: 'collaboration-seed',
          sourceType: 'cv_behavioural',
          topic: 'collaboration',
          category: 'behavioural',
          questionIntent: 'behavioural_star',
          draftQuestion: 'Describe a time when collaboration mattered.',
        },
      ],
    });

    expect(pool.filter((item) => item.assessmentKey === 'root:teamwork:behavioural')).toHaveLength(1);
  });

  it('carries cross-role assessment metadata into JD requirement questions', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        parsedJdProfile: {
          universalRoleProfile: { roleDomain: 'healthcare' },
        },
        requirementChecks: [{
          label: 'Maintain clinical safety and professional standards',
          status: 'partial',
          category: 'compliance_or_safety',
          capabilityGroup: 'compliance_ethics_safety',
        }],
        matchingDetails: {
          questionPlanHints: {
            mustProbeSkills: [],
            mustProbeBehavioural: [],
          },
        },
      },
    });

    const requirementQuestion = pool.find((item) => item.sourceType === 'jd_requirement');
    expect(requirementQuestion).toMatchObject({
      schemaVersion: 'v3',
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      roleDomain: 'healthcare',
      requirementCategory: 'compliance_or_safety',
      capabilityGroup: 'compliance_ethics_safety',
    });
  });

  it('keeps legacy v2 items readable while new prepared items use v3', () => {
    const [legacyItem, currentItem] = validatePreparedQuestionPool([
      {
        questionId: 'legacy-v2',
        sessionId: 'legacy-session',
        schemaVersion: 'v2',
        text: 'Tell me about a project.',
        category: 'technical',
        topic: 'project',
        sourceType: 'legacy_plan',
      },
      {
        questionId: 'current-v3',
        sessionId: 'current-session',
        schemaVersion: 'v3',
        text: 'Tell me about a role-specific project.',
        category: 'technical',
        topic: 'role fit',
        sourceType: 'role_fit',
        coverageContractIds: ['cov-1'],
      },
    ]);

    expect(legacyItem).toMatchObject({ schemaVersion: 'v2' });
    expect(legacyItem).not.toHaveProperty('coverageContractIds');
    expect(currentItem).toMatchObject({ schemaVersion: 'v3', coverageContractIds: ['cov-1'] });
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

  it('reconciles legacy transcripts by prepared ID or exact fingerprint only', () => {
    const plan = buildQuestionPoolReconciliationPlan({
      transcript: [
        { role: 'ai', text: 'Tell me about ownership?', metadata: { turnKind: 'root_question' } },
        { role: 'ai', text: 'A different stored wording?', metadata: { preparedQuestionId: 'pool-2' } },
        { role: 'ai', text: 'Tell me about a teamwork challenge in detail?', metadata: { turnKind: 'root_question' } },
      ],
      poolItems: [
        { questionId: 'pool-1', status: 'active', text: 'Tell me about ownership?' },
        { questionId: 'pool-2', status: 'active', text: 'Tell me about database validation?' },
        { questionId: 'pool-3', status: 'active', text: 'Tell me about a teamwork challenge?' },
      ],
    });

    expect(plan.questionIdsToMarkAsked).toEqual(['pool-1', 'pool-2']);
    expect(plan.exactFingerprintMatches).toBe(1);
    expect(plan.preparedIdMatches).toBe(1);
    expect(plan.questionIdsToMarkAsked).not.toContain('pool-3');
  });
});
