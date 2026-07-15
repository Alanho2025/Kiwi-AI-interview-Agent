import { describe, expect, it } from 'vitest';

import { buildInterviewEnvironment } from '../../../src/services/aiControl/interviewEnvironmentService.js';
import { compareCvToJobDescriptionWithSafeguard } from '../../../src/services/match/guardedMatchService.js';
import { createMatchPerformanceTrace } from '../../../src/services/match/matchPerformanceTraceService.js';

const cvText = `Ava Chen
Data Engineer

Experience
Built Python and SQL data pipelines for customer analytics projects.
Used PostgreSQL, Linux, Git, and dashboard validation to clean data and check output quality.
Documented data workflows and explained pipeline trade-offs to stakeholders.

Skills
Python
SQL
PostgreSQL
Linux
Git`;

const blockedJdRubric = {
  schemaVersion: 'v3',
  title: 'Data Engineer',
  jobTitle: 'Data Engineer',
  jobOverview: { title: 'Data Engineer' },
  sections: {
    responsibilities: ['Build Python and SQL data pipelines for analytics use cases.'],
    mustHaveRequirements: ['Python', 'SQL'],
    technicalSkills: {
      data: [{ label: 'Python' }, { label: 'SQL' }, { label: 'PostgreSQL' }],
    },
  },
  mustHaveRequirements: ['Python', 'SQL'],
  technicalSkillRequirements: ['Python', 'SQL', 'PostgreSQL'],
  weights: {
    overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
    macro: { technical_expertise: 1 },
    micro: { python: 0.5, sql: 0.5 },
  },
  macroCriteria: [{ label: 'Technical expertise', weight: 1 }],
  microCriteria: [
    { label: 'Python', weight: 0.5 },
    { label: 'SQL', weight: 0.5 },
  ],
  requirements: [
    { label: 'Python', type: 'hard', importance: 'high' },
    { label: 'SQL', type: 'hard', importance: 'high' },
  ],
  safeguard: {
    verdict: 'reject',
    confidence: 0.42,
    blockMatch: true,
    finalStatus: 'needs_manual_jd_review',
    issues: [{ field: 'requirements', severity: 'high', problem: 'JD parse needs review.', action: 'Confirm extracted fields.' }],
  },
  metadata: {
    safeguard: {
      verdict: 'reject',
      confidence: 0.42,
      blockMatch: true,
      finalStatus: 'needs_manual_jd_review',
    },
  },
};

