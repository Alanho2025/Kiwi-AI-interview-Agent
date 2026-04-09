import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/common/Card.jsx';
import { Button } from '../components/common/Button.jsx';
import { StatusBanner } from '../components/common/StatusBanner.jsx';
import { generateReport, getReport, qaReport } from '../api/reportApi.js';

const formatNumber = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-');

const titleCase = (value = '') => String(value)
  .split('_')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const extractFocusAreas = (sections = []) => {
  const observation = sections.find((section) => section.id === 'interview_observations');
  const match = String(observation?.content || '').match(/Focus areas:\s*(.+?)\.$/i);
  if (!match?.[1]) return [];
  return match[1].split(',').map((item) => item.trim()).filter(Boolean);
};

const getScoreBand = (overallScore) => {
  if (overallScore >= 80) return 'Strong match';
  if (overallScore >= 65) return 'Promising match';
  if (overallScore >= 45) return 'Developing match';
  return 'Needs stronger evidence';
};

const buildTakeaway = ({ report, qa, interviewMetrics, evidenceDiagnostics }) => {
  const overall = Number(report.scores?.overall || 0);
  const directTurns = Number(report.scores?.directEvidenceTurns || 0);
  const hypotheticalTurns = Number(report.scores?.hypotheticalTurns || 0);
  const evidenceStrength = Number(report.scores?.evidenceStrength || 0);

  if (overall >= 80 && evidenceStrength >= 2.8) {
    return 'You come across as a strong fit for the role, with solid alignment and credible examples from past work.';
  }

  if (overall >= 65 && directTurns >= hypotheticalTurns) {
    return 'You show good role fit, and your next step is to make your strongest examples more specific and memorable.';
  }

  if (overall >= 45 && evidenceStrength < 2) {
    return 'You show partial fit for the role, but your answers need more real project evidence to feel convincing.';
  }

  if (!qa.passed && (qa.qualityFlags || []).includes('question_count_mismatch')) {
    return 'The interview captured some useful signals, but the flow was incomplete, so the report should be read with caution.';
  }

  if ((evidenceDiagnostics.totals?.hypothetical_understanding || 0) > 0) {
    return 'You understand the role at a high level, but too many answers stayed theoretical instead of proving what you have already done.';
  }

  return 'This report suggests a mixed performance: some role alignment is present, but the interview did not consistently show clear, job-ready evidence.';
};

const buildDataInsights = ({ report, qa, interviewMetrics, evidenceDiagnostics }) => {
  const insights = [];
  const overall = Number(report.scores?.overall || 0);
  const evidenceStrength = Number(report.scores?.evidenceStrength || 0);
  const directTurns = Number(report.scores?.directEvidenceTurns || 0);
  const hypotheticalTurns = Number(report.scores?.hypotheticalTurns || 0);
  const plannedQuestions = Number(interviewMetrics.plannedQuestionCount || 0);
  const askedQuestions = Number(interviewMetrics.interviewerQuestionCount || 0);
  const genericTurns = Number(evidenceDiagnostics.totals?.generic_filler || 0);

  insights.push({
    title: 'Overall role fit',
    metric: `${formatNumber(overall)}/100`,
    description:
      overall >= 80
        ? 'Your profile and answers point to strong alignment with the role.'
        : overall >= 65
          ? 'You are reasonably aligned with the role, but there are still noticeable gaps to close.'
          : overall >= 45
            ? 'You have some relevant signals, but the overall case for fit is not strong yet.'
            : 'The current interview evidence does not yet support a strong match for this role.',
  });

  insights.push({
    title: 'Evidence quality',
    metric: `${formatNumber(evidenceStrength)}/4`,
    description:
      evidenceStrength >= 3
        ? 'Your answers usually included context, actions, and outcomes, which makes them persuasive.'
        : evidenceStrength >= 2
          ? 'Some answers had useful detail, but several still needed clearer actions or outcomes.'
          : 'Most answers were too general. You would benefit from using concrete project stories with measurable results.',
  });

  insights.push({
    title: 'Use of real examples',
    metric: `${directTurns} direct examples`,
    description:
      directTurns >= 4
        ? 'You regularly grounded your answers in past experience, which is exactly what interviewers look for.'
        : directTurns >= 2
          ? 'You used some real examples, but there is room to anchor more answers in work you have actually done.'
          : 'Very few answers were backed by direct past experience. This is likely reducing your credibility in the interview.',
  });

  insights.push({
    title: 'Theoretical answers',
    metric: `${hypotheticalTurns} hypothetical responses`,
    description:
      hypotheticalTurns === 0
        ? 'You stayed grounded in what you have done, not only what you might do.'
        : hypotheticalTurns <= 2
          ? 'A few answers sounded theoretical. Replacing them with real examples would make your story stronger.'
          : 'Too many answers leaned on theory or intent. Interviewers usually trust demonstrated experience more than hypothetical reasoning.',
  });

  insights.push({
    title: 'Interview completion',
    metric: plannedQuestions ? `${askedQuestions}/${plannedQuestions}` : `${askedQuestions} answered`,
    description:
      plannedQuestions > 0 && askedQuestions === plannedQuestions
        ? 'You completed the planned interview flow, so the report reflects the full session.'
        : 'The interview did not cleanly match the planned flow, so some signals may be incomplete.',
  });

  if (genericTurns > 0) {
    insights.push({
      title: 'Answers that felt generic',
      metric: `${genericTurns} generic turns`,
      description:
        genericTurns >= 4
          ? 'Several answers likely sounded broad or surface-level. This is a strong sign that you should prepare sharper STAR-style examples.'
          : 'A few answers may have felt too broad. Tightening them with specifics would improve clarity and impact.',
    });
  }

  if (!qa.passed) {
    insights.push({
      title: 'Report reliability',
      metric: qa.hallucinationRisk ? titleCase(qa.hallucinationRisk) : 'Needs review',
      description: 'The QA layer found issues in the report structure or evidence coverage, so this report should be treated as directional rather than final.',
    });
  }

  return insights;
};

