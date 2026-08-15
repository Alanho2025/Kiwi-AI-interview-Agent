import { describe, expect, it } from 'vitest';

import { QUESTION_CATALOG_SEED } from '../../../src/data/questionCatalogSeed2026_1.js';
import { QUESTION_CATALOG_SEED as QUESTION_CATALOG_SEED_2026_2 } from '../../../src/data/questionCatalogSeed2026_2.js';
import {
  buildCatalogQuestionSnapshots,
  buildCatalogCoverageOutcome,
  buildFollowUpVsNextRootComparison,
  resolveCatalogSelectionContext,
  resolveCatalogReservationPlan,
  resolveScenarioEligibility,
  SCENARIO_COVERAGE_SLOT,
} from '../../../src/services/questions/questionCatalogSelectionService.js';

const catalogItem = (id) => ({
  ...QUESTION_CATALOG_SEED.find((item) => item.catalogQuestionId === id),
  lifecycle: 'approved',
});
const approvedCatalog = () => QUESTION_CATALOG_SEED.map((item) => ({ ...item, lifecycle: 'approved' }));
const approved2026_2CatalogItem = (id) => ({
  ...QUESTION_CATALOG_SEED_2026_2.find((item) => item.catalogQuestionId === id),
  lifecycle: 'approved',
});

const softwareContext = {
  userId: 'user-1',
  sessionId: 'session-1',
  settings: { seniorityLevel: 'Senior', questionLimit: 8, focusArea: 'technical' },
  analysisResult: {
    jobTitle: 'Senior Software Engineer',
    parsedJdProfile: { roleFamily: 'software_development' },
  },
};

