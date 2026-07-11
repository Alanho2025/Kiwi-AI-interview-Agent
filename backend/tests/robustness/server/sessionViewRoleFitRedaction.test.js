import { describe, expect, it } from 'vitest';

import { buildSessionDetails } from '../../../src/services/session/sessionViewBuilder.js';

const buildRow = (status = 'in_progress') => ({
  id: 'session-1',
  user_id: 'user-1',
  status,
  mode: 'voice',
  target_role: 'Frontend Developer',
  candidate_name: 'Candidate',
  total_questions: 5,
  current_question_index: 2,
});

describe('session Role-Fit client redaction', () => {
  it('removes evidence hints, proof points and internal ranking from active session payloads', () => {
    const result = buildSessionDetails({
      row: buildRow(),
      plan: {
        schemaVersion: 'v3',
        roleFit: {
          proofStrategy: {
            artifactStatus: 'ready',
            roleFitDiagnostics: {
              schemaVersion: 'role_fit_diagnostics_v1',
              proofStrategyStatus: 'ready',
              counts: { proofCoverageCount: 1 },
            },
            mustCover: [{
              coverageId: 'cov-private-1',
              roleIntentId: 'intent-private-1',
              evidenceOptions: ['private-evidence-1'],
              status: 'pending',
            }],
          },
        },
        questionPool: [{
          text: 'Tell me about your experience.',
          proofPointId: 'cov-private-1',
          coverageContractIds: ['cov-private-1'],
          testedRoleIntentIds: ['intent-private-1'],
          recommendedEvidenceIds: ['private-evidence-1'],
          evidenceAngle: 'technical_ownership',
          preparationGuidance: {
            proofAngle: 'private-proof-angle',
            howToUse: 'private-how-to-use',
            risk: 'private-risk',
          },
          evidenceGuidance: {
            howToSayIt: ['private-how-to-say-it'],
          },
          hiringLogicCoverage: {
            businessProblemIds: ['private-business-problem'],
          },
        }],
      },
      transcript: {
        turns: [{
          role: 'ai',
          text: 'Tell me about your experience.',
          timestamp: '2026-07-10T00:00:00.000Z',
          metadata: {
            topic: 'experience',
            latency: { rootCandidateRankMs: 2 },
            rankTrace: {
              proofPointId: 'cov-private-1',
              recommendedEvidenceIds: ['private-evidence-1'],
              alternativesConsidered: ['private-alternative'],
            },
            questionDecision: {
              whyThisQuestion: 'private-internal-reason',
              evidenceUsed: ['private-evidence-1'],
              rankTrace: { recommendedEvidenceIds: ['private-evidence-1'] },
            },
            preparationGuidance: {
              howToUse: 'private-turn-how-to-use',
            },
            hiringLogicCoverage: {
              businessProblemIds: ['private-turn-business-problem'],
            },
          },
        }],
      },
      analysis: {
        roleFitDiagnostics: {
          schemaVersion: 'role_fit_diagnostics_v1',
          companyContextStatus: 'grounded',
          evidenceMapCoverage: 1,
          counts: { evidenceMapItemCount: 1 },
        },
        roleEvidenceMap: {
          items: [{
            roleIntentId: 'intent-private-1',
            sourceEvidence: [{ evidenceId: 'private-evidence-1', text: 'private-cv-snippet' }],
          }],
        },
      },
      report: null,
      cvDocument: null,
      jobDescriptionInput: null,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/private-evidence|private-cv-snippet|cov-private|intent-private|private-internal-reason|private-alternative|private-proof-angle|private-how-to-use|private-risk|private-business-problem/);
    expect(result.transcript[0].metadata).toEqual(expect.objectContaining({
      topic: 'experience',
      latency: { rootCandidateRankMs: 2 },
    }));
    expect(result.interviewPlan.roleFit).toMatchObject({
      enabled: true,
      readiness: { proofStrategyStatus: 'ready' },
      diagnostics: expect.objectContaining({
        schemaVersion: 'role_fit_diagnostics_v1',
        proofStrategyStatus: 'ready',
      }),
    });
    expect(result.analysisResult.roleFitDiagnostics).toEqual(expect.objectContaining({
      schemaVersion: 'role_fit_diagnostics_v1',
      evidenceMapCoverage: 1,
    }));
    expect(result.analysisSetup.roleFitDiagnostics).toEqual(expect.objectContaining({
      schemaVersion: 'role_fit_diagnostics_v1',
      evidenceMapCoverage: 1,
    }));
  });
});