const buildFallbackImprovementPriorities = ({ report, qa, interviewMetrics, evidenceDiagnostics }) => {
  const focusAreas = extractFocusAreas(report.sections || []);
  const directTurns = Number(report.scores?.directEvidenceTurns || 0);
  const hypotheticalTurns = Number(report.scores?.hypotheticalTurns || 0);
  const evidenceStrength = Number(report.scores?.evidenceStrength || 0);
  const genericTurns = Number(evidenceDiagnostics.totals?.generic_filler || 0);
  const advice = [];

  if (hypotheticalTurns > 0) {
    advice.push({
      title: 'Replace theory with proof',
      detail: 'When a question asks about a skill, lead with a real project you have already worked on. Use a simple structure: situation, your action, result.',
      example: 'Instead of saying "I would use React Native to build this", say "In my last project, I used React Native to build X, solved Y, and improved Z."',
    });
  }

  if (evidenceStrength < 2.2) {
    advice.push({
      title: 'Add action and outcome to every answer',
      detail: 'Your answers will sound stronger if each one includes what you personally did and what changed because of it.',
      example: 'Use this pattern: "The challenge was..., I handled..., and the result was..."',
    });
  }

  if (directTurns < 3) {
    advice.push({
      title: 'Prepare 3 reusable story banks',
      detail: 'Before the next interview, prepare three stories that show technical problem-solving, teamwork, and ownership. Reuse them across different questions.',
      example: 'Pick one mobile feature, one debugging story, and one collaboration story, then practise telling each in under 90 seconds.',
    });
  }

  if (genericTurns >= 3) {
    advice.push({
      title: 'Reduce broad or generic wording',
      detail: 'Avoid staying at the level of tools and concepts. Interviewers usually want evidence of judgment, trade-offs, and execution.',
      example: 'Swap "I know testing is important" for "I added tests for X, caught Y issue early, and avoided regression in Z flow."',
    });
  }

  if ((interviewMetrics.plannedQuestionCount || 0) && interviewMetrics.interviewerQuestionCount !== interviewMetrics.plannedQuestionCount) {
    advice.push({
      title: 'Practise concise answers',
      detail: 'Keeping answers focused can help the interview stay on track and make your strongest evidence easier to notice.',
      example: 'Aim for 60-90 second core answers, then expand only when the interviewer asks for more detail.',
    });
  }

  if (focusAreas.length > 0) {
    advice.push({
      title: 'Target the role-specific gaps',
      detail: `The interview repeatedly touched on ${focusAreas.slice(0, 3).join(', ')}. These are the themes you should strengthen first.`,
      example: `Prepare one example for each of these areas: ${focusAreas.slice(0, 3).join(', ')}.`,
    });
  }

  if (!advice.length) {
    advice.push({
      title: 'Keep building specificity',
      detail: 'You already have a workable base. The biggest gain now will come from sharper examples and clearer impact statements.',
      example: 'For each key project, prepare one sentence on the challenge, one on your actions, and one on the result.',
    });
  }

  return advice.slice(0, 4);
};

const buildFallbackCoachingAdvice = ({ report, qa, interviewMetrics, evidenceDiagnostics }) =>
  buildFallbackImprovementPriorities({ report, qa, interviewMetrics, evidenceDiagnostics }).map((item) => ({
    theme: item.title,
    advice: item.detail,
    example: item.example,
  }));

