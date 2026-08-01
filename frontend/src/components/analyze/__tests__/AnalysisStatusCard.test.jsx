import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisStatusCard } from '../AnalysisStatusCard.jsx';

const analysisResult = {
  decision: { label: 'moderate_match' },
  requirementChecks: [
    {
      id: 'workflow',
      label: 'Build AI workflows',
      type: 'hard',
      importance: 'high',
      status: 'partial',
      notes: 'missingEvidence=The CV does not state the production outcome; interviewProbe=Which workflow did you own end to end?',
    },
    {
      id: 'stakeholder',
      label: 'Stakeholder communication',
      type: 'hard',
      importance: 'high',
      status: 'not_met',
      notes: 'interviewProbe=Which external stakeholder did you work with directly?',
    },
  ],
  roleEvidenceMap: {
    items: [
      {
        roleIntentId: 'workflow',
        roleIntent: 'Build AI workflows',
        priority: 'high',
        classification: 'adjacent',
        limitation: 'The CV does not state the production outcome.',
        sourceEvidence: [{
          text: 'Built an AI interview workflow for university students.',
          title: 'Kiwi Voice Coach',
          sourceTrace: { section: 'projects' },
        }],
      },
      {
        roleIntentId: 'stakeholder',
        roleIntent: 'Stakeholder communication',
        priority: 'high',
        classification: 'gap',
        sourceEvidence: [],
      },
      {
        roleIntentId: 'data',
        roleIntent: 'Measure product adoption',
        priority: 'medium',
        classification: 'direct',
        sourceEvidence: [{
          text: 'Tracked adoption metrics and iterated on internal tools.',
          sourceTrace: { section: 'experience' },
        }],
      },
    ],
  },
};

describe('AnalysisStatusCard preparation brief', () => {
  it('shows only a text fit plus complete, grounded interview-preparation cards', () => {
    render(<AnalysisStatusCard status="success" analysisResult={analysisResult} />);

    expect(screen.getByText('Partial match')).toBeInTheDocument();
    expect(screen.getByText('Interview topics to prepare')).toBeInTheDocument();
    expect(screen.getByText('Build AI workflows')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText(/Built an AI interview workflow/i)).toBeInTheDocument();
    expect(screen.getAllByText('No direct work or project example found.').length).toBeGreaterThan(0);
    expect(screen.getByText('The CV does not state the production outcome.')).toBeInTheDocument();
    expect(screen.getByText('Which workflow did you own end to end?')).toBeInTheDocument();
    expect(screen.queryByText(/Match score|Evidence confidence|Role evidence map|Priority requirement checks/i)).not.toBeInTheDocument();
  });

  it('keeps the completed Match visible while interview preparation is running', () => {
    render(<AnalysisStatusCard status="success" analysisResult={analysisResult} planStatus="preparing" />);

    expect(screen.getByText('Match analysis complete')).toBeInTheDocument();
    expect(screen.getByText('Preparing your interview focus')).toBeInTheDocument();
    expect(screen.queryByText(/^41$/)).not.toBeInTheDocument();
  });

  it('makes a grounded-topic shortfall explicit instead of inventing extra topics', () => {
    render(<AnalysisStatusCard
      status="success"
      analysisResult={{
        roleEvidenceMap: {
          items: [{
            roleIntentId: 'one',
            roleIntent: 'Build AI workflows',
            priority: 'high',
            classification: 'direct',
            sourceEvidence: [{ text: 'Built a workflow prototype.', sourceTrace: { section: 'projects' } }],
          }],
        },
      }}
    />);

    expect(screen.getByText(/fewer than three grounded topics/i)).toBeInTheDocument();
    expect(screen.getByText('Build AI workflows')).toBeInTheDocument();
  });

  it('renders backend-driven Match stages without a fake percentage', () => {
    render(<AnalysisStatusCard
      status="matching"
      progressStages={{
        input_validation: { id: 'input_validation', label: 'Checking your inputs', status: 'completed' },
        evidence_match: { id: 'evidence_match', label: 'Matching your CV evidence', status: 'started' },
      }}
      currentStage="evidence_match"
    />);

    expect(screen.getByText('Checking your inputs')).toBeInTheDocument();
    expect(screen.getByText('Matching your CV evidence')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders duplicate topic ids without React duplicate-key warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(<AnalysisStatusCard
        status="success"
        analysisResult={{
          roleEvidenceMap: {
            items: [
              { roleIntentId: 'Databricks', roleIntent: 'Databricks', priority: 'high', classification: 'direct' },
              { roleIntentId: 'Databricks', roleIntent: 'Databricks', priority: 'medium', classification: 'adjacent' },
            ],
          },
        }}
      />);

      expect(screen.getAllByRole('heading', { name: 'Databricks' })).toHaveLength(2);
      expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('same key'));
    } finally {
      consoleError.mockRestore();
    }
  });
});