describe('question catalog session snapshots and reservations', () => {
  it.each([
    ['technical, 8 questions, 15 minutes', { focusArea: 'technical', questionLimit: 8, timeLimitMinutes: 15 }, false],
    ['technical, 12 questions, 15 minutes', { focusArea: 'technical', questionLimit: 12, timeLimitMinutes: 15 }, true],
    ['technical, 8 questions, 30 minutes', { focusArea: 'technical', questionLimit: 8, timeLimitMinutes: 30 }, true],
    ['combined, 12 questions, 15 minutes', { focusArea: 'combined', questionLimit: 12, timeLimitMinutes: 15 }, false],
    ['combined, 15 questions, 15 minutes', { focusArea: 'combined', questionLimit: 15, timeLimitMinutes: 15 }, true],
    ['combined, 8 questions, 30 minutes', { focusArea: 'combined', questionLimit: 8, timeLimitMinutes: 30 }, true],
    ['behavioural, 15 questions, 30 minutes', { focusArea: 'behavioural', questionLimit: 15, timeLimitMinutes: 30 }, false],
  ])('applies the scenario eligibility policy for %s', (_label, settings, expectedEligible) => {
    const selectionContext = resolveCatalogSelectionContext({
      analysisResult: softwareContext.analysisResult,
      settings: { seniorityLevel: 'senior', ...settings },
    });

    expect(resolveScenarioEligibility(selectionContext).eligible).toBe(expectedEligible);
  });

  it('reserves one bounded technical scenario slot only when the session is eligible', () => {
    const catalogItem2026_2 = approved2026_2CatalogItem('coding_ownership_and_verification');
    const eligible = buildCatalogQuestionSnapshots({
      catalogItems: [catalogItem2026_2],
      context: {
        ...softwareContext,
        settings: { ...softwareContext.settings, questionLimit: 12, timeLimitMinutes: 15 },
      },
    });
    const ineligible = buildCatalogQuestionSnapshots({
      catalogItems: [catalogItem2026_2],
      context: softwareContext,
    });

    expect(eligible.items).toEqual([
      expect.objectContaining({
        coverageSlot: SCENARIO_COVERAGE_SLOT,
        selectionPolicy: expect.objectContaining({ minAsked: 1, maxAsked: 1, reservationPriority: 75 }),
      }),
    ]);
    expect(ineligible.items).toEqual([]);
    expect(ineligible.rejected).toEqual([
      expect.objectContaining({ reason: 'scenario_technical_session_too_short' }),
    ]);

    const reservationPlan = resolveCatalogReservationPlan({
      poolItems: eligible.items,
      selectionContext: eligible.selectionContext,
      catalogStatus: 'catalog_unavailable',
      session: { currentQuestionIndex: 11, questionLimit: 12, transcript: [] },
    });
    expect(reservationPlan.reservations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        coverageSlot: SCENARIO_COVERAGE_SLOT,
        minAsked: 1,
        status: 'pending',
        isUrgent: true,
      }),
    ]));
  });

  it('snapshots the Software AI workflow question without copying candidate content into the catalog fields', () => {
    const result = buildCatalogQuestionSnapshots({
      catalogItems: [catalogItem('ai_assisted_delivery')],
      context: softwareContext,
    });

    expect(result.rejected).toEqual([]);
    expect(result.items).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        catalogQuestionId: 'ai_assisted_delivery',
        catalogVersion: '2026.1',
        targetLevel: 'senior',
        coverageSlot: 'software_ai_workflow',
        eligibilityReason: expect.arrayContaining(['role_family:software']),
      }),
    ]);
    expect(JSON.stringify(result.items[0])).not.toMatch(/candidateName|rawJD|transcript|private report/i);
  });

  it('snapshots only a versioned candidate-safe clarification response for future approved catalogs', () => {
    const source = catalogItem('ai_assisted_delivery');
    const result = buildCatalogQuestionSnapshots({
      catalogItems: [{
        ...source,
        ambiguityPolicy: {
          mode: 'open_scope_probe',
          clarificationContextVersion: 'scope-2026.2-v1',
          clarificationResponseText: 'Please focus on one AI-assisted project and explain your process, checks, and result.',
          internalScopeOptions: ['personal use', 'project delivery'],
        },
      }],
      context: softwareContext,
    });

    expect(result.items[0]).toMatchObject({
      ambiguityMode: 'open_scope_probe',
      clarificationContextVersion: 'scope-2026.2-v1',
      clarificationContext: {
        responseText: 'Please focus on one AI-assisted project and explain your process, checks, and result.',
      },
    });
    expect(JSON.stringify(result.items[0])).not.toContain('internalScopeOptions');
    expect(JSON.stringify(result.items[0])).not.toContain('personal use');
  });

  it('uses level-specific catalog wording instead of merely relabelling the same AI workflow question', () => {
    const catalogItems = [catalogItem('ai_assisted_delivery')];
    const junior = buildCatalogQuestionSnapshots({
      catalogItems,
      context: {
        ...softwareContext,
        settings: { ...softwareContext.settings, seniorityLevel: 'Junior/Grad' },
      },
    });
    const senior = buildCatalogQuestionSnapshots({ catalogItems, context: softwareContext });

    expect(junior.items[0]).toMatchObject({
      targetLevel: 'junior',
      text: expect.stringMatching(/where in a project/i),
    });
    expect(senior.items[0]).toMatchObject({
      targetLevel: 'senior',
      text: expect.stringMatching(/trade-offs, risks, and release checks/i),
    });
  });

  it('reserves two distinct AI root families for an explicit AI Solution role and only one for a provider-only Software role', () => {
    const aiSolutionItems = buildCatalogQuestionSnapshots({
      catalogItems: approvedCatalog(),
      context: {
        ...softwareContext,
        analysisResult: {
          jobTitle: 'AI Solution Engineer',
          parsedJdProfile: { roleFamily: 'ai_ml', rawJD: 'Build RAG agents with MCP tools, evaluations and safety guardrails.' },
        },
      },
    }).items;
    const providerOnlyItems = buildCatalogQuestionSnapshots({
      catalogItems: approvedCatalog(),
      context: {
        ...softwareContext,
        analysisResult: {
          jobTitle: 'Software Engineer',
          parsedJdProfile: { roleFamily: 'software_development', rawJD: 'Azure OpenAI exposure is preferred.' },
        },
      },
    }).items;

    const aiSolutionPlan = resolveCatalogReservationPlan({
      poolItems: aiSolutionItems,
      session: { currentQuestionIndex: 2, questionLimit: 8, transcript: [] },
    });
    const providerOnlyPlan = resolveCatalogReservationPlan({
      poolItems: providerOnlyItems,
      session: { currentQuestionIndex: 2, questionLimit: 8, transcript: [] },
    });

    expect(aiSolutionPlan.reservations.filter((item) => item.minAsked > 0)).toHaveLength(2);
    expect(new Set(aiSolutionPlan.reservations.map((item) => item.questionFamily)).size).toBeGreaterThanOrEqual(2);
    expect(providerOnlyPlan.reservations.filter((item) => item.minAsked > 0)).toHaveLength(1);
  });

  it('does not enable sensitive career or NZ questions without explicit candidate-provided signals', () => {
    const catalogItems = [
      catalogItem('career_transition_hardware_to_ai_solution'),
      catalogItem('nz_study_work_motivation'),
    ];

    const sensitiveRoleContext = {
      ...softwareContext,
      analysisResult: {
        jobTitle: 'AI Solution Engineer',
        parsedJdProfile: { roleFamily: 'ai_ml' },
      },
    };
    const withoutSignals = buildCatalogQuestionSnapshots({ catalogItems, context: sensitiveRoleContext });
    const withSignals = buildCatalogQuestionSnapshots({
      catalogItems,
      context: {
        ...sensitiveRoleContext,
        explicitCandidateSignals: ['hardware_to_ai_solution', 'nz_study_or_work'],
      },
    });

    expect(withoutSignals.items).toEqual([]);
    expect(withoutSignals.rejected.map((item) => item.reason)).toEqual(expect.arrayContaining([
      'missing_explicit_candidate_signal:hardware_to_ai_solution',
      'missing_explicit_candidate_signal:nz_study_or_work',
    ]));
    expect(withSignals.items.map((item) => item.catalogQuestionId)).toEqual(expect.arrayContaining([
      'career_transition_hardware_to_ai_solution',
      'nz_study_work_motivation',
    ]));
  });

  it('derives sensitive eligibility only from explicit private CV statements, never from identity fields', () => {
    const catalogItems = [
      catalogItem('career_transition_hardware_to_ai_solution'),
      catalogItem('nz_study_work_motivation'),
    ];
    const result = buildCatalogQuestionSnapshots({
      catalogItems,
      context: {
        ...softwareContext,
        analysisResult: {
          jobTitle: 'AI Solution Engineer',
          parsedJdProfile: { roleFamily: 'ai_ml' },
          parsedCvProfile: {
            candidateName: 'New Zealand Hardware Engineer',
            summary: 'Hardware engineer moving into AI solution delivery after studying in New Zealand.',
          },
        },
      },
    });

    expect(result.items.map((item) => item.catalogQuestionId)).toEqual(expect.arrayContaining([
      'career_transition_hardware_to_ai_solution',
      'nz_study_work_motivation',
    ]));
    expect(JSON.stringify(result.items)).not.toContain('New Zealand Hardware Engineer');

    const identityOnly = buildCatalogQuestionSnapshots({
      catalogItems,
      context: {
        ...softwareContext,
        analysisResult: {
          jobTitle: 'AI Solution Engineer',
          parsedJdProfile: { roleFamily: 'ai_ml' },
          parsedCvProfile: { candidateName: 'New Zealand Hardware Engineer', summary: 'Engineer interested in new opportunities.' },
        },
      },
    });
    expect(identityOnly.items).toEqual([]);
  });

  it('does not reserve mandatory AI coverage when the Voice session has fewer than eight question slots', () => {
    const result = buildCatalogQuestionSnapshots({
      catalogItems: [catalogItem('ai_assisted_delivery')],
      context: {
        ...softwareContext,
        settings: { ...softwareContext.settings, questionLimit: 5 },
      },
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        catalogQuestionId: 'ai_assisted_delivery',
        coverageSlot: null,
        selectionPolicy: expect.objectContaining({ minAsked: 0, reservationPriority: 0 }),
      }),
    ]);
  });

  it('gates non-tech AI judgement on an explicit AI or digital-work signal', () => {
    const aiJudgement = [catalogItem('ai_literacy_responsible_use')];
    const noSignal = buildCatalogQuestionSnapshots({
      catalogItems: aiJudgement,
      context: {
        ...softwareContext,
        analysisResult: {
          jobTitle: 'People Operations Coordinator',
          parsedJdProfile: { roleFamily: 'people_operations', rawJD: 'Support onboarding and internal policy administration.' },
        },
      },
    });
    const weakAiSignal = buildCatalogQuestionSnapshots({
      catalogItems: aiJudgement,
      context: {
        ...softwareContext,
        analysisResult: {
          jobTitle: 'People Operations Coordinator',
          parsedJdProfile: { roleFamily: 'people_operations', rawJD: 'Interest in AI-enabled workflow improvement is useful.' },
        },
      },
    });

    expect(noSignal.items).toEqual([]);
    expect(noSignal.rejected).toEqual([
      expect.objectContaining({ reason: 'ai_or_digital_signal_not_confirmed' }),
    ]);
    expect(weakAiSignal.items).toEqual([
      expect.objectContaining({
        catalogQuestionId: 'ai_literacy_responsible_use',
        coverageSlot: null,
        selectionPolicy: expect.objectContaining({ minAsked: 0, maxAsked: 1 }),
      }),
    ]);
  });

  it.each([8, 15])('keeps required coverage stable across %i-question sessions and all configured levels', (questionLimit) => {
    const wordingByLevel = new Set();

    ['Junior/Grad', 'Intermediate', 'Senior'].forEach((seniorityLevel) => {
      const snapshots = buildCatalogQuestionSnapshots({
        catalogItems: [catalogItem('ai_assisted_delivery')],
        context: {
          ...softwareContext,
          settings: { ...softwareContext.settings, questionLimit, seniorityLevel },
        },
      });
      const plan = resolveCatalogReservationPlan({
        poolItems: snapshots.items,
        session: { currentQuestionIndex: 1, questionLimit, transcript: [] },
      });

      expect(snapshots.items[0]).toEqual(expect.objectContaining({
        coverageSlot: 'software_ai_workflow',
        targetLevel: expect.stringMatching(/^(junior|intermediate|senior)$/),
      }));
      expect(plan.reservations.filter((reservation) => reservation.coverageSlot !== SCENARIO_COVERAGE_SLOT)).toEqual([
        expect.objectContaining({ coverageSlot: 'software_ai_workflow', minAsked: 1, status: 'pending' }),
      ]);
      wordingByLevel.add(snapshots.items[0].text);
    });

    expect(wordingByLevel.size).toBe(3);
  });

  it.each([
    ['Intermediate', ['ml_foundation']],
    ['Senior', ['ml_foundation', 'ml_operations']],
  ])('keeps ML coverage separate and level-aware for %s sessions', (seniorityLevel, expectedSlots) => {
    const snapshots = buildCatalogQuestionSnapshots({
      catalogItems: approvedCatalog(),
      context: {
        ...softwareContext,
        settings: { ...softwareContext.settings, seniorityLevel, questionLimit: 15 },
        analysisResult: {
          jobTitle: `${seniorityLevel} Machine Learning Engineer`,
          parsedJdProfile: {
            roleFamily: 'machine_learning',
            rawJD: 'Train and evaluate machine learning models, then monitor drift in production.',
          },
        },
      },
    });
    const plan = resolveCatalogReservationPlan({
      poolItems: snapshots.items,
      session: { currentQuestionIndex: 1, questionLimit: 15, transcript: [] },
    });

    expect(snapshots.selectionContext.roleFamily).toBe('ml');
    expect(plan.reservations
      .filter((reservation) => reservation.minAsked > 0 && reservation.coverageSlot !== SCENARIO_COVERAGE_SLOT)
      .map((reservation) => reservation.coverageSlot).sort())
      .toEqual([...expectedSlots].sort());
    expect(plan.reservations.map((reservation) => reservation.coverageSlot)).not.toContain('software_ai_workflow');
  });

  it('marks missing or unfinished required catalog coverage as degraded at session completion', () => {
    const selectionContext = resolveCatalogSelectionContext(softwareContext);
    const missingCandidatePlan = resolveCatalogReservationPlan({
      poolItems: [catalogItem('proud_project')],
      session: { currentQuestionIndex: 8, questionLimit: 8, transcript: [] },
      selectionContext,
      catalogStatus: 'ready',
    });
    const pendingPool = buildCatalogQuestionSnapshots({
      catalogItems: [catalogItem('ai_assisted_delivery')],
      context: softwareContext,
    }).items;
    const earlyEnd = buildCatalogCoverageOutcome({
      poolItems: pendingPool,
      session: { ...softwareContext, currentQuestionIndex: 5, transcript: [] },
      completedBecause: 'time_limit_reached',
    });

    expect(missingCandidatePlan.reservations).toEqual([
      expect.objectContaining({
        coverageSlot: 'software_ai_workflow',
        status: 'degraded',
        degradedReason: 'required_coverage_has_no_eligible_question',
      }),
    ]);
    expect(earlyEnd).toEqual(expect.objectContaining({
      status: 'coverage_degraded',
      completedBecause: 'time_limit_reached',
      reservations: [
        expect.objectContaining({
          coverageSlot: 'software_ai_workflow',
          status: 'degraded',
          degradedReason: 'session_ended_before_required_coverage',
        }),
      ],
    }));
  });

  it('compares a named follow-up evidence deficit against the next root opportunity cost', () => {
    expect(buildFollowUpVsNextRootComparison({
      answerSignals: { isShallow: false, missingEvidence: ['result_or_validation'] },
      nextRootCandidate: { score: 0.9 },
      targetLevel: 'intermediate',
      followUpIntent: 'validation',
    })).toEqual(expect.objectContaining({
      decision: 'next_root',
      followUpIntent: 'validation',
      missingEvidence: ['result_or_validation'],
    }));

    expect(buildFollowUpVsNextRootComparison({
      answerSignals: {
        isShallow: true,
        missingEvidence: ['ownership_or_action', 'result_or_validation', 'tradeoff_or_constraint'],
      },
      nextRootCandidate: { score: 0.45 },
      targetLevel: 'senior',
      followUpIntent: 'tradeoff',
    })).toEqual(expect.objectContaining({
      decision: 'follow_up',
      followUpIntent: 'tradeoff',
    }));
  });

  describe('catalog evidenceMode resolution', () => {
    it.each([
      ['group_failure_learning', 'past_example'],
      ['underperforming_project_reflection', 'past_example'],
      ['company_role_internship_motivation', 'process_reasoning'],
      ['ai_literacy_responsible_use', 'scenario_reasoning'],
      ['coding_ownership_and_verification', 'process_reasoning'],
    ])('resolves evidenceMode %s -> %s for both 2026.1 and 2026.2 formats', (catalogId, expectedMode) => {
      const v1Item = catalogItem(catalogId);
      const v2Item = approved2026_2CatalogItem(catalogId);

      if (v1Item) {
        const v1 = buildCatalogQuestionSnapshots({
          catalogItems: [v1Item],
          context: { ...softwareContext, explicitCandidateSignals: ['ai_or_digital_work'] },
        }).items[0];
        if (v1) expect(v1.evidenceMode).toBe(expectedMode);
      }
      
      if (v2Item) {
        const v2 = buildCatalogQuestionSnapshots({
          catalogItems: [v2Item],
          context: { ...softwareContext, explicitCandidateSignals: ['ai_or_digital_work'] },
        }).items[0];
        if (v2) expect(v2.evidenceMode).toBe(expectedMode);
      }
    });

    it('asserts bounded_scenario selects scenario_reasoning even when prompt contains technical terms', () => {
      const result = buildCatalogQuestionSnapshots({
        catalogItems: [{
          ...catalogItem('ai_assisted_delivery'),
          ambiguityPolicy: { mode: 'bounded_scenario' },
        }],
        context: { ...softwareContext, settings: { ...softwareContext.settings, questionLimit: 12, timeLimitMinutes: 30 } },
      });
      expect(result.items[0].evidenceMode).toBe('scenario_reasoning');
    });

    it('asserts junior/intermediate/senior prompt variants with the same source metadata produce the same evidenceMode', () => {
      const resultJunior = buildCatalogQuestionSnapshots({
        catalogItems: [catalogItem('ai_assisted_delivery')],
        context: { ...softwareContext, settings: { ...softwareContext.settings, seniorityLevel: 'junior' } },
      });
      const resultSenior = buildCatalogQuestionSnapshots({
        catalogItems: [catalogItem('ai_assisted_delivery')],
        context: { ...softwareContext, settings: { ...softwareContext.settings, seniorityLevel: 'senior' } },
      });
      expect(resultJunior.items[0].evidenceMode).toBe(resultSenior.items[0].evidenceMode);
      expect(resultJunior.items[0].evidenceMode).toBe('process_reasoning');
    });

    it('asserts catalogVersion and prompt provenance remain unchanged', () => {
      const result = buildCatalogQuestionSnapshots({
        catalogItems: [catalogItem('ai_assisted_delivery')],
        context: softwareContext,
      });
      expect(result.items[0].catalogVersion).toBe('2026.1');
      expect(result.items[0].sourceType).toBe('question_catalog');
      expect(result.items[0].sourceStage).toBe('catalog');
      expect(result.items[0].evidenceMode).toBeDefined();
    });
  });
});