describe('guarded match human review override', () => {
  it('keeps a blocked JD at zero when the JD has not been human reviewed', async () => {
    const result = await compareCvToJobDescriptionWithSafeguard(cvText, 'Data Engineer JD', blockedJdRubric);

    expect(result.overallScore).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.decision).toMatchObject({ label: 'manual_review' });
    expect(result.riskFlags).toContain('Review company and role understanding before matching.');
    expect(result.roleFitDiagnostics).toMatchObject({
      schemaVersion: 'role_fit_diagnostics_v1',
      proofStrategyStatus: 'degraded',
      degradedReasons: expect.arrayContaining(['role_fit_review_required']),
    });
    expect(result.matchingDetails.roleFitDiagnostics).toEqual(result.roleFitDiagnostics);
  });

  it('does not let a legacy human-review marker open a new match after cutover', async () => {
    const reviewedRubric = {
      ...blockedJdRubric,
      metadata: {
        ...blockedJdRubric.metadata,
        humanReviewStatus: 'verified',
        inputTrustLevel: 'human_reviewed',
      },
    };

    const result = await compareCvToJobDescriptionWithSafeguard(cvText, 'Data Engineer JD', reviewedRubric);

    expect(result.overallScore).toBe(0);
    expect(result.decision.reasonCodes).toContain('role_fit_review_required');
    expect(result.matchingDetails.compatibility).toBeUndefined();
    expect(result.roleFitDiagnostics.degradedReasons).toContain('role_fit_review_required');
  });

  it('keeps JD safeguard blocked results observable with compact role-fit diagnostics', async () => {
    const reviewedRubric = {
      ...blockedJdRubric,
      roleFit: {
        id: 'role-fit-1',
        companyContext: { status: 'ready' },
        review: { status: 'verified', version: 2 },
        roleIntent: { items: [{ id: 'intent:python', statement: 'Python', priority: 'high' }] },
      },
    };

    const result = await compareCvToJobDescriptionWithSafeguard(cvText, 'Data Engineer JD', reviewedRubric);

    expect(result.overallScore).toBe(0);
    expect(result.decision.reasonCodes).toContain('jd_safeguard_blocked_match');
    expect(result.roleFitDiagnostics).toMatchObject({
      schemaVersion: 'role_fit_diagnostics_v1',
      companyContextStatus: 'manual',
      roleIntentStatus: 'user_confirmed',
      proofStrategyStatus: 'degraded',
      degradedReasons: expect.arrayContaining(['jd_safeguard_blocked_match']),
    });
    expect(result.matchingDetails.roleFitDiagnostics).toEqual(result.roleFitDiagnostics);
    expect(JSON.stringify(result.roleFitDiagnostics)).not.toContain('Python');
  });

  it('blocks a new role-fit rubric until its company and role understanding is verified', async () => {
    const reviewedRubric = {
      ...blockedJdRubric,
      roleFit: {
        companyContext: { status: 'ready' },
        review: { status: 'edited', version: 2 },
        roleIntent: { items: [{ id: 'intent:python', statement: 'Python', priority: 'high' }] },
      },
      metadata: {
        ...blockedJdRubric.metadata,
        humanReviewStatus: 'verified',
        inputTrustLevel: 'human_reviewed',
      },
    };

    const result = await compareCvToJobDescriptionWithSafeguard(cvText, 'Data Engineer JD', reviewedRubric);

    expect(result.overallScore).toBe(0);
    expect(result.decision.reasonCodes).toContain('role_fit_review_required');
    expect(result.riskFlags.join(' ')).toMatch(/company and role understanding/i);
    expect(result.roleFitDiagnostics).toMatchObject({
      schemaVersion: 'role_fit_diagnostics_v1',
      roleIntentStatus: 'needs_review',
      proofStrategyStatus: 'degraded',
      degradedReasons: expect.arrayContaining(['role_fit_review_required']),
    });
  });

  it('carries CV analysis and JD-relevant hooks into interview context', async () => {
    const reviewedRubric = {
      ...blockedJdRubric,
      roleFit: {
        id: 'role-fit-1',
        companyContext: { status: 'ready' },
        review: { status: 'verified', version: 2 },
        roleIntent: { items: [{ id: 'intent:python', statement: 'Python', priority: 'high' }] },
      },
      metadata: {
        ...blockedJdRubric.metadata,
        humanReviewStatus: 'verified',
        inputTrustLevel: 'human_reviewed',
      },
    };

    const result = await compareCvToJobDescriptionWithSafeguard(cvText, 'Data Engineer JD', reviewedRubric);
    const cvAnalysis = result.parsedCvProfile.cvAnalysis;

    expect(cvAnalysis.candidateIntro).toMatch(/Data|Python|SQL/i);
    expect(cvAnalysis.jdRelevantEvidence.map((item) => item.requirement)).toEqual(expect.arrayContaining(['Python', 'SQL']));
    expect(result.matchingDetails.questionPlanHints.priorityTopics).toEqual(expect.arrayContaining(['Python', 'SQL']));
    expect(result.matchingDetails.questionPlanHints.followUpTargets).toEqual(expect.arrayContaining(['self introduction and career direction']));

    const environment = buildInterviewEnvironment({
      session: {
        id: 'session_1',
        userId: 'user_1',
        candidateName: 'Ava Chen',
        analysisResult: result,
        transcript: [],
      },
    });

    expect(environment.candidateContext.candidateIntro).toBe(cvAnalysis.candidateIntro);
    expect(environment.candidateContext.jdRelevantEvidence.length).toBeGreaterThan(0);
    expect(environment.candidateContext.suggestedInterviewHooks).toEqual(expect.arrayContaining(['self introduction and career direction']));
  });

  it('records fresh guarded match performance steps without requiring a user cache', async () => {
    const reviewedRubric = {
      ...blockedJdRubric,
      safeguard: {
        ...blockedJdRubric.safeguard,
        blockMatch: false,
      },
      metadata: {
        ...blockedJdRubric.metadata,
        safeguard: {
          ...blockedJdRubric.metadata.safeguard,
          blockMatch: false,
        },
      },
      roleFit: {
        id: 'role-fit-1',
        companyContext: { status: 'ready' },
        review: { status: 'verified', version: 2 },
        roleIntent: { items: [{ id: 'intent:python', statement: 'Python', priority: 'high' }] },
      },
    };
    const performanceTrace = createMatchPerformanceTrace({ requestId: 'request-1' });

    const result = await compareCvToJobDescriptionWithSafeguard(
      cvText,
      'Data Engineer JD',
      reviewedRubric,
      {},
      { performanceTrace },
    );
    const traceSnapshot = performanceTrace.toJSON();
    const stepNames = traceSnapshot.steps.map((step) => step.step);

    expect(result.cache).toEqual(expect.objectContaining({ hit: false, source: 'fresh_match' }));
    expect(stepNames).toEqual(expect.arrayContaining([
      'match_cache_read',
      'match_cache_miss',
      'match_compare_first',
      'normalize_jd_rubric',
      'semantic_evidence_context',
      'match_score_build',
      'role_evidence_map_build',
      'match_result_build',
      'match_cache_write_warm',
    ]));
    expect(traceSnapshot.stepSummary.match_compare_first).toEqual(expect.objectContaining({
      count: 1,
      totalDurationMs: expect.any(Number),
    }));
    expect(traceSnapshot.slowestSteps[0]).toEqual(expect.objectContaining({
      step: expect.any(String),
      durationMs: expect.any(Number),
    }));
    expect(stepNames.some((step) => ['match_critic_skipped', 'match_critic_first_review'].includes(step))).toBe(true);
  });
});
