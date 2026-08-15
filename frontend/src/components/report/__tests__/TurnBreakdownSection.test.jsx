import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TurnBreakdownSection } from '../TurnBreakdownSection.jsx';

describe('TurnBreakdownSection', () => {
  it('renders server-published framework labels, levels, and percentages without STARR micro-scores', () => {
    render(
      <TurnBreakdownSection
        turnBreakdowns={[{
          question: 'How would you manage a medication safety concern?',
          answer: 'I would review the record, escalate the risk, and document the outcome.',
          feedback: 'Explain how you verified the response.',
          rubricType: 'role_specific',
          frameworkKey: 'safety_quality_ethics',
          frameworkLabel: 'Safety, Quality and Ethics',
          starApplicable: false,
          scores: { business: 5, logic: 7, evidence: 4 },
          frameworkBreakdown: {
            dimensions: [
              { key: 'clinicalContext', label: 'Clinical context', status: 'clear', score: 10, level: 5, scorePercent: 100, reason: 'Context was clear.' },
              { key: 'professionalJudgement', label: 'Professional judgement', status: 'partial', score: 5, level: 3, scorePercent: 50, reason: 'Add the decision rationale.' },
              { key: 'riskQualityEthics', label: 'Risk / Quality / Ethics', status: 'clear', score: 10, level: 4, scorePercent: 75, reason: 'Risk was addressed.' },
              { key: 'validationVerification', label: 'Documentation / Review', status: 'partial', score: 5, level: 2, scorePercent: 25, reason: 'Explain the review.' },
              { key: 'outcomeValue', label: 'Patient outcome', status: 'not_applicable', score: 0, level: 1, scorePercent: 0, reason: 'Not required for this scenario.' },
            ],
            mainGapKey: 'professionalJudgement',
            normalizedScore: 7.5,
            level: 4,
            scorePercent: 75,
          },
          answerAssessment: {
            status: 'partly_addressed',
            score: 61,
            summary: 'Your answer is relevant, but needs clearer validation.',
            missingSignals: ['validation'],
            nextStep: 'Explain how you verified the response.',
          },
          strongerAnswer: {
            status: 'ready',
            answer: 'I would state the safety concern, explain my escalation, and confirm the documented outcome.',
          },
        }]}
      />
    );

    expect(screen.getByText('Safety, Quality and Ethics')).toBeInTheDocument();
    expect(screen.getByText('Professional judgement')).toBeInTheDocument();
    expect(screen.getByText('Documentation / Review')).toBeInTheDocument();
    expect(screen.getByText('Framework score: Level 4/5 · 75/100')).toBeInTheDocument();
    expect(screen.getByText('Level 3/5 · 50/100')).toBeInTheDocument();
    expect(screen.getByText('Level 5/5 · 100/100')).toBeInTheDocument();
    expect(screen.queryByText('Patient outcome')).not.toBeInTheDocument();
    expect(screen.queryByText('not applicable')).not.toBeInTheDocument();
    expect(screen.queryByText('STARR Evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Business')).not.toBeInTheDocument();
    expect(screen.queryByText(/\/10\b/)).not.toBeInTheDocument();
    expect(screen.getByText('Answer result')).toBeInTheDocument();
    expect(screen.getByText('Partly addressed')).toBeInTheDocument();
    expect(screen.getByText('61/100')).toBeInTheDocument();
    expect(screen.getByText(/Practice signal for your next answer/)).toBeInTheDocument();
    expect(screen.getByText('What to add: validation.')).toBeInTheDocument();
    expect(screen.getByText('A stronger answer')).toBeInTheDocument();
    expect(screen.getByText(/I would state the safety concern/)).toBeInTheDocument();
  });

  it('keeps a formal dimension when its server metrics are unavailable', () => {
    render(
      <TurnBreakdownSection turnBreakdowns={[{
        question: 'How would you approach the case?',
        answer: 'I would clarify the requirements first.',
        frameworkLabel: 'Scenario / Case Reasoning',
        frameworkBreakdown: {
          normalizedScore: 8,
          dimensions: [{
            label: 'Requirements',
            score: 10,
            reason: 'Requirements were identified.',
          }],
        },
      }]} />
    );

    expect(screen.getByText('Requirements')).toBeInTheDocument();
    expect(screen.getByText('Level unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/\/10\b/)).not.toBeInTheDocument();
  });

  it('shows Level unavailable when either server framework metric is missing', () => {
    const buildTurn = (frameworkBreakdown) => ({
      question: 'How would you approach the case?',
      answer: 'I would clarify the requirements first.',
      frameworkBreakdown,
    });
    const { rerender } = render(
      <TurnBreakdownSection turnBreakdowns={[buildTurn({
        dimensions: [{ label: 'Requirements', level: 4, reason: 'Requirements were identified.' }],
      })]} />
    );

    expect(screen.getByText('Level unavailable')).toBeInTheDocument();

    rerender(
      <TurnBreakdownSection turnBreakdowns={[buildTurn({
        dimensions: [{ label: 'Requirements', scorePercent: 75, reason: 'Requirements were identified.' }],
      })]} />
    );

    expect(screen.getByText('Level unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/\/10\b/)).not.toBeInTheDocument();
  });

  it('does not fabricate semantic dimensions from legacy scores when formal framework data is absent', () => {
    render(
      <TurnBreakdownSection turnBreakdowns={[{
        question: 'Please introduce yourself.',
        answer: 'I enjoy solving practical problems.',
        frameworkLabel: 'Introduction',
        scores: { business: 8, logic: 7, evidence: 6 },
      }]} />
    );

    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Formal framework feedback is unavailable for this answer.')).toBeInTheDocument();
    expect(screen.queryByText('Context / Goal')).not.toBeInTheDocument();
    expect(screen.queryByText('Business')).not.toBeInTheDocument();
    expect(screen.queryByText(/\/10\b/)).not.toBeInTheDocument();
  });

  it('renders duration as a server-published level without earned points', () => {
    render(
      <TurnBreakdownSection turnBreakdowns={[{
        question: 'How would you approach the case?',
        answer: 'I would clarify the requirements first.',
        frameworkBreakdown: { dimensions: [] },
        durationAssessment: { eligible: true, seconds: 92, level: 4, earnedPoints: 8, maxPoints: 10, reason: 'Good answer length.' },
      }]} />
    );

    expect(screen.getByText('Framework feedback')).toBeInTheDocument();
    expect(screen.getByText('Formal framework feedback is unavailable for this answer.')).toBeInTheDocument();
    expect(screen.getByText('Duration (92s)')).toBeInTheDocument();
    expect(screen.getByText('Level 4/5')).toBeInTheDocument();
    expect(screen.queryByText('8/10')).not.toBeInTheDocument();
  });

  it('shows a neutral unavailable state without generating candidate facts', () => {
    const candidateProjection = { report: { candidateFeedback: { turnBreakdowns: [{
      question: 'Please introduce yourself.',
      answer: 'I enjoy solving practical problems.',
      feedback: 'Add a grounded example.',
      strongerAnswer: {
        status: 'unavailable',
        unavailableReason: 'private stack diagnostic',
      },
    }] } } };

    render(
      <TurnBreakdownSection turnBreakdowns={candidateProjection.report.candidateFeedback.turnBreakdowns} />
    );

    expect(screen.getByText('Stronger answer unavailable')).toBeInTheDocument();
    expect(screen.getByText(/is not available for this response/i)).toBeInTheDocument();
    expect(screen.queryByText(/private stack diagnostic/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/University of Auckland|ZURU|85% project rating|AI engine/i)).not.toBeInTheDocument();
    expect(screen.queryByText('A stronger answer')).not.toBeInTheDocument();
  });

  it('shows STARR for behavioural answers', () => {
    render(
      <TurnBreakdownSection turnBreakdowns={[{
        question: 'Tell me about a conflict.',
        answer: 'I resolved a conflict and reflected on it.',
        feedback: 'Add the result.',
        rubricType: 'starr',
        frameworkKey: 'behavioural_starr',
        frameworkLabel: 'STARR',
        starApplicable: true,
        starBreakdown: {
          situation: 'clear', task: 'partial', action: 'clear', result: 'partial', reflection: 'clear',
        },
      }]} />
    );

    expect(screen.getByText('STARR Evidence')).toBeInTheDocument();
  });

  it('renders STARR evidence for behavioural answers with scores', () => {
    render(
      <TurnBreakdownSection
        turnBreakdowns={[
          {
            question: 'Tell me about a project.',
            answer: 'I built an automation workflow and reduced repetitive tasks.',
            feedback: 'Add a measurable result.',
            scores: { business: 5, logic: 7, evidence: 4 },
            starBreakdown: {
              situation: 'partial',
              task: 'partial',
              action: 'partial',
              result: 'partial',
              reflection: 'missing',
            },
          },
        ]}
      />
    );

    expect(screen.getByText('STARR Evidence')).toBeInTheDocument();
    expect(screen.getByText('Situation')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
