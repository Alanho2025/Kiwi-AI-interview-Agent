import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { TextArea } from '../common/TextArea.jsx';
import { Button } from '../common/Button.jsx';
import { Loader2, FileText, AlertTriangle, CheckCircle2, PencilLine } from 'lucide-react';
import { buildJobDescriptionViewModel } from '../../utils/jobDescriptionViewModel.js';

const normalizeList = (items = []) => (Array.isArray(items) ? items : [])
  .map((item) => (typeof item === 'string' ? item : item?.label || item?.name || ''))
  .map((item) => item.trim())
  .filter(Boolean);

const splitListText = (value = '') => String(value || '')
  .split('\n')
  .map((line) => line.replace(/^[-•*]\s*/, '').trim())
  .filter(Boolean);

const joinListText = (items = []) => normalizeList(items).join('\n');
const fieldClass = 'mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#2eb886] focus:ring-2 focus:ring-[#2eb886]/15';

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
        <span key={`${title}-${item}`} className="rounded-lg bg-[#eef8f4] px-3 py-1.5 text-xs font-medium text-[#1f7d59]">
          {item}
        </span>
      ))}
    </div>
  </div>
);

const TechnicalGroups = ({ groups }) => {
  if (!groups.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {groups.map((group) => <TechnicalSkillGroup key={group.groupKey} title={group.title} items={group.items} />)}
    </div>
  );
};

