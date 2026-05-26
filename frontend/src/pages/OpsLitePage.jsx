import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Brain,
  CheckCircle2,
  Gauge,
  Layers3,
  Mic2,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/common/Card.jsx';
import { getOpsLiteSummary } from '../api/opsLiteApi.js';

const pct = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${Math.round(numeric * 100)}%`;
};

const score = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return numeric.toFixed(2);
};

const numberValue = (value) => (value === null || value === undefined || value === '' ? '-' : value);

const groupLabels = {
  analysisQuality: {
    title: 'Agent analysis quality',
    subtitle: 'Checks whether CV parsing, JD parsing, and CV-JD matching are actually correct.',
    icon: Brain,
  },
  trajectoryQuality: {
    title: 'Decision & trajectory quality',
    subtitle: 'Checks whether the agent chooses the right next step and follows the interview plan.',
    icon: Radar,
  },
  groundingSafety: {
    title: 'Grounding & safety',
    subtitle: 'Checks RAG evidence, company research, report grounding, and hallucination control.',
    icon: ShieldCheck,
  },
  voiceQuality: {
    title: 'Voice quality',
    subtitle: 'Checks transcript noise, filler words, partial answers, and voice-safe coaching.',
    icon: Mic2,
  },
  reliability: {
    title: 'Reliability',
    subtitle: 'Checks multi-trial stability and repeated-run consistency.',
    icon: Activity,
  },
};

function StatusPill({ passed }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${passed ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'}`}>
      {passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {passed ? 'Pass' : 'Needs work'}
    </span>
  );
}

function HeroMetric({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-accent-soft p-3 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Live eval</span>
      </div>
      <p className="mt-5 text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-primary">{value}</p>
      {detail ? <p className="mt-2 text-sm text-muted">{detail}</p> : null}
    </div>
  );
}

