import { describe, expect, it } from 'vitest';

import { buildRoleFitDiagnostics } from '../../../src/services/roleFit/roleFitDiagnosticsService.js';

describe('Role-Fit diagnostics contract', () => {
  it('summarises downstream Role-Fit readiness without copying private evidence text', () => {
    const diagnostics = buildRoleFitDiagnostics({
      roleFitProfile: {
        roleFitDiagnostics: {
          companyContextStatus: 'grounded',
          companyUnderstandingStatus: 'needs_review',
          roleIntentStatus: 'needs_review',
          degradedReasons: ['company_website_content_not_verified'],
          sourceLimitations: ['manual_website_context_conflict'],
        },
        companyUnderstanding: {
          facts: [{ statement: 'Private company snippet should not leave diagnostics.', claimStatus: 'grounded' }],
        },
        roleIntent: {
          diagnostics: [{
            code: 'role_intent_company_source_missing',
            severity: 'warning',
            degradedReason: 'low_confidence_hiring_logic',
            message: 'Safe compact diagnostic message.',
          }],
          items: [
            { id: 'intent-1', statement: 'Private intent text should not leave diagnostics.', claimStatus: 'needs_confirmation' },
            { id: 'intent-2', statement: 'Unsupported private inference.', claimStatus: 'unsupported' },
          ],
        },
      },
      roleEvidenceMap: {
        artifactStatus: 'ready',
        items: [
          {
            classification: 'direct',
            sourceEvidence: [{ evidenceId: 'ev-1', text: 'Private CV snippet must not be copied.' }],
          },
          { classification: 'gap', limitation: 'No source trace.' },
        ],
        intentCoverage: { highPriorityTotal: 2, strong: 1, partial: 0, missing: 1 },
      },
      proofStrategy: {
        artifactStatus: 'degraded',
        degradedReason: 'missing_role_fit_artifacts',
        mustCover: [{ coverageId: 'cov-1', status: 'degraded' }],
      },
      answerAlignments: [{ groundingStatus: 'limited' }],
    });

    expect(diagnostics).toMatchObject({
      schemaVersion: 'role_fit_diagnostics_v1',
      companyContextStatus: 'grounded',
      companyUnderstandingStatus: 'needs_review',
      roleIntentStatus: 'needs_review',
      unsupportedInferenceCount: 1,
      evidenceMapCoverage: 0.5,
      proofStrategyStatus: 'degraded',
      answerAlignmentStatus: 'limited',
      counts: expect.objectContaining({
        companyFactCount: 1,
        roleIntentCount: 2,
        evidenceMapItemCount: 2,
        directEvidenceCount: 1,
        gapCount: 1,
        proofCoverageCount: 1,
        answerAlignmentCount: 1,
      }),
      degradedReasons: expect.arrayContaining([
        'company_website_content_not_verified',
        'low_confidence_hiring_logic',
        'missing_role_fit_artifacts',
      ]),
      sourceLimitations: expect.arrayContaining([
        'manual_website_context_conflict',
        'role_intent_company_source_missing',
        'role_evidence_map_has_gaps',
        'answer_alignment_limited',
      ]),
    });
    expect(JSON.stringify(diagnostics)).not.toContain('Private company snippet');
    expect(JSON.stringify(diagnostics)).not.toContain('Private CV snippet');
    expect(JSON.stringify(diagnostics)).not.toContain('Private intent text');
  });
});
