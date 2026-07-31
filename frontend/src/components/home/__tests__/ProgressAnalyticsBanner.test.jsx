import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProgressAnalyticsBanner } from '../ProgressAnalyticsBanner.jsx';
import { getProgressAnalytics } from '../../../api/sessionApi.js';

vi.mock('../../../api/sessionApi.js', () => ({
  getProgressAnalytics: vi.fn(),
}));

describe('ProgressAnalyticsBanner (Pure Option B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Pure Option B banner with Stage badge, 4-segment evidence evolution, and in-context HITL focus', async () => {
    getProgressAnalytics.mockResolvedValue({
      data: {
        analyticsStatus: 'available',
        targetRole: 'Junior AI Integration Engineer',
        sessionCount: 3,
        roleCoveragePercent: 78,
        overallDirectRatioPercent: 13,
        readinessStage: 'Stage 2: Building Evidence',
        stageCriteriaReasons: [
          'Stage Rule: Threshold: Sessions ≥ 2 & Direct Evidence 1%–49%',
          'Sessions: 3 comparable sessions evaluated (meets threshold ≥2)',
          'Competency Coverage: 4/9 competencies have direct evidence (1%–49% range)',
        ],
        competencyBreakdown: {
          total: 9,
          covered: 4,
          partial: 2,
          notEvidenced: 3,
          unavailable: 0,
        },
        evidenceEvolution: [
          { sessionIndex: 1, directPastPercent: 40, adjacentPercent: 10, hypotheticalPercent: 40, fillerPercent: 10, availabilityStatus: 'available' },
          { sessionIndex: 2, directPastPercent: 85, adjacentPercent: 0, hypotheticalPercent: 15, fillerPercent: 0, availabilityStatus: 'available' },
        ],
        recommendedFocus: {
          focusArea: 'Stakeholder Communication (Team Conflict Resolution)',
          rationale: '3 of 4 comparable behavioural answers in this area were hypothetical.',
          evidenceTrace: {
            sessionId: 'sess-latest',
            questionText: 'Describe a disagreement with a senior engineer.',
            answerClassification: 'Hypothetical ("would usually")',
            candidateAnswerSnippet: 'I would usually discuss options calmly.',
            diagnosisReason: 'Speculative phrasing without past metrics.',
            scoringSchemaVersion: 'v7 (Rubric Score: 45/100)',
          },
        },
        comparableSessionList: [
          { sessionId: 'sess-1', sessionIndex: 1, createdAt: '2026-07-20T10:00:00Z', score: 65, directPastCount: 2, acceptedEligibleTurns: 4 },
          { sessionId: 'sess-2', sessionIndex: 2, createdAt: '2026-07-22T10:00:00Z', score: 78, directPastCount: 3, acceptedEligibleTurns: 4 },
        ],
      },
    });

    render(<ProgressAnalyticsBanner targetRole="Junior AI Integration Engineer" deliveryMode="text" />);

    expect(await screen.findByText('PRACTICE PROGRESS & EVIDENCE ANALYTICS')).toBeInTheDocument();
    expect(screen.getByText('🟢 Stage 2: Building Evidence')).toBeInTheDocument();
    expect(screen.getByText(/Latest Session Direct:/i)).toBeInTheDocument();
    expect(screen.getByText(/13% Direct STAR ratio/i)).toBeInTheDocument();
    expect(screen.getByText('Stakeholder Communication (Team Conflict Resolution)')).toBeInTheDocument();
    expect(screen.getByText(/Stage Rule: Threshold: Sessions ≥ 2/i)).toBeInTheDocument();

    // Verify Option A (Story Bank Matrix) and Option C (Phase C Slot) are NOT present
    expect(screen.queryByText('Story Competency Matrix')).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate Multi-Session AI Coaching Summary/i)).not.toBeInTheDocument();
  });

  it('renders edge state for N < 2 comparable sessions (insufficient_data)', async () => {
    getProgressAnalytics.mockResolvedValue({
      data: {
        analyticsStatus: 'insufficient_data',
        sessionCount: 1,
        message: 'At least 2 comparable sessions are required to unlock progress analytics.',
      },
    });

    render(<ProgressAnalyticsBanner targetRole="Junior AI Integration Engineer" deliveryMode="text" />);

    expect(await screen.findByText('1/2 Sessions Completed')).toBeInTheDocument();
    expect(screen.getByText('Building Progress & Evidence Analytics')).toBeInTheDocument();
  });

  it('toggles session audit drawer when candidate clicks Audit trigger button', async () => {
    getProgressAnalytics.mockResolvedValue({
      data: {
        analyticsStatus: 'available',
        targetRole: 'Junior AI Integration Engineer',
        deliveryMode: 'text',
        sessionCount: 2,
        readinessStage: 'Stage 2: Building Evidence',
        evidenceEvolution: [{ directPastPercent: 85, hypotheticalPercent: 15 }],
        comparableSessionList: [
          { sessionId: 'sess-123456789012', sessionIndex: 1, createdAt: '2026-07-20T10:00:00Z', score: 65, directPastCount: 2, acceptedEligibleTurns: 4 },
        ],
      },
    });

    render(<ProgressAnalyticsBanner targetRole="Junior AI Integration Engineer" deliveryMode="text" />);

    const auditBtn = await screen.findByRole('button', { name: /Audit Comparable Sessions Group/i });
    fireEvent.click(auditBtn);

    expect(await screen.findByText('5-Layer Pipeline Filter Criteria')).toBeInTheDocument();
    expect(screen.getByText(/Comparable Session Group/i)).toBeInTheDocument();
  });

  it('triggers full 6-field evidence trace modal display when clicked', async () => {
    getProgressAnalytics.mockResolvedValue({
      data: {
        analyticsStatus: 'available',
        readinessStage: 'Stage 2: Building Evidence',
        evidenceEvolution: [{ directPastPercent: 85, hypotheticalPercent: 15 }],
        recommendedFocus: {
          focusArea: 'Stakeholder Communication (Team Conflict Resolution)',
          rationale: '3 of 4 comparable behavioural answers were hypothetical.',
          evidenceTrace: {
            sessionId: 'sess-trace-123',
            questionText: 'Describe a disagreement with a senior engineer.',
            answerClassification: 'Hypothetical ("would usually")',
            candidateAnswerSnippet: 'I would usually discuss options calmly.',
            diagnosisReason: 'Speculative phrasing without past metrics.',
            scoringSchemaVersion: 'v7 (Rubric Score: 45/100)',
          },
        },
      },
    });

    render(<ProgressAnalyticsBanner targetRole="Junior AI Integration Engineer" deliveryMode="text" />);

    const traceBtn = await screen.findByRole('button', { name: /View Question Evidence Trace/i });
    fireEvent.click(traceBtn);

    expect(await screen.findByText(/1. Question:/i)).toBeInTheDocument();
    expect(screen.getByText(/2. Answer Classification:/i)).toBeInTheDocument();
    expect(screen.getByText(/3. Supporting Excerpt:/i)).toBeInTheDocument();
    expect(screen.getByText(/4. Diagnosis Reason:/i)).toBeInTheDocument();
    expect(screen.getByText(/5. Schema Version:/i)).toBeInTheDocument();
  });
});
