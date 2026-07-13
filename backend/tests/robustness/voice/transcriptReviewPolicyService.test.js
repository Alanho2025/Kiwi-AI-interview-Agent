import { describe, expect, it } from 'vitest';

import {
  buildTranscriptReviewItem,
  evaluateTranscriptReviewDecision,
} from '../../../src/services/voice/transcriptReviewPolicyService.js';

const baseCalibration = (overrides = {}) => ({
  rawTranscript: 'I used red act and type scripts for the dashboard.',
  calibratedTranscript: 'I used React and TypeScript for the dashboard.',
  decisionType: 'nbest_rerank',
  nbest: { retained: true, candidateCount: 2, selectedIndex: 1 },
  corrections: [{
    rawSpan: 'red act and type scripts',
    correctedSpan: 'React and TypeScript',
    glossaryTerm: 'React',
    source: 'jd_rubric',
    reason: 'tool_or_framework',
    confidence: 0.82,
    scoringImpacting: false,
    userConfirmed: false,
  }],
  staticCorrections: [],
  guardrail: {
    answerQualityChanged: false,
    usedCvJdAsSpokenEvidence: false,
  },
  ...overrides,
});

describe('transcript review policy service', () => {
  it('auto-accepts bounded term-level corrections with provider evidence', () => {
    const decision = evaluateTranscriptReviewDecision({
      transcriptCalibration: baseCalibration(),
      transcriptGate: { ok: true, decision: 'accept', reason: 'VALID_TRANSCRIPT' },
      asrConfidence: 0.91,
    });

    expect(decision).toMatchObject({
      decisionType: 'auto_accept',
      riskLevel: 'low',
      evidenceImpact: 'none',
      userAction: 'none_required',
      scoringPolicy: 'safe_to_score',
    });
    expect(decision.reasonCodes).toEqual(expect.arrayContaining([
      'glossary_term_surface',
      'provider_nbest_close_candidate',
    ]));
    expect(decision.reviewItems).toEqual([]);
  });

  it('defers review when a CV/JD term has no provider or static normalization evidence', () => {
    const decision = evaluateTranscriptReviewDecision({
      transcriptCalibration: baseCalibration({
        nbest: { retained: false, candidateCount: 0, selectedIndex: 0 },
        corrections: [{
          rawSpan: 'some orchestration',
          correctedSpan: 'Kubernetes orchestration',
          glossaryTerm: 'Kubernetes',
          source: 'cv_profile',
          reason: 'tool_or_framework',
          confidence: null,
          scoringImpacting: true,
          userConfirmed: false,
        }],
      }),
      transcriptGate: { ok: true, decision: 'accept', reason: 'VALID_TRANSCRIPT' },
    });

    expect(decision).toMatchObject({
      decisionType: 'deferred_review',
      riskLevel: 'medium',
      evidenceImpact: 'evidence_confidence_only',
      userAction: 'review_later',
      scoringPolicy: 'score_with_reduced_evidence_confidence',
    });
    expect(decision.sourceEvidence).toMatchObject({
      providerNBest: false,
      contextualGlossary: true,
      cvJdContextOnly: true,
    });
    expect(decision.reasonCodes).toEqual(expect.arrayContaining([
      'no_provider_evidence',
    ]));
  });

  it('requires immediate confirmation for numeric result changes', () => {
    const decision = evaluateTranscriptReviewDecision({
      transcriptCalibration: baseCalibration({
        rawTranscript: 'We reduced response time from 48 hours to 40 hours.',
        calibratedTranscript: 'We reduced response time from 48 hours to 14 hours.',
        corrections: [{
          rawSpan: '40 hours',
          correctedSpan: '14 hours',
          source: 'provider_nbest',
          reason: 'metric',
          confidence: 0.79,
          scoringImpacting: true,
        }],
      }),
      transcriptGate: { ok: true, decision: 'accept', reason: 'VALID_TRANSCRIPT' },
    });

    expect(decision).toMatchObject({
      decisionType: 'immediate_confirmation',
      riskLevel: 'high',
      evidenceImpact: 'scoring_material',
      userAction: 'confirm_understanding',
      scoringPolicy: 'block_scoring_until_confirmed',
    });
    expect(decision.reasonCodes).toEqual(expect.arrayContaining([
      'numeric_or_metric_change',
      'scoring_impacting_term',
    ]));
  });

  it('requires immediate confirmation for negation and ownership changes', () => {
    const decision = evaluateTranscriptReviewDecision({
      transcriptCalibration: baseCalibration({
        rawTranscript: 'I owned the migration and coordinated QA.',
        calibratedTranscript: 'I did not own the migration; I coordinated QA.',
        corrections: [{
          rawSpan: 'I owned the migration',
          correctedSpan: 'I did not own the migration',
          source: 'provider_nbest',
          reason: 'ownership',
          confidence: 0.72,
          scoringImpacting: true,
        }],
      }),
      transcriptGate: { ok: true, decision: 'accept', reason: 'VALID_TRANSCRIPT' },
    });

    expect(decision.decisionType).toBe('immediate_confirmation');
    expect(decision.reasonCodes).toEqual(expect.arrayContaining([
      'negation_change',
      'ownership_change',
    ]));
  });

  it('requires immediate confirmation for reversed technical choices', () => {
    const decision = evaluateTranscriptReviewDecision({
      transcriptCalibration: baseCalibration({
        rawTranscript: 'I chose MongoDB over PostgreSQL for relational constraints.',
        calibratedTranscript: 'I chose PostgreSQL over MongoDB for relational constraints.',
        corrections: [{
          rawSpan: 'MongoDB over PostgreSQL',
          correctedSpan: 'PostgreSQL over MongoDB',
          source: 'provider_nbest',
          reason: 'technical_choice',
          confidence: 0.76,
          scoringImpacting: true,
        }],
      }),
      transcriptGate: { ok: true, decision: 'accept', reason: 'VALID_TRANSCRIPT' },
    });

    expect(decision.decisionType).toBe('immediate_confirmation');
    expect(decision.reasonCodes).toEqual(expect.arrayContaining([
      'technical_choice_change',
    ]));
  });

  it('requires immediate confirmation when a scoring-impacting correction hits the current question signal', () => {
    const decision = evaluateTranscriptReviewDecision({
      transcriptCalibration: baseCalibration({
        rawTranscript: 'I configured cube cuddle security for the deployment.',
        calibratedTranscript: 'I configured Kubernetes security for the deployment.',
        nbest: { retained: true, candidateCount: 2, selectedIndex: 1 },
        corrections: [{
          rawSpan: 'cube cuddle security',
          correctedSpan: 'Kubernetes security',
          source: 'current_question',
          reason: 'expected_signal',
          confidence: 0.75,
          scoringImpacting: true,
        }],
      }),
      transcriptGate: { ok: true, decision: 'accept', reason: 'VALID_TRANSCRIPT' },
      currentQuestion: {
        expectedSignal: 'Kubernetes security tradeoff',
      },
    });

    expect(decision).toMatchObject({
      decisionType: 'immediate_confirmation',
      scoringPolicy: 'block_scoring_until_confirmed',
    });
    expect(decision.reasonCodes).toEqual(expect.arrayContaining([
      'expected_signal_hit',
    ]));
  });

  it('upgrades too many otherwise safe corrections into deferred review', () => {
    const decision = evaluateTranscriptReviewDecision({
      transcriptCalibration: baseCalibration({
        rawTranscript: 'I used red act, type scripts, post gray sql, and mongol db.',
        calibratedTranscript: 'I used React, TypeScript, PostgreSQL, and MongoDB.',
        corrections: [
          { rawSpan: 'red act', correctedSpan: 'React', source: 'jd_rubric', reason: 'tool_or_framework' },
          { rawSpan: 'type scripts', correctedSpan: 'TypeScript', source: 'jd_rubric', reason: 'tool_or_framework' },
          { rawSpan: 'post gray sql', correctedSpan: 'PostgreSQL', source: 'jd_rubric', reason: 'tool_or_framework' },
          { rawSpan: 'mongol db', correctedSpan: 'MongoDB', source: 'jd_rubric', reason: 'tool_or_framework' },
        ],
        staticCorrections: [],
      }),
      transcriptGate: { ok: true, decision: 'accept', reason: 'VALID_TRANSCRIPT' },
    });

    expect(decision).toMatchObject({
      decisionType: 'deferred_review',
      riskLevel: 'medium',
      scoringPolicy: 'score_with_reduced_evidence_confidence',
    });
    expect(decision.reasonCodes).toEqual(expect.arrayContaining([
      'cumulative_correction_risk',
    ]));
  });

  it('preserves post-turn clarification as a clarification artifact boundary', () => {
    const item = buildTranscriptReviewItem({
      decision: evaluateTranscriptReviewDecision({
        transcriptCalibration: baseCalibration({
          rawTranscript: 'I used history team during incidents.',
          calibratedTranscript: 'I used SRE team during incidents.',
        }),
        transcriptGate: { ok: true, decision: 'accept', reason: 'VALID_TRANSCRIPT' },
      }),
      sessionId: 'session-1',
      questionId: 'question-1',
      turnId: 'turn-1',
      questionText: 'Tell me about an incident response example.',
    });

    expect(item.evidenceBoundary).toMatchObject({
      rawTranscriptImmutable: true,
      clarificationCanAffectCoaching: true,
      clarificationCanReplaceRawTranscript: false,
    });
    expect(item.allowedActions).toEqual([
      'accept_correction',
      'keep_raw',
      'clarify_what_i_said',
    ]);
  });
});
