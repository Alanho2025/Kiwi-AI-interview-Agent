/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: CVManagementCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { FileText, Lock, CheckCircle2, Loader2, PencilLine, Trash2 } from 'lucide-react';
import { cn } from '../../utils/formatters.js';
import { StatusBanner } from '../common/StatusBanner.jsx';
import { buildCvReviewViewModel } from '../../utils/cvReviewViewModel.js';

const getCvParseConfidence = (selectedCV) => {
  const confidence = Number(selectedCV?.parseConfidence ?? selectedCV?.profile?.confidence ?? selectedCV?.display?.parseConfidence ?? 0);
  return Number.isFinite(confidence) ? confidence : 0;
};

const buildCvParseLabel = (confidence) => {
  if (confidence >= 0.9) return 'High parse confidence';
  if (confidence >= 0.7) return 'Usable parse confidence';
  return 'Review recommended';
};

const countEvidenceStrength = (selectedCV) => {
  const evidenceItems = selectedCV?.profile?.evidenceProfile?.evidenceItems || [];
  return evidenceItems.reduce((summary, item) => {
    const key = item?.evidenceStrength || 'weak';
    return { ...summary, [key]: (summary[key] || 0) + 1 };
  }, { strong: 0, partial: 0, weak: 0 });
};

const getParserTools = (selectedCV) => {
  const metadata = selectedCV?.profile?.parserMetadata || {};
  const tools = metadata.openSourceTools || {};
  const activeTools = Object.entries(tools)
    .filter(([, value]) => value?.used)
    .map(([key]) => key);
  return {
    parser: metadata.parser || 'default parser',
    activeTools,
  };
};

import { EditableCVReviewPanel, CVAnalysisSummary } from './CVReviewComponents.jsx';
import { useCvUpload } from '../../hooks/useCvUpload.js';

