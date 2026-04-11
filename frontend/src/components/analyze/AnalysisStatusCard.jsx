/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: AnalysisStatusCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Purpose: Execute the main responsibility for ScorePill.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const ScorePill = ({ label, value }) => (
  <div className="rounded-xl border border-gray-100 bg-white p-4">
    <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-2 text-2xl font-bold text-gray-900">{Math.round(value || 0)}</p>
  </div>
);

/**
 * Purpose: Execute the main responsibility for ListBlock.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const ListBlock = ({ title, items, emptyText }) => (
  <div className="rounded-xl border border-gray-100 bg-white p-4">
    <p className="text-sm font-semibold text-gray-900">{title}</p>
    {items?.length ? (
      <ul className="mt-3 space-y-2 text-sm text-gray-600">
        {items.map((item) => (
          <li key={item.id || item.label || item} className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="font-medium text-gray-800">{item.label || item}</span>
            {item.detail ? <span className="ml-2 text-xs text-gray-500">{item.detail}</span> : null}
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-3 text-sm text-gray-500">{emptyText}</p>
    )}
  </div>
);

/**
 * Purpose: Execute the main responsibility for RequirementTable.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const RequirementTable = ({ items }) => {
  if (!items?.length) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Requirement checks</p>
        <p className="mt-3 text-sm text-gray-500">No requirement checks were produced.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">Requirement checks</p>
      <div className="mt-3 space-y-2">
        {items.slice(0, 6).map((item) => (
          <div key={item.id || item.label} className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-500">{item.type} · {item.importance}</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Purpose: Execute the main responsibility for AnalysisStatusCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function AnalysisStatusCard({ status, matchRate, analysisResult }) {
  const explanation = analysisResult?.explanation || {};
  const scoreBreakdown = analysisResult?.scoreBreakdown || {};

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Analysis Status</CardTitle>
          <p className="mt-1 text-sm text-gray-500">Track JD summary progress and review the structured match result used to build the interview plan.</p>
        </div>
      </CardHeader>
      <CardContent>
        {status === 'idle' && <div className="py-6 text-center text-sm text-gray-500">Upload a CV and paste a job description to begin analysis.</div>}

        {status === 'summarizing' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6f7f0]">
                <Loader2 className="h-5 w-5 animate-spin text-[#2eb886]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">AI is structuring the JD...</p>
                <p className="text-xs text-gray-500">Extracting rubric criteria, requirements, and weights.</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-1/3 animate-pulse rounded-full bg-[#2eb886]"></div></div>
          </div>
        )}

        {status === 'matching' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6f7f0]">
                <Loader2 className="h-5 w-5 animate-spin text-[#2eb886]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">AI is scoring the CV against the JD rubric...</p>
                <p className="text-xs text-gray-500">Building macro scores, micro scores, requirement checks, and interview focus areas.</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#2eb886]"></div></div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Analysis complete</p>
                <p className="text-xs text-gray-500">Review the validated schema output before starting the interview.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ScorePill label="Overall" value={analysisResult?.overallScore ?? matchRate ?? 0} />
              <ScorePill label="Macro" value={scoreBreakdown.macro || 0} />
              <ScorePill label="Micro" value={scoreBreakdown.micro || 0} />
              <ScorePill label="Requirements" value={scoreBreakdown.requirements || 0} />
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Decision</p>
                  <p className="mt-1 text-xs text-gray-500">{analysisResult?.decision?.label || 'manual_review'} · confidence {analysisResult?.confidence ?? 0}</p>
                </div>
                {analysisResult?.riskFlags?.length ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : null}
              </div>
              <p className="mt-3 text-sm text-gray-600">{explanation.summary || analysisResult?.planPreview}</p>
            </div>

            <RequirementTable items={analysisResult?.requirementChecks} />

            <div className="grid gap-3 lg:grid-cols-3">
              <ListBlock title="Strengths" items={explanation.strengths} emptyText="No strong strengths were identified." />
              <ListBlock title="Gaps" items={explanation.gaps} emptyText="No obvious gaps were identified." />
              <ListBlock title="Risks" items={explanation.risks} emptyText="No major risks were flagged." />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
