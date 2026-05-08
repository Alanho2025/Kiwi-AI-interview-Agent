import { describe, expect, it } from 'vitest';

import { buildNzWorkplaceFit } from '../../../src/services/nzWorkplaceFitService.js';
import { buildReportDraft } from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';
import { validateReportOutput } from '../../../src/services/schemaValidationService.js';

describe('NZ workplace fit robustness', () => {
  it('does not assess NZ workplace fit when the session setting is off', () => {
    const result = buildNzWorkplaceFit({
      session: {
        settings: { enableNZCultureFit: false },
        transcript: [
          { role: 'user', text: 'I worked with my team to improve the API handoff.' },
        ],
      },
    });

    expect(result.enabled).toBe(false);
    expect(result.score).toBeNull();
    expect(result.dimensionScores).toEqual([]);
  });

  it('flags solo-hero wording and provides a collaboration-focused rewrite', () => {
    const result = buildNzWorkplaceFit({
      session: {
        settings: { enableNZCultureFit: true },
        transcript: [
          {
            role: 'user',
            text: 'I completed the full system myself and did everything all by myself. It was easy for me because I was the best person on the team.',
          },
        ],
      },
    });

    expect(result.enabled).toBe(true);
    expect(result.gaps.join(' ')).toMatch(/shared result|over-claiming|solo heroics/i);
    expect(result.evidence.some((item) => item.signal === 'risk')).toBe(true);
    expect(result.suggestedRewrite.better).toMatch(/kept the team aligned/i);
    expect(result.suggestedRewrite.better).toMatch(/shared goal/i);
  });

  it('rewards observable teamwork, communication, initiative, and care signals', () => {
    const result = buildNzWorkplaceFit({
      session: {
        settings: { enableNZCultureFit: true },
        transcript: [
          {
            role: 'user',
            text: 'In my capstone project, I noticed the handoff was unclear, so I proposed a checklist and discussed it with my teammates. I led the implementation, checked the design with the team, and documented the workflow so new members could onboard more easily. The result was fewer missed steps and better trust with our stakeholder.',
          },
        ],
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(6);
    expect(result.strengths.join(' ')).toMatch(/team|communicate|trust|support/i);
    expect(result.gaps.join(' ')).not.toMatch(/solo heroics/i);
    expect(result.dimensionScores.find((item) => item.id === 'teamwork').observed).toBe(true);
    expect(result.dimensionScores.find((item) => item.id === 'manaakitanga').observed).toBe(true);
  });

  it('preserves NZ workplace fit in validated report output', () => {
    const nzWorkplaceFit = buildNzWorkplaceFit({
      session: {
        id: 'session-1',
        settings: { enableNZCultureFit: true },
        transcript: [
          { role: 'user', text: 'I worked with my team, clarified the issue, and supported the handoff for users.' },
        ],
      },
    });
    const draft = buildReportDraft({
      session: { id: 'session-1', settings: { enableNZCultureFit: true }, totalQuestions: 1 },
      analysisResult: { overallScore: 70, decision: { label: 'moderate_match' }, explanation: { strengths: [], gaps: [] }, scoreBreakdown: {} },
      interviewPlan: {},
      evidenceSummary: {
        totals: { direct_past_experience: 1, indirect_adjacent_experience: 0, hypothetical_understanding: 0, generic_filler: 0 },
        averageStrength: 2.5,
        strongestExamples: [],
      },
      interviewMetrics: { candidateTurnCount: 1, interviewerQuestionCount: 1, plannedQuestionCount: 1 },
      candidateFeedback: {},
      nzWorkplaceFit,
    });
    const validated = validateReportOutput(draft);

    expect(validated.nzWorkplaceFit.enabled).toBe(true);
    expect(validated.nzWorkplaceFit.score).toBe(nzWorkplaceFit.score);
    expect(validated.scores.nzWorkplaceFit).toBe(nzWorkplaceFit.score);
    expect(validated.sections.some((section) => section.id === 'nz_workplace_fit')).toBe(true);
  });
});