const EditableTextField = ({ label, value, onChange, placeholder = '' }) => (
  <label className="block text-xs font-semibold text-gray-600">
    {label}
    <input className={fieldClass} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const EditableListField = ({ label, value = [], onChange, placeholder = '' }) => (
  <label className="block text-xs font-semibold text-gray-600">
    {label}
    <textarea
      className={`${fieldClass} min-h-[92px] resize-y leading-5`}
      value={joinListText(value)}
      placeholder={placeholder}
      onChange={(event) => onChange(splitListText(event.target.value))}
    />
    <span className="mt-1 block text-[11px] font-normal text-gray-400">One item per line.</span>
  </label>
);

const mapTechnicalGroupLabelsToObjects = (labels = []) => labels.map((label) => ({ label })).filter((item) => item.label);

const EditableJDReviewPanel = ({ rubric, onRubricChange }) => {
  const sections = rubric?.sections || {};
  const overview = rubric?.jobOverview || {};
  const technicalSkills = sections.technicalSkills || {};

  const patchRubric = (patcher) => {
    onRubricChange(patcher(rubric || {}));
  };

  const updateOverview = (field, value) => {
    patchRubric((current) => ({
      ...current,
      title: field === 'title' ? value : current.title,
      jobOverview: { ...(current.jobOverview || {}), [field]: value },
    }));
  };

  const updateSection = (field, value) => {
    patchRubric((current) => ({
      ...current,
      ...(field === 'responsibilities' ? { roleSummary: value } : {}),
      ...(field === 'mustHaveRequirements' ? { mustHaveRequirements: value } : {}),
      ...(field === 'niceToHaveRequirements' ? { niceToHaveExperience: value } : {}),
      ...(field === 'qualifications' ? { qualifications: value } : {}),
      ...(field === 'softSkills' ? { softSkillRequirements: value } : {}),
      sections: { ...(current.sections || {}), [field]: value },
      normalized: { ...(current.normalized || {}), [field]: value },
    }));
  };

  const updateTechnicalGroup = (groupKey, labels) => {
    const nextItems = mapTechnicalGroupLabelsToObjects(labels);
    patchRubric((current) => ({
      ...current,
      sections: {
        ...(current.sections || {}),
        technicalSkills: { ...((current.sections || {}).technicalSkills || {}), [groupKey]: nextItems },
      },
      normalized: {
        ...(current.normalized || {}),
        technicalSkills: { ...((current.normalized || {}).technicalSkills || {}), [groupKey]: nextItems },
      },
    }));
  };

  const technicalGroupEntries = Object.entries(technicalSkills).length
    ? Object.entries(technicalSkills)
    : [['softwareDevelopment', []], ['data', []], ['aiMl', []], ['itInfrastructure', []]];

  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-[#eef8f4] p-2 text-[#1f7d59]"><PencilLine className="h-4 w-4" /></div>
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Review and edit parsed JD</h4>
          <p className="mt-1 text-xs leading-5 text-gray-500">Edit the AI parsed fields below. The match uses this structured version, not only the raw pasted JD.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <EditableTextField label="Role title" value={overview.title || rubric?.title || ''} onChange={(value) => updateOverview('title', value)} />
        <EditableTextField label="Company" value={overview.companyName || ''} onChange={(value) => updateOverview('companyName', value)} />
        <EditableTextField label="Location" value={overview.location || ''} onChange={(value) => updateOverview('location', value)} />
        <EditableTextField label="Employment type" value={overview.employmentType || ''} onChange={(value) => updateOverview('employmentType', value)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <EditableListField label="Responsibilities" value={sections.responsibilities} onChange={(value) => updateSection('responsibilities', value)} />
        <EditableListField label="Must-have requirements" value={sections.mustHaveRequirements} onChange={(value) => updateSection('mustHaveRequirements', value)} />
        <EditableListField label="Nice-to-have requirements" value={sections.niceToHaveRequirements} onChange={(value) => updateSection('niceToHaveRequirements', value)} />
        <EditableListField label="Qualifications" value={sections.qualifications} onChange={(value) => updateSection('qualifications', value)} />
        <EditableListField label="Soft skills" value={sections.softSkills} onChange={(value) => updateSection('softSkills', value)} />
        <EditableListField label="Benefits" value={sections.benefits} onChange={(value) => updateSection('benefits', value)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {technicalGroupEntries.map(([groupKey, items]) => (
          <EditableListField
            key={groupKey}
            label={`Technical skills - ${groupKey}`}
            value={normalizeList(items)}
            onChange={(value) => updateTechnicalGroup(groupKey, value)}
          />
        ))}
      </div>

      <div className="mt-4">
        <EditableListField label="Application notes" value={sections.applicationInstructions} onChange={(value) => updateSection('applicationInstructions', value)} />
      </div>
    </div>
  );
};

const AnalysisStatusBlock = ({
  analysisMode,
  confidence,
  warnings,
  missingSections,
  confidenceThreshold,
  isJdHumanVerified,
  requiresJdHumanReview,
  isJdEdited,
  onConfirmJDSummary,
}) => {
  const confidencePercent = Math.round((confidence || 0) * 100);
  const thresholdPercent = Math.round(confidenceThreshold * 100);
  const statusTone = requiresJdHumanReview ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-white';

  return (
    <div className={`rounded-xl border p-4 ${statusTone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Analysis Status</p>
          <p className="mt-2 text-sm font-semibold text-gray-900">{analysisMode}</p>
          <p className="mt-1 text-xs text-gray-500">AI confidence {confidencePercent}% · Gate {thresholdPercent}%</p>
        </div>
        {requiresJdHumanReview || warnings?.length ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
      </div>

      {requiresJdHumanReview ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 p-3">
          <p className="text-sm font-semibold text-amber-900">{isJdEdited ? 'Review your edited JD before matching' : 'Human review required before matching'}</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">Check and edit the parsed JD fields. When they look correct, mark the JD as reviewed to unlock CV-JD matching.</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onConfirmJDSummary}>Mark JD as reviewed</Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-emerald-700">{isJdHumanVerified ? 'Human reviewed JD summary is ready for CV-JD matching.' : 'High-confidence JD summary is ready for CV-JD matching.'}</p>
      )}

      {warnings?.length ? (
        <ul className="mt-3 space-y-2 text-xs text-amber-700">{warnings.map((warning, index) => <li key={`warning-${index}`}>• {warning}</li>)}</ul>
      ) : null}
      {missingSections?.length ? <p className="mt-3 text-xs text-gray-500">Missing sections: {missingSections.join(', ')}</p> : null}
    </div>
  );
};

export function JobContextCard({
  rawJD,
  setRawJD,
  structuredJD,
  structuredJDRubric,
  onStructuredJDRubricChange,
  onSummarize,
  isSummarizing,
  jdConfidenceThreshold = 0.9,
  isJdHumanVerified = false,
  requiresJdHumanReview = false,
  isJdEdited = false,
  onConfirmJDSummary,
}) {
  const viewModel = structuredJDRubric ? buildJobDescriptionViewModel(structuredJDRubric) : null;

  return (
    <Card>
      <CardHeader className="items-start">
        <div>
          <CardTitle>Job Context</CardTitle>
          <p className="mt-1 text-sm text-gray-500">Paste the job description so AI can tailor interview questions and coaching tips.</p>
        </div>
        <div className="shrink-0 text-xs text-gray-400">NZ-focused analysis</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Paste Job Description (JD)</h4>
          <TextArea rows={structuredJD ? 6 : 12} placeholder="Copy the job requirements from SEEK or LinkedIn here..." value={rawJD} onChange={(e) => setRawJD(e.target.value)} maxLength={6000} />
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-xs text-gray-500">Tip: include responsibilities, tech stack, and must-have skills.</p>
            <p className="shrink-0 text-xs text-gray-400">{rawJD.length}/6000</p>
          </div>
        </div>

        <Button variant="secondary" onClick={onSummarize} disabled={!rawJD.trim() || isSummarizing} className="flex w-full items-center justify-center gap-2">
          {isSummarizing ? <><Loader2 className="h-4 w-4 animate-spin" /> Summarising...</> : <><FileText className="h-4 w-4" /> Summarise JD</>}
        </Button>

        {structuredJD && structuredJDRubric && viewModel && (
          <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">JD Summary</h4>
              <p className="mt-1 text-xs text-gray-500">Review this structured JD before matching. Edits here directly change the rubric used by CV-JD matching.</p>
            </div>

            <AnalysisStatusBlock
              analysisMode={viewModel.analysisMode}
              confidence={viewModel.confidence}
              warnings={viewModel.warnings}
              missingSections={viewModel.missingSections}
              confidenceThreshold={jdConfidenceThreshold}
              isJdHumanVerified={isJdHumanVerified}
              requiresJdHumanReview={requiresJdHumanReview}
              isJdEdited={isJdEdited}
              onConfirmJDSummary={onConfirmJDSummary}
            />

            <EditableJDReviewPanel rubric={structuredJDRubric} onRubricChange={onStructuredJDRubricChange} />

            <details className="rounded-xl border border-gray-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Preview current parsed JD</summary>
              <div className="space-y-3 border-t border-gray-100 p-3">
                <SummarySection title="Job Overview" items={[viewModel.title, ...viewModel.overviewItems]} emptyText="No overview details detected." />
                <SummarySection title="Core Requirements" items={viewModel.coreRequirements} emptyText="Core requirements could not be confidently extracted." />
                <TechnicalGroups groups={viewModel.technicalGroups} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <SummarySection title="What This Role Does" items={viewModel.responsibilities} emptyText="Responsibilities could not be confidently extracted." />
                  <SummarySection title="Bonus Requirements" items={viewModel.bonusRequirements} emptyText="No clear bonus requirements were detected." />
                  <SummarySection title="Qualifications" items={viewModel.qualifications} emptyText="Qualifications could not be confidently extracted." />
                  <SummarySection title="Soft Skills" items={viewModel.softSkills} emptyText="No clear soft skills were detected." />
                  <SummarySection title="Benefits" items={viewModel.benefits} emptyText="No clear benefits section was detected." />
                </div>
                <SummarySection title="Application Notes" items={viewModel.applicationInstructions} emptyText="No clear application instructions were detected." />
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
