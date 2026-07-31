import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProgressAnalyticsBanner } from '../ProgressAnalyticsBanner.jsx';
import { getProgressAnalytics, postCoachingSummary } from '../../../api/sessionApi.js';

vi.mock('../../../api/sessionApi.js', () => ({
  getProgressAnalytics: vi.fn(),
  postCoachingSummary: vi.fn(),
}));

describe('ProgressAnalyticsBanner (Option 2 Executive Banner & Phase C Slot)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Option 2 Executive Banner with Donut Chart, Evidence Bar, Story Matrix, and Stage 3 Badge', async () => {
    getProgressAnalytics.mockResolvedValue({
      data: {
        analyticsStatus: 'available',
        targetRole: 'Junior AI Integration Engineer',
        roleCoveragePercent: 78,
        readinessStage: 'Stage 3: Consistently Demonstrated',
        evidenceEvolution: [
          { sessionIndex: 1, directPastPercent: 40, hypotheticalPercent: 60, availabilityStatus: 'available' },
          { sessionIndex: 2, directPastPercent: 85, hypotheticalPercent: 15, availabilityStatus: 'available' },
        ],
        storyCompetencyMatrix: [
          { storyName: 'React Chatbot PoC', competency: 'Frontend API & State', status: 'Ready to Tell', level: 'Strong' },
          { storyName: 'NZ Clinic Data Migration', competency: 'System Design & Data', status: 'Ready to Tell', level: 'Strong' },
        ],
      },
    });

    render(<ProgressAnalyticsBanner targetRole="Junior AI Integration Engineer" deliveryMode="text" />);

    expect(await screen.findByText('PRACTICE PROGRESS & EVIDENCE ANALYTICS')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('🟢 Stage 3: Consistently Demonstrated')).toBeInTheDocument();
    expect(screen.getByText('85% Direct Past Evidence')).toBeInTheDocument();
    expect(screen.getByText('React Chatbot PoC')).toBeInTheDocument();
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

  it('triggers HITL toast feedback when candidate clicks Confirm chip', async () => {
    getProgressAnalytics.mockResolvedValue({
      data: {
        analyticsStatus: 'available',
        roleCoveragePercent: 78,
        readinessStage: 'Stage 3: Consistently Demonstrated',
        evidenceEvolution: [{ directPastPercent: 85, hypotheticalPercent: 15 }],
        storyCompetencyMatrix: [],
      },
    });

    render(<ProgressAnalyticsBanner targetRole="Junior AI Integration Engineer" deliveryMode="text" />);

    const confirmBtn = await screen.findByRole('button', { name: /✅ Confirm/i });
    fireEvent.click(confirmBtn);

    expect(await screen.findByText('✅ Confirmed AI evidence diagnosis and competency mapping')).toBeInTheDocument();
  });

  it('toggles Phase C dedicated reserved container slot and calls postCoachingSummary', async () => {
    getProgressAnalytics.mockResolvedValue({
      data: {
        analyticsStatus: 'available',
        roleCoveragePercent: 78,
        readinessStage: 'Stage 3: Consistently Demonstrated',
        evidenceEvolution: [{ directPastPercent: 85, hypotheticalPercent: 15 }],
        storyCompetencyMatrix: [],
      },
    });

    postCoachingSummary.mockResolvedValue({
      data: {
        coachingStatus: 'available',
        coachingSummary: 'You have completed 2 practice sessions for Junior AI Integration Engineer.',
        topRecommendation: 'Focus on Team Conflict Resolution.',
        tokenCost: { estimatedCost: 0.0015, totalTokens: 380 },
      },
    });

    render(<ProgressAnalyticsBanner targetRole="Junior AI Integration Engineer" deliveryMode="text" />);

    const phaseCBtn = await screen.findByRole('button', { name: /Generate Multi-Session AI Coaching Summary/i });
    fireEvent.click(phaseCBtn);

    expect(await screen.findByText(/You have completed 2 practice sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus on Team Conflict Resolution/i)).toBeInTheDocument();
  });
});
