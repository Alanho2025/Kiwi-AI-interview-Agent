import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

const SCORE_KEYS = [
  ['overall', 'Overall score'],
  ['cvJdMatch', 'CV–JD match'],
  ['interviewPerformance', 'Interview performance'],
];

export function CandidateReportSummary({ scoreExplanations = {}, dataInsights = [] }) {
  const explanations = SCORE_KEYS
    .map(([key, label]) => ({
      key,
      label,
      explanation: scoreExplanations?.[key]?.explanation || '',
    }))
    .filter((item) => item.explanation);
  const insights = Array.isArray(dataInsights) ? dataInsights.slice(0, 3) : [];
  if (!explanations.length && !insights.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What your scores mean</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {explanations.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-primary">{item.label}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.explanation}</p>
            </div>
          ))}
          {!explanations.length ? insights.map((item, index) => (
            <div key={item.title || item.label || index} className="rounded-xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-primary">{item.title || item.label}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description || item.interpretation}</p>
            </div>
          )) : null}
        </div>
      </CardContent>
    </Card>
  );
}
