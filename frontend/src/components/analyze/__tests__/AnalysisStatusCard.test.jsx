import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnalysisStatusCard } from '../AnalysisStatusCard.jsx';

const analysisResult = {
  overallScore: 41,
  confidence: 0.74,
  decision: { label: 'weak_match' },
  scoreBreakdown: { macro: 33, micro: 41, requirements: 34 },
  explanation: {
    strengths: [{ label: 'Python', evidence: ['Built an AI interview workflow.'] }],
    gaps: [{ label: 'Limited direct evidence for AI tool fluency' }],
    risks: [],
    summary: 'Limited strong matches were found.',
  },
  requirementChecks: [
    {
      id: 'ai-workflow',
      label: 'Experience building AI workflows',
      type: 'hard',
      importance: 'high',
      status: 'partial',
      notes: 'project-based evidence only; evidenceStrength=partial',
      evidence: ['Designed AI agent product workflows.'],
    },
  ],
  matchingDetails: {
    semanticEvidenceModel: { scorer: 'deterministic-fallback' },
    semanticEvidenceMatches: [
      {
        label: 'Experience building AI workflows',
        matches: [{
          score: 0.67,
          evidenceStrength: 'partial',
          text: 'Designed AI agent product workflows.',
        }],
      },
    ],
  },
  roleEvidenceMap: {
    intentCoverage: { highPriorityTotal: 1, strong: 0, partial: 1, missing: 0 },
    items: [{
      roleIntentId: 'intent:workflow',
      roleIntent: 'Experience building AI workflows',
      priority: 'high',
      classification: 'weak',
      score: 56,
      sourceEvidence: [{ text: 'Designed AI agent product workflows.', sourceTrace: { section: 'projects' } }],
      limitation: 'The CV wording is related, but applied ownership and outcome evidence are limited.',
    }],
  },
};

describe('AnalysisStatusCard match output copy', () => {
  it('keeps debug scorer and internal matching terms out of the user-facing result', () => {
    render(<AnalysisStatusCard status="success" analysisResult={analysisResult} questionPoolInfo={{}} />);

    expect(screen.queryByText(/deterministic-fallback/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Semantic similarity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/role intent/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Closest CV evidence/i)).toBeInTheDocument();
  });

  it('renders backend-driven Match stages without a fake percentage', () => {
    render(<AnalysisStatusCard
      status="matching"
      progressStages={{
        input_validation: {
          id: 'input_validation',
          label: 'Checking your inputs',
          status: 'completed',
        },
        evidence_match: {
          id: 'evidence_match',
          label: 'Matching your CV evidence',
          status: 'started',
        },
      }}
      currentStage="evidence_match"
    />);

    expect(screen.getByText('Checking your inputs')).toBeInTheDocument();
    expect(screen.getByText('Matching your CV evidence')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/critic|embedding|provider/i)).not.toBeInTheDocument();
  });

  it('keeps the completed Match visible while interview preparation is running', () => {
    render(<AnalysisStatusCard
      status="success"
      analysisResult={analysisResult}
      planStatus="preparing"
      questionPoolInfo={null}
    />);

    expect(screen.getByText('Match analysis complete')).toBeInTheDocument();
    expect(screen.getByText('Preparing your interview focus')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
  });
});