const buildFallbackAnswerRewriteTips = ({ report, evidenceDiagnostics }) => {
  const suggestions = [];
  const strongestExample = String(report.sections?.find((section) => section.id === 'evidence_examples')?.content || '');
  const hasGenericAnswers = Number(evidenceDiagnostics.totals?.generic_filler || 0) > 0;

  suggestions.push({
    weak: 'I know React Native and I think I can build this feature.',
    better: 'In a previous project, I used React Native to build a mobile flow, handled state and API integration, and improved the user experience by fixing performance and stability issues.',
  });

  if (hasGenericAnswers) {
    suggestions.push({
      weak: 'I am a good problem solver and I work well in teams.',
      better: 'When we hit a blocker in a team project, I broke the issue into smaller parts, coordinated the handoff with teammates, and helped the team ship the feature on time.',
    });
  }

  if (strongestExample && strongestExample !== 'No high-strength interview examples were captured.') {
    suggestions.push({
      weak: 'A broad answer without enough context or outcome.',
      better: 'Use your strongest example as a model: give the context, explain your exact contribution, and end with the result or lesson learned.',
    });
  }

  return suggestions.slice(0, 3);
};

const buildFallbackStrengthHighlights = (report = {}) => {
  const strengthsSection = report.sections?.find((section) => section.id === 'strengths');
  const labels = String(strengthsSection?.content || '')
    .match(/The clearest strengths were (.+?)\./)?.[1]
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) || [];

  return labels.slice(0, 4);
};

