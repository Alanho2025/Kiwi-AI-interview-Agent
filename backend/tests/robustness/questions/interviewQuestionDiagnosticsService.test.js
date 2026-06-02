import { describe, expect, it } from 'vitest';

import { buildInterviewQuestionDiagnostics } from '../../../src/services/questions/interviewQuestionDiagnosticsService.js';

describe('interview question diagnostics visibility', () => {
  it('exposes safe question-pipeline counts and visibility fields without raw private text', () => {
    const diagnostics = buildInterviewQuestionDiagnostics({
      session: {
        id: 'session-1',
        userId: 'user-1',
        cvFileId: 'cv-1',
        targetRole: 'Frontend Developer',
        analysisResult: {
          parsedJdProfile: {
            metadata: { jdFingerprint: 'jd-fingerprint' },
            technicalSkillRequirements: ['React', 'testing'],
            softSkillRequirements: ['communication'],
          },
          matchingDetails: {
            questionPlanHints: {
              priorityTopics: ['React', 'testing evidence'],
              mustProbeSkills: ['React'],
              mustProbeBehavioural: ['communication'],
            },
          },
        },
        transcript: [{
          role: 'ai',
          text: 'Full private question text should not be copied into diagnostics.',
          metadata: {
            turnKind: 'root_question',
            scenario: 'root_match_gap',
            questionDecision: {
              preparedQuestionId: 'pool-1',
              parentQuestionId: null,
            },
          },
        }],
      },
      cvSeeds: [{
        seedId: 'seed-1',
        sourceType: 'cv_project',
        category: 'technical',
        topic: 'React',
        questionIntent: 'validate_ownership',
        draftQuestion: 'Raw seed question should not appear.',
        evidenceSummary: 'Raw CV summary should not appear.',
        skillTags: ['React'],
        projectTags: ['Forkcast Food AI Assistant'],
      }],
      jdFilter: {
        roleCanonical: 'Frontend Developer',
        prioritySkills: ['React', 'testing'],
        behaviouralFocus: ['communication'],
        mustHaveRequirements: [{ requirement: 'React' }],
        filterDecisions: [
          { seedId: 'seed-1', decision: 'boost' },
          { seedId: 'seed-2', decision: 'adapt' },
          { seedId: 'seed-3', decision: 'keep' },
        ],
      },
      poolItems: [
        { questionId: 'pool-1', questionRole: 'root_question', status: 'active', sourceStage: 'match_gap', sourceType: 'match_gap' },
        { questionId: 'pool-2', questionRole: 'fallback_root', status: 'active', sourceStage: 'fallback' },
        { questionId: 'pool-3', questionRole: 'wrap_up', status: 'active', stage: 'wrap_up' },
        { questionId: 'pool-4', status: 'asked', sourceStage: 'cv_seed' },
      ],
      sessionAnalysis: {
        agentMemory: { topics: ['React'] },
        evidenceBundleSnapshot: { matchAnalysis: { validationTargets: ['testing'] } },
        controllerState: {
          coverageState: { coveredTopics: ['React'], weakAreas: ['validation_method'] },
          retrievalState: {
            latestQuery: 'role query',
            latestSources: ['cv_profile', 'prepared_question_pool'],
            retrievalObjective: 'bootstrap_interview_context',
            correctiveRetryUsed: true,
            compactContext: true,
          },
          userCoachingMemory: { summary: 'Short coaching summary', records: [{ id: 'r1' }] },
          memoryLoadPolicy: {
            requested: 'auto',
            effective: 'follow_up_fast',
            heavyMemorySkippedBeforeFirstAudio: true,
          },
        },
      },
    });

    expect(diagnostics).toEqual(expect.objectContaining({
      cvSeedsCount: 1,
      jdFilterReady: true,
      preparedRootQuestionCount: 1,
      fallbackRootQuestionCount: 1,
      wrapUpQuestionCount: 1,
      matchGapQuestionCount: 1,
      askedPreparedRootCount: 1,
      latestTurnKind: 'root_question',
      latestScenario: 'root_match_gap',
      latestPreparedQuestionId: 'pool-1',
      sessionMemoryLoaded: true,
      sessionMemoryTopicHistoryCount: 1,
      sessionMemoryEvidenceGapCount: 1,
      userCoachingMemoryLoaded: true,
      userCoachingMemoryRecordCount: 1,
      userCoachingMemorySummaryAvailable: true,
      memoryLoadPolicyRequested: 'auto',
      memoryLoadPolicyEffective: 'follow_up_fast',
      heavyMemorySkippedBeforeFirstAudio: true,
      retrievalExecuted: true,
      retrievalSkipped: false,
      retrievalObjective: 'bootstrap_interview_context',
      retrievalItemCount: 2,
      retrievalCorrectiveRetryUsed: true,
      evidencePackageSource: 'session_analysis_snapshot',
      compactContextUsed: true,
      warmContextHit: false,
      artifactCacheCandidateFound: false,
      accountLevelCacheSupported: false,
    }));
    expect(diagnostics.jdFilterDecisionCounts).toEqual({ boost: 1, adapt: 1, keep: 1 });
    expect(diagnostics.jdPrioritySummary.priorityTechnicalSkills).toEqual(['React', 'testing']);
    expect(JSON.stringify(diagnostics)).not.toContain('Raw seed question should not appear');
    expect(JSON.stringify(diagnostics)).not.toContain('Raw CV summary should not appear');
    expect(JSON.stringify(diagnostics)).not.toContain('Full private question text');
  });
});
