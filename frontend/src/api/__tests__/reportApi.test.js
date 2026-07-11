import { describe, expect, it, vi } from 'vitest';

const pdfMocks = vi.hoisted(() => {
  const instances = [];
  class MockJsPDF {
    constructor() {
      this.textCalls = [];
      this.savedFilename = '';
      this.pageCount = 1;
      instances.push(this);
    }

    setFontSize = vi.fn();
    setFont = vi.fn();
    setTextColor = vi.fn();
    setFillColor = vi.fn();
    setDrawColor = vi.fn();
    setLineWidth = vi.fn();
    line = vi.fn();
    rect = vi.fn();
    roundedRect = vi.fn();
    addPage = vi.fn(() => {
      this.pageCount += 1;
    });
    save = vi.fn((filename) => {
      this.savedFilename = filename;
    });
    getTextWidth = vi.fn((value) => String(value || '').length * 1.8);
    splitTextToSize = vi.fn((value) => String(value || '').match(/.{1,80}/g) || ['']);
    text = vi.fn((value) => {
      this.textCalls.push(String(value));
    });
  }

  return { MockJsPDF, instances };
});

vi.mock('jspdf', () => ({
  default: pdfMocks.MockJsPDF,
}));

describe('report PDF export', () => {
  it('includes candidate, role, QA status, and evidence summary in the generated PDF', async () => {
    const { generateReportPDF } = await import('../reportApi.js');

    await expect(generateReportPDF({
      sessionId: 'session-pdf-quality',
      latestStatus: 'needs_review',
      report: {
        candidateName: 'Aroha Candidate',
        jobTitle: 'Frontend Developer',
        generatedAt: '2026-06-02T10:00:00.000Z',
        summary: 'Candidate gave some React evidence.',
        scores: { overall: 74, macro: 70, micro: 78 },
        candidateFeedback: {
          overallTakeaway: 'Useful interview evidence with clear gaps.',
          scoreBand: 'Promising match',
          improvementPriorities: [],
          coachingAdvice: [],
          turnBreakdowns: [],
        },
        evidenceReferences: [
          { label: 'Transcript answer about React testing', sourceType: 'interview' },
        ],
        evidenceDiagnostics: {
          averageStrength: 2.5,
          totals: { direct_past_experience: 1, generic_filler: 1 },
        },
      },
      qaResult: {
        coverageScore: 68,
        hallucinationRisk: 'medium',
        qualityFlags: ['needs_more_evidence'],
      },
    })).resolves.toBe(true);

    const pdf = pdfMocks.instances.at(-1);
    const renderedText = pdf.textCalls.join('\n');

    expect(renderedText).toContain('Interview Report');
    expect(renderedText).toContain('CANDIDATE');
    expect(renderedText).toContain('Aroha Candidate');
    expect(renderedText).toContain('TARGET ROLE');
    expect(renderedText).toContain('Frontend Developer');
    expect(renderedText).toContain('Needs review');
    expect(renderedText).toContain('Evidence Sources');
    expect(renderedText).toContain('Transcript answer about React testing');
    expect(renderedText).not.toContain('NaN');
    expect(pdf.savedFilename).toBe('kiwi-ai-report-session-pdf-quality.pdf');
  });

  it('prints a safe evidence fallback when optional evidence sections are missing', async () => {
    const { generateReportPDF } = await import('../reportApi.js');

    await generateReportPDF({
      sessionId: 'session-pdf-empty-evidence',
      latestStatus: 'ready',
      report: {
        candidateName: 'Candidate',
        jobTitle: 'Data Analyst',
        scores: { overall: 62 },
        candidateFeedback: {
          overallTakeaway: 'Report has limited evidence.',
          scoreBand: 'Developing match',
        },
      },
      qaResult: {},
    });

    const renderedText = pdfMocks.instances.at(-1).textCalls.join('\n');
    expect(renderedText).toContain('Evidence sources');
    expect(renderedText).toContain('No evidence available');
  });

  it('exports all scored turns rather than only the first eight', async () => {
    const { generateReportPDF } = await import('../reportApi.js');
    const turns = Array.from({ length: 15 }, (_, index) => ({
      question: `Question ${index + 1}?`,
      answer: `Answer ${index + 1}`,
      feedback: `Feedback ${index + 1}`,
      scores: { business: 5, logic: 5, evidence: 5 },
    }));

    await generateReportPDF({
      sessionId: 'all-turns',
      report: { candidateFeedback: { turnBreakdowns: turns }, evidenceReferences: [] },
      qaResult: {},
    });

    expect(pdfMocks.instances.at(-1).textCalls.join('\n')).toContain('Q15: Question 15?');
  });

  it('does not send an unavailable rewrite payload to jsPDF', async () => {
    const { generateReportPDF } = await import('../reportApi.js');

    await generateReportPDF({
      sessionId: 'invalid-rewrite',
      report: {
        candidateFeedback: {
          answerRewriteExamples: [{
            status: 'unavailable',
            weak: 'Raw',
            better: '[補充情境]',
            failureReason: 'A grounded stronger answer could not be generated reliably.',
          }],
        },
      },
      qaResult: {},
    });

    const renderedText = pdfMocks.instances.at(-1).textCalls.join('\n');
    expect(renderedText).not.toContain('補充情境');
    expect(renderedText).toContain('could not be generated reliably');
  });

  it('prints evidence claims and snippets', async () => {
    const { generateReportPDF } = await import('../reportApi.js');

    await generateReportPDF({
      sessionId: 'evidence-rows',
      report: {
        evidenceReferences: [{
          claim: 'Latency reduction',
          sourceLabel: 'Answer Q3',
          evidenceSnippet: 'latency from 12 seconds to 3 seconds',
          confidenceLevel: 'medium',
        }],
      },
      qaResult: {},
    });

    const renderedText = pdfMocks.instances.at(-1).textCalls.join('\n');
    expect(renderedText).toContain('Latency reduction');
    expect(renderedText).toContain('latency from 12 seconds to 3 seconds');
  });

  it('prints plain-language Role-Fit coverage and answer feedback', async () => {
    const { generateReportPDF } = await import('../reportApi.js');

    await generateReportPDF({
      sessionId: 'role-fit-pdf',
      report: {
        roleFit: {
          status: 'ready',
          roleIntentCoverage: {
            total: 1,
            covered: 1,
            items: [{ label: 'Reliable production delivery', status: 'covered' }],
          },
          evidenceUsageMap: { totalUses: 0, items: [] },
          answerAlignments: [{
            turnId: 'answer-1',
            question: 'Tell me about a delivery improvement.',
            label: 'strong',
            score: 88,
            diagnosis: { mainIssue: 'Clear ownership and result.' },
            betterAnswerPlan: { direction: 'Keep the result easy to hear.' },
          }],
          questionReasoning: [],
        },
      },
      qaResult: {},
    });

    const renderedText = pdfMocks.instances.at(-1).textCalls.join('\n');
    expect(renderedText).toContain('How Your Answers Matched This Role');
    expect(renderedText).toContain('Reliable production delivery');
    expect(renderedText).toContain('Strong Match For This Answer');
    expect(renderedText).not.toMatch(/proofPointId|coverageId|evidenceId/);
  });
});