export function ReportPage() {
  const { sessionId } = useParams();
  const [reportData, setReportData] = useState(null);
  const [status, setStatus] = useState({ variant: 'info', title: 'Report', message: 'Generate a structured report for this session.' });
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    try {
      const data = await getReport(sessionId);
      setReportData(data);
      setStatus({ variant: 'success', title: 'Report loaded', message: `Status: ${data.latestStatus || 'ready'}` });
    } catch (error) {
      setReportData(null);
      setStatus({ variant: 'info', title: 'No report yet', message: error.message || 'Generate a report to view it here.' });
    }
  };

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateReport({ sessionId });
      setReportData(data.stored || data);
      setStatus({ variant: 'success', title: 'Report generated', message: 'A new structured report is ready.' });
      await loadReport();
    } catch (error) {
      setStatus({ variant: 'error', title: 'Generation failed', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleQa = async () => {
    setLoading(true);
    try {
      await qaReport({ sessionId });
      setStatus({ variant: 'success', title: 'QA completed', message: 'Report QA flags were refreshed.' });
      await loadReport();
    } catch (error) {
      setStatus({ variant: 'error', title: 'QA failed', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const report = reportData?.report || {};
  const qa = reportData?.qaResult || {};
  const interviewMetrics = report.interviewMetrics || {};
  const evidenceDiagnostics = report.evidenceDiagnostics || {};
  const qaDiagnostics = qa.diagnostics || {};
  const candidateFeedback = report.candidateFeedback || {};
  const takeaway = buildTakeaway({ report, qa, interviewMetrics, evidenceDiagnostics });
  const scoreBand = candidateFeedback.scoreBand || getScoreBand(Number(report.scores?.overall || 0));
  const generationSource = candidateFeedback.generationSource || '';
  const dataInsights = (candidateFeedback.plainEnglishMetrics || []).length
    ? candidateFeedback.plainEnglishMetrics
    : buildDataInsights({ report, qa, interviewMetrics, evidenceDiagnostics });
  const strengthHighlights = (candidateFeedback.strengthHighlights || []).length
    ? candidateFeedback.strengthHighlights
    : buildFallbackStrengthHighlights(report);
  const improvementPriorities = (candidateFeedback.improvementPriorities || []).length
    ? candidateFeedback.improvementPriorities
    : buildFallbackImprovementPriorities({ report, qa, interviewMetrics, evidenceDiagnostics });
  const coachingAdvice = (candidateFeedback.coachingAdvice || []).length
    ? candidateFeedback.coachingAdvice
    : buildFallbackCoachingAdvice({ report, qa, interviewMetrics, evidenceDiagnostics });
  const answerRewriteTips = (candidateFeedback.answerRewriteExamples || []).length
    ? candidateFeedback.answerRewriteExamples
    : buildFallbackAnswerRewriteTips({ report, evidenceDiagnostics });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <StatusBanner {...status} />
        <div className="flex gap-3">
          <Button onClick={handleGenerate} disabled={loading}>{loading ? 'Working...' : 'Generate report'}</Button>
          <Button onClick={handleQa} variant="secondary" disabled={loading}>Run QA</Button>
        </div>

        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
          <CardContent className="p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Interview Report
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Your Interview Feedback</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">{candidateFeedback.overallTakeaway || takeaway}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">{scoreBand}</span>
                  {generationSource === 'ai' && (
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-800">AI-generated coaching</span>
                  )}
                  {generationSource === 'fallback' && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">Fallback coaching</span>
                  )}
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">Decision: {titleCase(report.summary?.match(/Decision:\s*([^.]*)\./i)?.[1] || 'manual_review')}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">QA: {qa.passed ? 'Passed' : 'Needs review'}</span>
                </div>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-sm">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Overall score</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">{formatNumber(report.scores?.overall)}</p>
                  <p className="mt-1 text-sm text-gray-600">A snapshot of your current role fit.</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Evidence strength</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">{formatNumber(report.scores?.evidenceStrength)}</p>
                  <p className="mt-1 text-sm text-gray-600">How concrete and convincing your answers sounded.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>What The Data Says</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataInsights.map((insight) => (
                  <div key={insight.title || insight.label || insight.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{insight.title || insight.label}</h3>
                        <p className="mt-1 text-sm leading-6 text-gray-700">{insight.description || insight.interpretation}</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
                        {insight.metric || (Number.isFinite(Number(insight.value)) ? formatNumber(insight.value) : '-')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What You Did Well</CardTitle>
            </CardHeader>
            <CardContent>
              {strengthHighlights.length ? (
                <div className="space-y-3">
                  {strengthHighlights.map((item) => (
                    <div key={item.title || item.label} className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-sm font-medium text-emerald-900">{item.title || item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-emerald-800">{item.explanation || 'This showed up as one of your clearer match signals for the role. Keep backing it up with specific examples.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-gray-700">No standout strengths were captured yet. Generating a fresh report after a fuller interview may produce more useful highlights.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Priority Improvements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {improvementPriorities.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <h3 className="text-base font-semibold text-sky-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-sky-900">{item.whyItMatters || item.detail}</p>
                    <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm leading-6 text-sky-900">
                      <span className="font-semibold">What to do next:</span> {item.action || item.example}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Coaching</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {coachingAdvice.map((item, index) => (
                  <div key={`${item.weak}-${index}`} className="rounded-2xl border border-gray-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{item.theme || 'Coaching point'}</p>
                    <p className="mt-2 text-sm leading-6 text-gray-800">{item.advice}</p>
                    <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm leading-6 text-sky-900">
                      <span className="font-semibold">Try this next time:</span> {item.example}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How To Answer Better</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {answerRewriteTips.map((item, index) => (
                <div key={`${item.weak}-${index}`} className="rounded-2xl border border-gray-100 p-4">
                  <div className="rounded-xl bg-rose-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Weaker version</p>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{item.weak}</p>
                  </div>
                  <div className="mt-3 rounded-xl bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Stronger version</p>
                    <p className="mt-2 text-sm leading-6 text-emerald-900">{item.better}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Section-by-Section Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(report.sections || []).map((section) => (
                <div key={section.id} className="rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{section.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Detailed Metrics</h2>
              <p className="mt-1 text-sm text-gray-600">For users who want the raw numbers behind the feedback.</p>
            </div>
            <span className="text-sm font-medium text-gray-500 group-open:hidden">Show details</span>
            <span className="hidden text-sm font-medium text-gray-500 group-open:block">Hide details</span>
          </summary>
          <div className="border-t border-gray-100 p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">Scores</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Overall: {formatNumber(report.scores?.overall)}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Macro: {formatNumber(report.scores?.macro)}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Micro: {formatNumber(report.scores?.micro)}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Requirements: {formatNumber(report.scores?.requirements)}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Evidence strength: {formatNumber(report.scores?.evidenceStrength)}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Direct evidence turns: {report.scores?.directEvidenceTurns ?? '-'}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Hypothetical turns: {report.scores?.hypotheticalTurns ?? '-'}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">Interview metrics</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Planned questions: {interviewMetrics.plannedQuestionCount ?? '-'}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Scored questions: {interviewMetrics.interviewerQuestionCount ?? '-'}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Candidate turns: {interviewMetrics.candidateTurnCount ?? '-'}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Extra AI turns: {interviewMetrics.extraAiTurnCount ?? '-'}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Completed by limit: {interviewMetrics.interviewCompletedByLimit ? 'Yes' : 'No'}</div>
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">Average evidence strength: {formatNumber(evidenceDiagnostics.averageStrength)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-800">QA result</h3>
              <p className="mt-2 text-sm text-amber-900">
                Coverage score: {qa.coverageScore ?? '-'} | Hallucination risk: {qa.hallucinationRisk || '-'} | Passed: {qa.passed ? 'Yes' : 'No'}
              </p>
              <p className="mt-2 text-sm text-amber-900">
                QA question alignment: {qaDiagnostics.interviewerQuestionCount ?? '-'} / {qaDiagnostics.plannedQuestionCount ?? '-'} | Avg evidence strength: {formatNumber(qaDiagnostics.averageEvidenceStrength)}
              </p>
              {(qa.qualityFlags || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(qa.qualityFlags || []).map((flag) => (
                    <span key={flag} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm">
                      {titleCase(flag)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}
