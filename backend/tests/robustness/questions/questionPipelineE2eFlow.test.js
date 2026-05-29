import { describe, expect, it } from 'vitest';

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
});
