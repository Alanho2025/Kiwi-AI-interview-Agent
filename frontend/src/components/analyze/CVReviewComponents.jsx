import { PencilLine } from 'lucide-react';

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

export const EditableCvTextArea = ({ label, value, onChange, rows = 4 }) => (
  <label className="block text-xs font-semibold text-muted">
    {label}
    <textarea
      className={`${fieldClass} min-h-[92px] resize-y leading-5`}
      value={value || ''}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

export const EditableCvListField = ({ label, value = [], onChange }) => (
  <label className="block text-xs font-semibold text-muted">
    {label}
    <textarea
      className={`${fieldClass} min-h-[92px] resize-y leading-5`}
      value={joinListText(value)}
      onChange={(event) => onChange(splitListText(event.target.value))}
    />
    <span className="mt-1 block text-[11px] font-normal text-gray-400">One item per line.</span>
  </label>
);

export const EditableCVReviewPanel = ({ reviewProfile = {}, onReviewProfileChange }) => {
  const updateField = (field, value) => {
    onReviewProfileChange?.({ ...reviewProfile, [field]: value });
  };

  return (
    <div className="mt-4 rounded-xl border border-emerald-100 glass p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-chip p-2 text-accent"><PencilLine className="h-4 w-4" /></div>
        <div>
          <h4 className="text-sm font-semibold text-primary">Review and edit parsed CV</h4>
          <p className="mt-1 text-xs leading-5 text-faint">Edit the parsed CV fields below. The match uses this reviewed profile.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <EditableCvTextArea label="Candidate summary" value={reviewProfile.candidateSummary} rows={4} onChange={(value) => updateField('candidateSummary', value)} />
        <EditableCvListField label="Core skills" value={reviewProfile.coreSkills} onChange={(value) => updateField('coreSkills', value)} />
        <EditableCvTextArea label="Experience evidence" value={reviewProfile.experienceEvidence} rows={5} onChange={(value) => updateField('experienceEvidence', value)} />
        <EditableCvTextArea label="Project evidence" value={reviewProfile.projectEvidence} rows={5} onChange={(value) => updateField('projectEvidence', value)} />
        <EditableCvTextArea label="Education and credentials" value={reviewProfile.educationCredentials} rows={4} onChange={(value) => updateField('educationCredentials', value)} />
        <EditableCvListField label="Key competencies" value={reviewProfile.keyCompetencies} onChange={(value) => updateField('keyCompetencies', value)} />
      </div>
    </div>
  );
};

export const ChipList = ({ items = [] }) => {
  if (!items.length) return <p className="text-sm text-faint">No clear signals detected yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-lg bg-chip px-3 py-1.5 text-xs font-medium text-accent">{item}</span>
      ))}
    </div>
  );
};

export const EvidenceList = ({ items = [], emptyText }) => {
  if (!items.length) return <p className="text-sm text-faint">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {items.slice(0, 4).map((item, index) => (
        <div key={`${item.label || item.requirement || 'evidence'}-${index}`} className="rounded-lg border border-gray-100 bg-transparent p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">{item.label || item.requirement || 'Evidence'}</p>
          <p className="mt-1 text-sm leading-5 text-primary">{item.text || item.evidence}</p>
        </div>
      ))}
    </div>
  );
};

export const CVAnalysisSummary = ({ analysis = {}, coreSkills = [] }) => (
  <div className="mt-4 space-y-4 rounded-xl border border-emerald-100 glass p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="rounded-full bg-chip p-2 text-accent"><PencilLine className="h-4 w-4" /></div>
      <div>
        <h4 className="text-sm font-semibold text-primary">CV analysis for matching</h4>
        <p className="mt-1 text-xs leading-5 text-faint">Review the candidate story, evidence, and interview hooks before matching.</p>
      </div>
    </div>

    <div className="rounded-lg border border-gray-100 bg-transparent p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">Candidate intro angle</p>
      <p className="mt-2 text-sm leading-6 text-primary">{analysis.candidateIntro || 'No candidate intro angle detected yet.'}</p>
      {analysis.careerDirection ? <p className="mt-2 text-xs font-medium text-emerald-700">{analysis.careerDirection}</p> : null}
    </div>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-gray-100 glass p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-faint">Core skills</p>
        <ChipList items={coreSkills} />
      </div>
      <div className="rounded-lg border border-gray-100 glass p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-faint">Interview hooks</p>
        <ChipList items={analysis.suggestedInterviewHooks || []} />
      </div>
    </div>

    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-faint">Strongest evidence</p>
      <EvidenceList items={analysis.strongestEvidence || []} emptyText="No strong evidence extracted yet." />
    </div>

    {(analysis.weakOrMissingEvidence || []).length ? (
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Weak or missing evidence</p>
        <ul className="mt-2 space-y-1 text-sm text-amber-800">
          {analysis.weakOrMissingEvidence.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </div>
    ) : null}
  </div>
);
