import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { TextArea } from '../common/TextArea.jsx';
import { Button } from '../common/Button.jsx';
import { Loader2, UploadCloud, AlertTriangle } from 'lucide-react';
import { buildJobDescriptionViewModel } from '../../utils/jobDescriptionViewModel.js';

const SummarySection = ({ title, items = [], emptyText = 'No clear items detected in this section.' }) => (
  <div className="rounded-lg border border-gray-100 bg-white p-4">
    <h5 className="text-sm font-semibold text-gray-900">{title}</h5>
    {items.length > 0 ? (
      <ul className="mt-3 space-y-2 text-sm text-gray-600">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2eb886]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-3 text-sm text-gray-500">{emptyText}</p>
    )}
  </div>
);

const TechnicalSkillGroup = ({ title, items }) => (
  <div className="rounded-lg border border-gray-100 bg-white p-4">
    <h5 className="text-sm font-semibold text-gray-900">{title}</h5>
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={`${title}-${item}`} className="rounded-full bg-[#eef8f4] px-3 py-1 text-xs font-medium text-[#1f7d59]">
          {item}
        </span>
      ))}
    </div>
  </div>
);

const AnalysisStatusBlock = ({ analysisMode, confidence, warnings, missingSections }) => (
  <div className="rounded-lg border border-gray-100 bg-white p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Analysis Status</p>
        <p className="mt-2 text-sm font-semibold text-gray-900">{analysisMode}</p>
        <p className="mt-1 text-xs text-gray-500">Confidence {Math.round((confidence || 0) * 100)}%</p>
      </div>
      {warnings?.length ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : null}
    </div>

    {warnings?.length ? (
      <ul className="mt-3 space-y-2 text-xs text-amber-700">
        {warnings.map((warning, index) => <li key={`warning-${index}`}>• {warning}</li>)}
      </ul>
    ) : (
      <p className="mt-3 text-xs text-gray-500">No parser warnings were raised for this JD.</p>
    )}

    {missingSections?.length ? <p className="mt-3 text-xs text-gray-500">Missing sections: {missingSections.join(', ')}</p> : null}
  </div>
);

export function JobContextCard({ rawJD, setRawJD, structuredJD, structuredJDRubric, onSummarize, isSummarizing }) {
  const viewModel = structuredJDRubric ? buildJobDescriptionViewModel(structuredJDRubric) : null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Job Context</CardTitle>
          <p className="mt-1 text-sm text-gray-500">Paste the job description so AI can tailor interview questions and coaching tips.</p>
        </div>
        <div className="text-xs text-gray-400">NZ-focused analysis</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Paste Job Description (JD)</h4>
          <TextArea
            rows={structuredJD ? 6 : 12}
            placeholder="Copy the job requirements from SEEK or LinkedIn here..."
            value={rawJD}
            onChange={(e) => setRawJD(e.target.value)}
            maxLength={6000}
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">Tip: include responsibilities, tech stack, and must-have skills.</p>
            <p className="text-xs text-gray-400">{rawJD.length}/6000</p>
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={onSummarize}
          disabled={!rawJD.trim() || isSummarizing}
          className="flex w-full items-center justify-center gap-2"
        >
          {isSummarizing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Summarizing...</>
          ) : (
            <><UploadCloud className="h-4 w-4" /> Upload & Summarize JD</>
          )}
        </Button>

        {structuredJD && structuredJDRubric && viewModel && (
          <div className="mt-4 space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">JD Summary</h4>
              <p className="mt-1 text-xs text-gray-500">
                This structured rubric is reused for CV matching, interview planning, and reporting.
              </p>
            </div>

            <AnalysisStatusBlock
              analysisMode={viewModel.analysisMode}
              confidence={viewModel.confidence}
              warnings={viewModel.warnings}
              missingSections={viewModel.missingSections}
            />

            <SummarySection title="Job Overview" items={[viewModel.title, ...viewModel.overviewItems]} emptyText="No overview details detected." />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SummarySection title="What This Role Does" items={viewModel.responsibilities} emptyText="Responsibilities could not be confidently extracted." />
              <SummarySection title="Core Requirements" items={viewModel.coreRequirements} emptyText="Core requirements could not be confidently extracted." />
              <SummarySection title="Bonus Requirements" items={viewModel.bonusRequirements} emptyText="No clear bonus requirements were detected." />
              <SummarySection title="Qualifications" items={viewModel.qualifications} emptyText="Qualifications could not be confidently extracted." />
            </div>

            {viewModel.technicalGroups.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {viewModel.technicalGroups.map((group) => <TechnicalSkillGroup key={group.groupKey} title={group.title} items={group.items} />)}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SummarySection title="Soft Skills" items={viewModel.softSkills} emptyText="No clear soft skills were detected." />
              <SummarySection title="Benefits" items={viewModel.benefits} emptyText="No clear benefits section was detected." />
            </div>

            <SummarySection title="Application Notes" items={viewModel.applicationInstructions} emptyText="No clear application instructions were detected." />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