function SuiteRow({ suite }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-primary">{suite.label}</p>
          <p className="mt-1 text-xs text-muted">{suite.casesRun} cases · average {score(suite.average)}{suite.criticalAverage !== undefined ? ` · critical ${score(suite.criticalAverage)}` : ''}</p>
        </div>
        <StatusPill passed={suite.passed} />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, Number(suite.average || 0) * 100))}%` }} />
      </div>
      {suite.failedCaseCount ? (
        <div className="mt-3 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
          <span className="font-semibold">Weak cases:</span>{' '}
          {(suite.failedCases || []).slice(0, 3).map((item) => item.id).join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function EvalGroupCard({ groupKey, suites }) {
  const config = groupLabels[groupKey] || groupLabels.reliability;
  const Icon = config.icon;
  const avg = suites.length ? suites.reduce((sum, item) => sum + Number(item.average || 0), 0) / suites.length : 0;
  const cases = suites.reduce((sum, item) => sum + Number(item.casesRun || 0), 0);

  return (
    <Card className="overflow-hidden border-white/60 bg-white/70 shadow-sm backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="rounded-2xl bg-accent-soft p-3 text-accent">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{config.title}</CardTitle>
              <p className="mt-1 text-sm text-muted">{config.subtitle}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Group score</p>
            <p className="text-2xl font-semibold text-primary">{score(avg)}</p>
            <p className="text-xs text-muted">{cases} cases</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {suites.length ? (
          <div className="grid gap-3">
            {suites.map((suite) => <SuiteRow key={suite.id} suite={suite} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-muted">
            No latest eval report found for this group yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RiskCoverage({ coverage = [] }) {
  return (
    <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-accent-soft p-3 text-accent">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Plan risk coverage</CardTitle>
            <p className="mt-1 text-sm text-muted">Maps the Notion evaluation plan risks to real eval suites.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {coverage.map((item) => (
            <div key={item.category} className={`rounded-2xl px-4 py-3 text-sm ring-1 ${item.covered ? 'bg-emerald-50/80 text-emerald-800 ring-emerald-100' : 'bg-slate-50 text-slate-500 ring-slate-100'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.category.replaceAll('_', ' ')}</span>
                {item.covered ? <BadgeCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <p className="mt-1 text-xs opacity-80">{item.suiteCount} linked suite{item.suiteCount === 1 ? '' : 's'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RuntimeOpsCard({ summary }) {
  const latency = summary?.latency || {};
  const rag = summary?.rag || {};
  const voice = summary?.voice || {};

  return (
    <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-accent-soft p-3 text-accent">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Runtime ops signals</CardTitle>
            <p className="mt-1 text-sm text-muted">Secondary monitoring from real sessions. Eval quality is shown above.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white/75 p-4 ring-1 ring-white/70">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Total turn latency</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{numberValue(latency.totalTurnMs)} ms</p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4 ring-1 ring-white/70">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">RAG activation</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{pct(rag.activationRate)}</p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4 ring-1 ring-white/70">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Unsupported blocked</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{numberValue(rag.unsupportedEvidenceBlockedCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4 ring-1 ring-white/70">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Voice metric sessions</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{numberValue(voice.sessionsWithVoiceMetrics)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OpsLitePage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    getOpsLiteSummary()
      .then((data) => {
        if (!active) return;
        setSummary(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const agentEvaluation = summary?.agentEvaluation || {};
  const groups = agentEvaluation.groups || {};
  const hasReports = agentEvaluation.reportDirectoryFound !== false;

  const weakCases = useMemo(() => (agentEvaluation.failedCases || []).slice(0, 8), [agentEvaluation.failedCases]);

  if (status === 'loading') {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <div className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full blur-[120px] animate-float" style={{ background: 'var(--orb-1)' }} />
        <div className="rounded-3xl border border-white/60 bg-white/75 px-6 py-5 text-sm font-medium text-muted shadow-sm backdrop-blur-xl">
          Loading agent evaluation dashboard...
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <div className="rounded-3xl border border-rose-100 bg-rose-50/80 p-6 text-rose-700 shadow-sm backdrop-blur-xl">
          Could not load Ops Lite agent evaluation summary.
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-16" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <div className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full blur-[120px] animate-float" style={{ background: 'var(--orb-1)' }} />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full blur-[100px] animate-float-slow" style={{ background: 'var(--orb-2)' }} />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-[80px] animate-float" style={{ background: 'var(--orb-3)', animationDelay: '3s' }} />

      <main className="relative mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-8 lg:px-10">
        <section className="rounded-[2rem] border border-white/60 bg-white/65 p-6 shadow-sm backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-muted ring-1 ring-white/70 transition hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </button>
              <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                <Sparkles className="h-3.5 w-3.5" /> Agent evaluation control room
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-5xl">
                Ops Lite now tracks agent analysis quality.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                This page links the Notion evaluation plan to real latest eval reports. It focuses on whether the agent parses, matches, retrieves, decides, and reports correctly.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-950/90 p-5 text-white shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Current status</p>
              <p className="mt-2 text-3xl font-semibold">{pct(agentEvaluation.passRate)}</p>
              <p className="mt-1 text-sm text-white/70">eval suite pass rate</p>
            </div>
          </div>
        </section>

        {!hasReports ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50/80 p-5 text-amber-800 shadow-sm backdrop-blur-xl">
            No eval report directory was found. Run the backend eval commands from the backend folder so Ops Lite can load latest reports.
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetric icon={BarChart3} label="Eval suites" value={numberValue(agentEvaluation.totalSuites)} detail="latest JSON reports loaded" />
          <HeroMetric icon={Layers3} label="Total eval cases" value={numberValue(agentEvaluation.totalCases)} detail="across parser, match, trajectory, RAG, voice" />
          <HeroMetric icon={TrendingUp} label="Average score" value={score(agentEvaluation.averageScore)} detail="mean score across suites" />
          <HeroMetric icon={ShieldCheck} label="Suite pass rate" value={pct(agentEvaluation.passRate)} detail={`${(agentEvaluation.failedSuites || []).length} suites need work`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <EvalGroupCard groupKey="analysisQuality" suites={groups.analysisQuality || []} />
          <EvalGroupCard groupKey="trajectoryQuality" suites={groups.trajectoryQuality || []} />
          <EvalGroupCard groupKey="groundingSafety" suites={groups.groundingSafety || []} />
          <EvalGroupCard groupKey="voiceQuality" suites={groups.voiceQuality || []} />
          <EvalGroupCard groupKey="reliability" suites={groups.reliability || []} />
          <Card className="border-white/60 bg-white/70 shadow-sm backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-accent-soft p-3 text-accent">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Weakest current cases</CardTitle>
                  <p className="mt-1 text-sm text-muted">Cases with failed checks from latest agent evaluation reports.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {weakCases.length ? (
                <div className="space-y-3">
                  {weakCases.map((item) => (
                    <div key={`${item.suite}-${item.id}`} className="rounded-2xl bg-amber-50/80 p-4 text-sm ring-1 ring-amber-100">
                      <p className="font-semibold text-amber-900">{item.id}</p>
                      <p className="mt-1 text-xs text-amber-700">{item.suite} · score {score(item.score)}</p>
                      <p className="mt-2 text-xs text-amber-800">{(item.failedChecks || []).join(', ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50/80 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
                  No failed checks found in the loaded latest reports.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <RiskCoverage coverage={agentEvaluation.riskCoverage || []} />
        <RuntimeOpsCard summary={summary} />
      </main>
    </div>
  );
}
