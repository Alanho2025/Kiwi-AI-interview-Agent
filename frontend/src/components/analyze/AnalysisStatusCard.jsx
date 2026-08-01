import { AlertTriangle, CheckCircle2, Target } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';
import { LoadingInsightPanel } from '../common/LoadingInsightPanel.jsx';
import { cn } from '../../utils/formatters.js';
import { buildMatchResultViewModel } from '../../utils/matchResultViewModel.js';
import { MatchProgressPanel } from './MatchProgressPanel.jsx';

const toneStyles = {
  success: 'border-emerald-100 bg-emerald-50',
  info: 'border-sky-100 bg-sky-50',
  warning: 'border-amber-100 bg-amber-50',
  danger: 'border-red-100 bg-red-50',
};

const FitSummary = ({ decision }) => (
  <section className={cn('rounded-2xl border p-5', toneStyles[decision.tone] || toneStyles.warning)}>
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70">
        <Target className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Overall fit</p>
        <h3 className="mt-1 text-xl font-semibold text-primary">{decision.label}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{decision.summary}</p>
      </div>
    </div>
  </section>
);

const CvExample = ({ example }) => {
  if (!example) {
    return <p className="mt-1 text-sm leading-6 text-muted">No direct work or project example found.</p>;
  }

  return (
    <div className="mt-1 text-sm leading-6 text-muted">
      <span className="mr-2 rounded-full bg-chip px-2 py-0.5 text-xs font-semibold text-primary">{example.source}</span>
      {example.title ? <span className="font-medium text-primary">{example.title}: </span> : null}
      {example.text}
    </div>
  );
};

const PreparationTopicCard = ({ topic, index }) => (
  <article className="rounded-xl border border-gray-100 glass p-4">
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-semibold text-primary">{index + 1}</span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-6 text-primary">{topic.topic}</h3>
        <span className={cn(
          'mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
          topic.needsEvidence ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800',
        )}>
          {topic.needsEvidence ? 'Evidence to prepare' : 'Use this CV example'}
        </span>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">CV example</p>
            <CvExample example={topic.example} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Evidence gap</p>
            <p className="mt-1 text-sm leading-6 text-muted">{topic.evidenceLimit}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Likely follow-up</p>
            <p className="mt-1 text-sm leading-6 text-muted">{topic.followUp}</p>
          </div>
        </div>
      </div>
    </div>
  </article>
);

export function AnalysisStatusCard({
  status,
  analysisResult,
  progressStages = {},
  currentStage = null,
  planStatus = 'idle',
}) {
  const matchViewModel = buildMatchResultViewModel(analysisResult);

  return (
    <Card data-qa="qa:card:match-analysis">
      <CardHeader>
        <div>
          <CardTitle>Match Analysis</CardTitle>
          <p className="mt-1 text-sm text-faint">Use this preparation brief to decide what examples to practise before the interview.</p>
        </div>
      </CardHeader>
      <CardContent>
        {status === 'idle' && <div className="py-6 text-center text-sm text-faint">Upload a CV, paste the JD, and review the JD summary before matching.</div>}

        {status === 'summarizing' ? (
          <LoadingInsightPanel
            stage="jd"
            skeletonLayout="match"
            title="KiwiCoach is structuring the JD..."
            message="Extracting role responsibilities, must-have requirements, and skill signals."
          />
        ) : null}

        {status === 'matching' ? <MatchProgressPanel progressStages={progressStages} currentStage={currentStage} /> : null}

        {status === 'error' ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">Match analysis could not finish</p>
                <p className="mt-1 text-sm leading-6 text-red-700">Check the page message, then rerun the analysis after fixing the input or service issue.</p>
              </div>
            </div>
          </div>
        ) : null}

        {status === 'success' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full [background:var(--accent-glow)]">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Match analysis complete</p>
                <p className="text-xs text-faint">This is an interview preparation brief, not a hiring decision.</p>
              </div>
            </div>

            <FitSummary decision={matchViewModel.decision} />

            <section aria-labelledby="preparation-topics-title">
              <div className="mb-3">
                <h2 id="preparation-topics-title" className="text-base font-semibold text-primary">Interview topics to prepare</h2>
                <p className="mt-1 text-sm text-faint">Use each CV example, then prepare for the stated evidence gap and follow-up.</p>
              </div>
              {matchViewModel.topics.length ? (
                <>
                  <div className="space-y-3">
                    {matchViewModel.topics.map((topic, index) => <PreparationTopicCard key={topic.id} topic={topic} index={index} />)}
                  </div>
                  {matchViewModel.topicShortfall ? (
                    <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                      This Match produced fewer than three grounded topics. Review the CV and JD before adding more topics.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  No grounded interview topics were produced. Review the CV and JD, then regenerate the Match.
                </p>
              )}
            </section>

            {planStatus === 'preparing' ? (
              <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5" aria-live="polite" data-qa="qa:panel:interview-preparation-progress">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                  <div>
                    <p className="text-sm font-semibold text-primary">Preparing your interview focus</p>
                    <p className="mt-1 text-sm leading-6 text-muted">Your saved Match remains available while KiwiCoach prepares the practice session.</p>
                  </div>
                </div>
              </section>
            ) : null}

            {planStatus === 'failed' ? (
              <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5" data-qa="qa:panel:interview-preparation-failed">
                <p className="text-sm font-semibold text-amber-900">Interview preparation needs another try</p>
                <p className="mt-1 text-sm leading-6 text-amber-800">Your Match is saved. Retry preparation without rerunning the Match.</p>
              </section>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
