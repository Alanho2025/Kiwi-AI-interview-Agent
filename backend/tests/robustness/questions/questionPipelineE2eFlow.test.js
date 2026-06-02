import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { buildCvQuestionSeedCandidates } from '../../../src/services/questions/cvQuestionSeedService.js';
import {
  applyJdFilterToCvSeeds,
  buildJdQuestionFilterProfile,
} from '../../../src/services/questions/jdQuestionFilterService.js';
import { buildInterviewQuestionPoolItems } from '../../../src/services/questions/questionPoolComposerService.js';
import {
  rankPreparedQuestionPool,
  selectBestPreparedQuestion,
} from '../../../src/services/questions/questionPoolRankerService.js';
import { buildInterviewTurnPlan } from '../../../src/services/questions/interviewTurnOrchestratorService.js';

describe('DB-backed question pipeline e2e flow', () => {
  it('prepares, filters, composes, and ranks a DB-backed pool before the live turn', () => {
    const cvSeeds = buildCvQuestionSeedCandidates({
      userId: 'user-1',
      cvFileId: 'cv-1',
      cvProfile: {
        confidence: 0.82,
        skills: [{ label: 'React' }, { label: 'SQL' }],
        evidenceProfile: {
          sections: {
            projects: [{
              title: 'Interview dashboard',
              skills: ['React', 'SQL'],
              summary: 'Built interview analytics with React and SQL reporting.',
            }],
          },
          functionalCapabilities: [{ label: 'React', summary: 'Frontend delivery.' }],
          behaviouralCapabilities: [{ label: 'stakeholder communication' }],
        },
      },
    });

    const analysisResult = {
      jobTitle: 'Frontend Developer',
      gaps: ['testing evidence'],
      requirementChecks: [{ requirement: 'React', met: false, category: 'technical' }],
      matchingDetails: {
        questionPlanHints: {
          mustProbeSkills: ['React'],
          mustProbeBehavioural: ['communication'],
          priorityTopics: ['React', 'testing evidence'],
        },
      },
      parsedJdProfile: {
        technicalSkillRequirements: ['React', 'testing'],
        softSkillRequirements: ['communication'],
      },
    };

    const jdProfile = buildJdQuestionFilterProfile({
      jdRubric: analysisResult.parsedJdProfile,
      analysisResult,
    });
    const jdFilter = applyJdFilterToCvSeeds({ cvSeeds, jdProfile, analysisResult });
    const pool = buildInterviewQuestionPoolItems({
      userId: 'user-1',
      sessionId: 'session-1',
      cvFileId: 'cv-1',
      matchAnalysisId: 'match-1',
      jdFingerprint: 'jd-1',
      analysisResult,
      settings: { focusArea: 'technical', seniorityLevel: 'Junior/Grad' },
      cvSeeds,
      jdFilter,
    });

    const ranked = rankPreparedQuestionPool({
      poolItems: pool,
      session: {
        id: 'session-1',
        currentQuestionIndex: 2,
        questionLimit: 8,
        settings: { focusArea: 'technical' },
        transcript: [{ role: 'user', text: 'I used React and mentioned testing was limited.' }],
      },
      decisionContext: {
        interviewStructure: { focusAreaKey: 'technical' },
        coverageState: { missingTopics: ['testing evidence'] },
        matchState: { validationTargets: ['testing evidence'] },
      },
      actionInput: { actionType: 'ASK_VALIDATION_QUESTION', targetTopic: 'testing evidence' },
    });
    const selected = selectBestPreparedQuestion(ranked);

    expect(cvSeeds.length).toBeGreaterThan(0);
    expect(jdFilter.boostedSeedIds.length + jdFilter.adaptedSeedIds.length).toBeGreaterThan(0);
    expect(pool.some((item) => item.sourceStage === 'match_gap')).toBe(true);
    expect(pool.some((item) => item.sourceType === 'jd_requirement')).toBe(true);
    expect(selected).toEqual(expect.objectContaining({
      questionId: expect.any(String),
      category: expect.stringMatching(/technical|role_competency/),
      rankTrace: expect.objectContaining({
        score: expect.any(Number),
        reasons: expect.any(Array),
      }),
    }));
  });

  it('routes root, intro follow-up, and match-gap turns through the prepared pipeline', async () => {
    const poolItems = [
      {
        questionId: 'cv-root',
        status: 'active',
        questionRole: 'root_question',
        topic: 'Forkcast Food AI Assistant',
        category: 'technical',
        sourceType: 'cv_project',
        sourceStage: 'cv_seed',
        text: 'Your CV says you used React in Forkcast Food AI Assistant. How did you apply it in the actual implementation?',
        priorityWeight: 0.75,
        coverageWeight: 0.7,
        riskWeight: 0.4,
        modeCompatibility: { technical: true, combined: true },
      },
      {
        questionId: 'jd-root',
        status: 'active',
        questionRole: 'root_question',
        topic: 'React ownership',
        category: 'technical',
        sourceType: 'jd_requirement',
        sourceStage: 'match_validation',
        text: 'How does your React experience map to the ownership expected in this role?',
        priorityWeight: 0.85,
        coverageWeight: 0.8,
        riskWeight: 0.5,
        modeCompatibility: { technical: true, combined: true },
      },
      {
        questionId: 'gap-root',
        status: 'active',
        questionRole: 'root_question',
        topic: 'testing evidence',
        category: 'technical',
        sourceType: 'match_gap',
        sourceStage: 'match_gap',
        text: 'How did you validate the testing evidence for your React work?',
        priorityWeight: 0.95,
        coverageWeight: 0.95,
        riskWeight: 0.95,
        modeCompatibility: { technical: true, combined: true },
      },
    ];
    const decisionContext = {
      currentTopic: 'React',
      interviewStructure: { focusAreaKey: 'technical' },
      environment: { latestAnswer: { text: 'I used React in Forkcast Food AI Assistant for the UI.', tokenCount: 10 } },
      matchState: { validationTargets: ['testing evidence'] },
      coverageState: { missingTopics: ['testing evidence'] },
    };
    const introSession = {
      id: 'session-1',
      settings: { focusArea: 'technical' },
      analysisResult: {
        parsedCvProfile: {
          evidenceProfile: {
            sections: { projects: [{ title: 'Forkcast Food AI Assistant', skills: ['React'] }] },
          },
        },
      },
      transcript: [
        { role: 'ai', questionId: 'intro-q', metadata: { stage: 'opening', topic: 'self_intro', questionType: 'self_intro' } },
        { role: 'user', text: 'I used React in Forkcast Food AI Assistant for the UI.' },
      ],
    };

    const introFollowUpPlan = await buildInterviewTurnPlan({
      session: introSession,
      actionType: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
      decisionContext,
      poolItems,
    });

    expect(introFollowUpPlan.turnKind).toBe('follow_up');
    expect(introFollowUpPlan.scenario).toBe('intro_follow_up');
    expect(introFollowUpPlan.selectedRootCandidate).toBeNull();
    expect(introFollowUpPlan.followUpContext.parentQuestionId).toBe('intro-q');
    expect(introFollowUpPlan.sourcePolicy).toBe('follow_up_from_parent_no_prepared_root_consumption');

    const rootPlan = await buildInterviewTurnPlan({
      session: {
        ...introSession,
        transcript: [
          { role: 'ai', questionId: 'follow-up-2', metadata: { stage: 'technical', topic: 'React', followUpDepth: 2 } },
          { role: 'user', text: 'I owned the React UI and tested it before release.' },
        ],
      },
      actionType: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      decisionContext: {
        ...decisionContext,
        environment: { latestAnswer: { text: 'I owned the React UI and tested it before release.', tokenCount: 9 } },
      },
      actionInput: { targetTopic: 'testing evidence', probeType: 'validation' },
      poolItems,
    });

    expect(rootPlan.turnKind).toBe('root_question');
    expect(rootPlan.scenario).toBe('root_match_gap');
    expect(rootPlan.sourcePolicy).toBe('prepared_root_pool');
    expect(rootPlan.selectedRootCandidate.questionId).toBe('gap-root');
    expect(rootPlan.topRootCandidates.map((candidate) => candidate.questionId)).toEqual(expect.arrayContaining([
      'gap-root',
      'jd-root',
      'cv-root',
    ]));
  });
});
