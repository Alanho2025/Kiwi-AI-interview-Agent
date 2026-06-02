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
    setDrawColor = vi.fn();
    line = vi.fn();
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

    expect(renderedText).toContain('Candidate & Role');
    expect(renderedText).toContain('Candidate: ');
    expect(renderedText).toContain('Aroha Candidate');
    expect(renderedText).toContain('Target Role: ');
    expect(renderedText).toContain('Frontend Developer');
    expect(renderedText).toContain('QA Status: ');
    expect(renderedText).toContain('needs_review');
    expect(renderedText).toContain('Evidence Summary');
    expect(renderedText).toContain('- Transcript answer about React testing');
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
    expect(renderedText).toContain('Evidence Summary');
    expect(renderedText).toContain('No evidence available');
  });
});
