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
import { FileText, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../utils/formatters.js';
import { StatusBanner } from '../common/StatusBanner.jsx';

const getCvParseConfidence = (selectedCV) => {
  const confidence = Number(selectedCV?.parseConfidence ?? selectedCV?.profile?.confidence ?? selectedCV?.display?.parseConfidence ?? 0);
  return Number.isFinite(confidence) ? confidence : 0;
};

const buildCvParseLabel = (confidence) => {
  if (confidence >= 0.9) return 'High parse confidence';
  if (confidence >= 0.7) return 'Usable parse confidence';
  return 'Review recommended';
};

/**
 * Purpose: Execute the main responsibility for CVManagementCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function CVManagementCard({ onUpload, selectedCV, recentCVs, onSelectRecent, validationMessage }) {
  const [selectedRecent, setSelectedRecent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [localValidationMessage, setLocalValidationMessage] = useState('');
  const fileInputRef = useRef(null);
  const activeCvConfidence = getCvParseConfidence(selectedCV);
  const activeCvWarnings = selectedCV?.parseWarnings || selectedCV?.warnings || [];

  const processUpload = async (file) => {
    setIsUploading(true);
    setUploadSuccess(false);
    setLocalValidationMessage('');
    setSelectedRecent(null); // Clear selected recent when uploading new
    const success = await onUpload(file);
    setIsUploading(false);
    if (success) {
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processUpload(e.target.files[0]);
      e.target.value = null; // Reset input
    }
  };

  const requestPermissionAndOpenPicker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalValidationMessage('');
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx') {
        setLocalValidationMessage('Only PDF and DOCX files are supported right now.');
        return;
      }
      processUpload(file);
    }
  };

  return (
    <Card>
      <CardHeader className="items-start">
        <div>
          <CardTitle>CV Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Provide a resume to let the AI match your background with the role.</p>
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
            <h4 className="text-sm font-medium text-gray-900">Upload your CV</h4>
            {isUploading && <span className="text-xs text-[#2eb886] flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Uploading...</span>}
            {uploadSuccess && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Upload successful!</span>}
          </div>
          <div 
            className={cn(
              "border-2 border-dashed rounded-xl p-4 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between cursor-pointer transition-colors",
              isDragging ? "border-[#2eb886] bg-[#e6f7f0]" : "border-gray-200 hover:bg-gray-50"
            )}
            onClick={requestPermissionAndOpenPicker}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-4 pointer-events-none">
              <div className="w-12 h-12 shrink-0 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Drop files here or click to upload</p>
                <p className="text-xs text-gray-500 mt-1">PDF, DOCX · Max 5MB</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              type="button" 
              onClick={requestPermissionAndOpenPicker}
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
                <p className="mt-1 break-words text-sm font-semibold text-gray-900">{selectedCV.name}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {buildCvParseLabel(activeCvConfidence)} · {Math.round(activeCvConfidence * 100)}%
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
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
          </div>
        ) : null}

        {recentCVs && recentCVs.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Recent CVs</h4>
            <div className="space-y-3">
              {recentCVs.map((cv) => (
                <div key={cv.id} className="flex flex-col gap-3 p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-gray-100 rounded flex items-center justify-center text-gray-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-gray-900 sm:truncate">{cv.name}</p>
                      <p className="text-xs text-gray-500">Updated: {cv.updated} · {cv.size}</p>
                    </div>
                  </div>
                  <Button 
                    variant={selectedRecent === cv.id ? 'primary' : 'ghost'} 
                    size="sm" 
                    onClick={() => {
                      setSelectedRecent(cv.id);
                      onSelectRecent(cv.id);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Use
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
