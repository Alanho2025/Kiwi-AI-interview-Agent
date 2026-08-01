import { describe, expect, it } from 'vitest';

import { buildReportDraft } from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';
import {
  analyseCandidateAnswers,
  buildEvidenceSummary,
  buildInterviewMetrics,
} from '../../../src/services/agents/reportGenerator/reportEvidenceAnalysis.js';
import { buildDeterministicCandidateFeedback } from '../../../src/services/agents/reportGenerator/reportFeedbackBuilder.js';

describe('report Role Evidence Map cutover', () => {
  it('uses Role Evidence Map references instead of the legacy evidence summary for new reports', () => {
    const transcript = [
      { role: 'ai', text: 'Tell me about an API you owned.' },
      { role: 'user', text: 'I built a Node.js API and reduced response time by 30 percent.' },
    ];
    const evidenceSummary = buildEvidenceSummary(analyseCandidateAnswers(
      transcript.filter((turn) => turn.role === 'user'),
    ));
    const interviewMetrics = buildInterviewMetrics(transcript, 1);
    const analysisResult = {
      candidateName: 'Candidate',
      jobTitle: 'Backend Engineer',
      overallScore: 80,
      confidence: 0.8,
      decision: { label: 'strong_match' },
      explanation: { strengths: [], gaps: [] },
      scoreBreakdown: { macro: 80, micro: 80, requirements: 80 },
      evidenceMap: [{ type: 'strength', label: 'legacy duplicate' }],
      roleEvidenceMap: {
        items: [{
          roleIntentId: 'intent:api',
          roleIntent: 'Own backend API delivery',
          classification: 'direct',
          sourceEvidence: [{ evidenceId: 'evidence:api-1' }],
        }],
      },
    };
    const candidateFeedback = buildDeterministicCandidateFeedback({
      analysisResult,
      scores: { overall: 80 },
      explanation: analysisResult.explanation,
      evidenceSummary,
      interviewMetrics,
      interviewPlan: {},
    });

    const report = buildReportDraft({
      session: { id: 'session-1', candidateName: 'Candidate', targetRole: 'Backend Engineer', totalQuestions: 1 },
      analysisResult,
      evidenceSummary,
      interviewMetrics,
      candidateFeedback,
    });

    expect(report.evidenceDiagnostics.internalSourceReferences[0]).toEqual({
      roleIntentId: 'intent:api',
      label: 'Own backend API delivery',
      classification: 'direct',
      evidenceIds: ['evidence:api-1'],
      sourceType: 'role_evidence_map',
    });
    expect(JSON.stringify(report.evidenceDiagnostics.internalSourceReferences)).not.toContain('legacy duplicate');
    expect(candidateFeedback.scoreBand).toBe('Strong performance');
  });
});