/**
 * Purpose: Execute the main responsibility for CVManagementCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function CVManagementCard({
  onUpload,
  selectedCV,
  recentCVs,
  onSelectRecent,
  onDeleteRecent,
  deletingCvId = '',
  isCvHumanVerified = false,
  onConfirmCVReview,
  cvReviewProfile,
  onCvReviewProfileChange,
  isCvEdited = false,
  isCvReviewSaving = false,
  validationMessage,
}) {
  const [selectedRecent, setSelectedRecent] = useState(null);
  const fileInputRef = useRef(null);

  const {
    isDragging,
    isUploading,
    uploadSuccess,
    localValidationMessage,
    setLocalValidationMessage,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
  } = useCvUpload({
    onUpload: async (file) => {
      setSelectedRecent(null);
      return onUpload(file);
    },
  });

  const activeCvConfidence = getCvParseConfidence(selectedCV);
  const activeCvWarnings = selectedCV?.parseWarnings || selectedCV?.warnings || [];
  const cvReview = selectedCV ? buildCvReviewViewModel(selectedCV) : null;
  const activeReviewProfile = cvReviewProfile || cvReview?.reviewProfile || {};
  const evidenceStrength = countEvidenceStrength(selectedCV);
  const parserTools = getParserTools(selectedCV);

  const openFilePicker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalValidationMessage('');
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader className="items-start">
        <div>
          <CardTitle>CV Management</CardTitle>
          <p className="text-sm text-faint mt-1">Provide a resume to let the AI match your background with the role.</p>
        </div>
        <div className="flex shrink-0 items-center text-xs text-gray-400 gap-1">
          <Lock className="w-3 h-3" />
          <span className="hidden sm:inline">Document text is used for CV to JD matching</span>
          <span className="sm:hidden">Private</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {validationMessage || localValidationMessage ? (
          <StatusBanner variant="error" message={validationMessage || localValidationMessage} />
        ) : null}
        <div>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h4 className="text-sm font-medium text-primary">Upload your CV</h4>
            {isUploading && <span className="text-xs text-accent flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Uploading...</span>}
            {uploadSuccess && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Upload successful!</span>}
          </div>
          <div 
            className={cn(
              "flex cursor-pointer flex-col gap-4 rounded-xl border-2 border-dashed p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-6",
              isDragging ? "[border-color:var(--accent)] [background:var(--accent-glow)]" : "border-theme hover:bg-transparent"
            )}
            onClick={openFilePicker}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-4 pointer-events-none">
              <div className="w-12 h-12 shrink-0 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">Drop files here or click to upload</p>
                <p className="text-xs text-faint mt-1">PDF, DOCX · Max 5MB</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              type="button" 
              onClick={openFilePicker}
              className="w-full sm:w-auto"
            >
              Choose File
            </Button>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept=".pdf,.docx" 
              onChange={handleFileChange} 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {selectedCV ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Active CV</p>
                <p className="mt-1 break-words text-sm font-semibold text-primary">{selectedCV.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {buildCvParseLabel(activeCvConfidence)} · {Math.round(activeCvConfidence * 100)}%
                </p>
              </div>
              <CheckCircle2 className={cn('h-5 w-5 shrink-0', isCvHumanVerified ? 'text-emerald-600' : 'text-gray-300')} />
            </div>
            {activeCvWarnings.length ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-700">
                {activeCvWarnings.map((warning, index) => (
                  <li key={`cv-warning-${index}`}>• {warning}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-emerald-800">No CV parser warnings were raised.</p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 glass p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">Parser</p>
                <p className="mt-2 text-sm font-semibold text-primary">{parserTools.parser}</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {parserTools.activeTools.length ? `Open-source tools used: ${parserTools.activeTools.join(', ')}` : 'Open-source NLP tools are currently inactive or not needed for this file.'}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-100 glass p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">Evidence strength</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Strong {evidenceStrength.strong || 0}</span>
                  <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">Partial {evidenceStrength.partial || 0}</span>
                  <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Weak {evidenceStrength.weak || 0}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-100 glass p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">Review CV fields used for matching</p>
                  <p className="mt-1 text-xs leading-5 text-faint">Check only the parsed fields that affect CV-JD matching. Contact details are not shown here.</p>
                </div>
                {isCvHumanVerified ? (
                  <span className="shrink-0 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">Reviewed</span>
                ) : (
                  <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={onConfirmCVReview} disabled={isCvReviewSaving}>
                    {isCvReviewSaving ? <><Loader2 className="mr-2 inline h-3 w-3 animate-spin" /> Saving...</> : isCvEdited ? 'Mark edited CV as reviewed' : 'Mark CV as reviewed'}
                  </Button>
                )}
              </div>

              <CVAnalysisSummary analysis={cvReview?.cvAnalysis || {}} coreSkills={activeReviewProfile.coreSkills || []} />

              <details className="mt-4 rounded-xl border border-gray-100 glass">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">Edit parsed source fields</summary>
                <div className="border-t border-gray-100 p-4">
                  <EditableCVReviewPanel reviewProfile={activeReviewProfile} onReviewProfileChange={onCvReviewProfileChange} />
                </div>
              </details>

              {!cvReview?.fields?.some((field) => field.value) ? (
                <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                  KiwiCoach could not extract enough comparable CV fields. Review the uploaded file before matching.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {recentCVs && recentCVs.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-primary mb-3">Recent CVs</h4>
            <div className="space-y-3">
              {recentCVs.map((cv) => (
                <div key={cv.id} className="flex flex-col gap-3 p-3 border border-gray-100 rounded-lg hover:border-theme transition-colors sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-chip rounded flex items-center justify-center text-faint">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-primary sm:truncate">{cv.name}</p>
                      <p className="text-xs text-faint">Updated: {cv.updated} · {cv.size}</p>
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
                    <Button
                      variant={selectedRecent === cv.id ? 'primary' : 'outline'}
                      size="sm"
                      disabled={deletingCvId === cv.id}
                      onClick={() => {
                        setSelectedRecent(cv.id);
                        onSelectRecent(cv.id);
                      }}
                      className="flex-1 sm:flex-none"
                    >
                      Use this CV
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="shrink-0 gap-2 px-3"
                      title={`Delete ${cv.name}`}
                      aria-label={`Delete ${cv.name}`}
                      disabled={deletingCvId === cv.id}
                      onClick={async () => {
                        if (selectedRecent === cv.id) {
                          setSelectedRecent(null);
                        }
                        await onDeleteRecent?.(cv);
                      }}
                    >
                      {deletingCvId === cv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="sm:hidden">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
