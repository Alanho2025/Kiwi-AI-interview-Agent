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
const fieldClass = 'mt-2 w-full rounded-xl border border-theme glass px-3 py-2 text-sm text-primary outline-none transition focus:[border-color:var(--accent)] focus:ring-2 focus:ring-1 focus:ring-accent/15';

const SummarySection = ({ title, items = [], emptyText = 'No clear items detected in this section.' }) => (
  <div className="rounded-lg border border-gray-100 glass p-4">
    <h5 className="text-sm font-semibold text-primary">{title}</h5>
    {items.length > 0 ? (
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full [background:var(--accent)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-3 text-sm text-faint">{emptyText}</p>
    )}
  </div>
);

const TechnicalSkillGroup = ({ title, items }) => (
  <div className="rounded-lg border border-gray-100 glass p-4">
    <h5 className="text-sm font-semibold text-primary">{title}</h5>
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={`${title}-${item}`} className="rounded-lg bg-chip px-3 py-1.5 text-xs font-medium text-accent">
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

const EditableTextField = ({ label, value, onChange, placeholder = '', required = false }) => (
  <label className="block text-xs font-semibold text-muted">
    {label} {required && <span className="text-red-500">*</span>}
    <input className={fieldClass} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const EditableListField = ({ label, value = [], onChange, placeholder = '', required = false }) => (
  <label className="block text-xs font-semibold text-muted">
    {label} {required && <span className="text-red-500">*</span>}
    <textarea
      className={`${fieldClass} min-h-[92px] resize-y leading-5`}
      value={joinListText(value)}
      placeholder={placeholder}
      onChange={(event) => onChange(splitListText(event.target.value))}
    />
    <span className="mt-1 block text-[11px] font-normal text-gray-400">One item per line.</span>
  </label>
);

const EditableLongTextField = ({ label, value = '', onChange, placeholder = '', required = false }) => (
  <label className="block text-xs font-semibold text-muted">
    {label} {required && <span className="text-red-500">*</span>}
    <textarea
      className={`${fieldClass} min-h-[92px] resize-y leading-5`}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const mapTechnicalGroupLabelsToObjects = (labels = []) => labels.map((label) => ({ label })).filter((item) => item.label);

const EditableJDReviewPanel = ({ rubric, onRubricChange }) => {
  const sections = rubric?.sections || {};
  const overview = rubric?.jobOverview || {};
  const technicalSkills = sections.technicalSkills || {};
  const roleFit = rubric?.roleFit || {};

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

  const updateCompanyUnderstanding = (summary) => {
    patchRubric((current) => ({
      ...current,
      roleFit: {
        ...(current.roleFit || {}),
        companyUnderstanding: {
          ...(current.roleFit?.companyUnderstanding || {}),
          summary,
        },
      },
    }));
  };

  const updateRoleIntent = (statements) => {
    patchRubric((current) => {
      const existingItems = current.roleFit?.roleIntent?.items || [];
      const items = statements.map((statement, index) => {
        const existing = existingItems.find((item) => item.statement === statement) || existingItems[index];
        return existing?.statement === statement
          ? existing
          : {
              id: `intent:user-edit:${index + 1}`,
              statement,
              priority: existing?.priority || 'medium',
              category: existing?.category || 'human_reviewed_intent',
              sourceLabel: 'Human-reviewed role intent',
              confidence: 1,
              uncertainty: 'User-edited during JD review.',
              sourceTrace: { sourceType: 'human_review', section: 'roleIntent', rawSnippet: statement },
            };
      });
      return {
        ...current,
        roleFit: {
          ...(current.roleFit || {}),
          roleIntent: { ...(current.roleFit?.roleIntent || {}), items },
        },
      };
    });
  };

  const technicalGroupEntries = Object.entries(technicalSkills).length
    ? Object.entries(technicalSkills)
    : [['softwareDevelopment', []], ['data', []], ['aiMl', []], ['itInfrastructure', []]];

  return (
    <div className="rounded-xl border border-emerald-100 glass p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-chip p-2 text-accent"><PencilLine className="h-4 w-4" /></div>
        <div>
          <h4 className="text-sm font-semibold text-primary">Review and edit parsed JD</h4>
          <p className="mt-1 text-xs leading-5 text-faint">Edit the AI parsed fields below. The match uses this structured version, not only the raw pasted JD.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <EditableTextField label="Role title" required={true} value={overview.title || rubric?.title || ''} onChange={(value) => updateOverview('title', value)} />
        <EditableTextField label="Company" required={true} value={overview.companyName || ''} onChange={(value) => updateOverview('companyName', value)} />
        <EditableTextField label="Location" value={overview.location || ''} onChange={(value) => updateOverview('location', value)} />
        <EditableTextField label="Employment type" value={overview.employmentType || ''} onChange={(value) => updateOverview('employmentType', value)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <EditableListField label="Responsibilities" required={true} value={sections.responsibilities} onChange={(value) => updateSection('responsibilities', value)} />
        <EditableListField label="Must-have requirements" required={true} value={sections.mustHaveRequirements} onChange={(value) => updateSection('mustHaveRequirements', value)} />
        <EditableListField label="Nice-to-have requirements" value={sections.niceToHaveRequirements} onChange={(value) => updateSection('niceToHaveRequirements', value)} />
        <EditableListField label="Qualifications" value={sections.qualifications} onChange={(value) => updateSection('qualifications', value)} />
        <EditableListField label="Soft skills" value={sections.softSkills} onChange={(value) => updateSection('softSkills', value)} />
        <EditableListField label="Benefits" value={sections.benefits} onChange={(value) => updateSection('benefits', value)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <EditableLongTextField
          label="Company understanding"
          required={true}
          value={roleFit.companyUnderstanding?.summary || ''}
          onChange={updateCompanyUnderstanding}
          placeholder="Review the company context used for matching."
        />
        <EditableListField
          label="Role intent priorities"
          required={true}
          value={(roleFit.roleIntent?.items || []).map((item) => item.statement)}
          onChange={updateRoleIntent}
          placeholder="One role intent per line."
        />
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
  const statusTone = requiresJdHumanReview ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 glass';

  return (
    <div className={`rounded-xl border p-4 ${statusTone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Analysis Status</p>
          <p className="mt-2 text-sm font-semibold text-primary">{analysisMode}</p>
          <p className="mt-1 text-xs text-faint">AI confidence {confidencePercent}% · Gate {thresholdPercent}%</p>
        </div>
        {requiresJdHumanReview || warnings?.length ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
      </div>

      {requiresJdHumanReview ? (
        <div className="mt-3 rounded-xl border border-amber-200 glass/80 p-3">
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
      {missingSections?.length ? <p className="mt-3 text-xs text-faint">Missing sections: {missingSections.join(', ')}</p> : null}
    </div>
  );
};

export function JobContextCard({
  rawJD,
  setRawJD,
  companyWebsiteUrl = '',
  setCompanyWebsiteUrl,
  userCompanyContext = '',
  setUserCompanyContext,
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
  savedJDs = [],
  isLoadingSavedJDs = false,
  onSelectSavedJD,
}) {
  const viewModel = structuredJDRubric ? buildJobDescriptionViewModel(structuredJDRubric) : null;

  return (
    <Card>
      <CardHeader className="items-start">
        <div>
          <CardTitle>Job Context</CardTitle>
          <p className="mt-1 text-sm text-faint">Paste the job description or its URL so AI can tailor interview questions and coaching tips.</p>
        </div>
        <div className="shrink-0 text-xs text-gray-400">NZ-focused analysis</div>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedJDs.length > 0 && (
          <div className="rounded-xl border border-gray-150 glass/50 p-4 mb-2">
            <h4 className="text-sm font-medium text-primary mb-2 flex items-center justify-between">
              <span>Choose from Saved Job Descriptions</span>
              {isLoadingSavedJDs && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
            </h4>
            <select
              className="w-full rounded-xl border border-theme glass px-3 py-2 text-sm text-primary outline-none transition focus:[border-color:var(--accent)]"
              onChange={(e) => {
                if (e.target.value) {
                  onSelectSavedJD(e.target.value);
                  e.target.value = ''; // Reset selection
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>-- Select a saved JD --</option>
              {savedJDs.map((jd) => (
                <option key={jd.jdFingerprint} value={jd.jdFingerprint}>
                  {jd.companyName ? `[${jd.companyName}] ` : ''}{jd.title} ({new Date(jd.updatedAt).toLocaleDateString()})
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-faint">Loading a saved JD pulls its validated analysis directly, allowing you to skip parsing and review.</p>
          </div>
        )}

        <div>
          <h4 className="mb-3 text-sm font-medium text-primary">Paste Job Description (JD) or URL</h4>
          <TextArea rows={structuredJD ? 6 : 12} placeholder="Paste the job listing URL (e.g. https://www.seek.co.nz/job/...) or copy-paste job requirements here..." value={rawJD} onChange={(e) => setRawJD(e.target.value)} maxLength={6000} />
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-xs text-faint">Tip: include responsibilities, tech stack, or paste a link to fetch automatically.</p>
            <p className="shrink-0 text-xs text-gray-400">{rawJD.length}/6000</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <EditableTextField
            label="Company website URL"
            value={companyWebsiteUrl}
            onChange={setCompanyWebsiteUrl}
            placeholder="https://company.example"
          />
          <EditableLongTextField
            label="Manual company context"
            value={userCompanyContext}
            onChange={setUserCompanyContext}
            placeholder="Add a short company summary when no website is available."
          />
        </div>
        <p className="text-xs text-faint">Provide either a company website or manual company context.</p>

        <Button variant="secondary" onClick={onSummarize} disabled={!rawJD.trim() || (!companyWebsiteUrl.trim() && !userCompanyContext.trim()) || isSummarizing} className="flex w-full items-center justify-center gap-2">
          {isSummarizing ? <><Loader2 className="h-4 w-4 animate-spin" /> Summarising...</> : <><FileText className="h-4 w-4" /> Summarise JD</>}
        </Button>

        {structuredJD && structuredJDRubric && viewModel && (
          <div className="mt-4 space-y-4 rounded-xl border border-theme bg-transparent p-3 sm:p-4">
            <div>
              <h4 className="text-sm font-medium text-primary">JD Summary</h4>
              <p className="mt-1 text-xs text-faint">Review this structured JD before matching. Edits here directly change the rubric used by CV-JD matching.</p>
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

            <details className="rounded-xl border border-theme glass">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">Preview current parsed JD</summary>
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
