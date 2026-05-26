/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: ReportActionBar should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Button } from '../common/Button.jsx';
import { Download, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Purpose: Execute the main responsibility for ReportActionBar.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function ReportActionBar({ loading, onGenerate, onRunQa, onExport, onDownloadRecording, recordingStatus }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [qaPrompt, setQaPrompt] = useState('');
  const exportMenuRef = useRef(null);
  const canDownloadRecording = Boolean(onDownloadRecording) && recordingStatus?.state === 'ready';

  useEffect(() => {
    if (!showExportMenu) return undefined;

    const closeMenu = (event) => {
      if (event.key === 'Escape') {
        setShowExportMenu(false);
      }
      if (event.type === 'mousedown' && exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('keydown', closeMenu);
    document.addEventListener('mousedown', closeMenu);

    return () => {
      document.removeEventListener('keydown', closeMenu);
      document.removeEventListener('mousedown', closeMenu);
    };
  }, [showExportMenu]);

  const handleExport = (format) => {
    setShowExportMenu(false);
    if (onExport) {
      onExport(format);
    }
  };

  const handleRunQa = () => {
    if (onRunQa) {
      onRunQa(qaPrompt);
    }
  };

  return (
    <div className="sticky top-16 z-40 -mx-4 border-b border-theme bg-transparent px-4 py-3 backdrop-blur sm:relative sm:top-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <div className={`flex gap-2 ${showExportMenu ? 'overflow-visible' : 'overflow-x-auto'} sm:flex-wrap`}>
        <Button className="shrink-0" onClick={onGenerate} disabled={loading}>{loading ? 'Working...' : 'Generate report'}</Button>
        <Button className="shrink-0" onClick={handleRunQa} variant="secondary" disabled={loading}>Run QA</Button>
        {onDownloadRecording ? (
          <Button
            onClick={onDownloadRecording}
            variant="secondary"
            disabled={loading || !canDownloadRecording}
            title={canDownloadRecording ? 'Download voice session MP3' : 'No MP3 recording is available yet'}
            className="shrink-0"
          >
            <Download size={16} />
            Download MP3
          </Button>
        ) : null}
        
        {onExport && (
          <div className="relative" ref={exportMenuRef}>
            <Button 
              variant="secondary" 
              disabled={loading}
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex shrink-0 items-center gap-2"
            >
              <Download size={16} />
              Export
              <ChevronDown size={16} />
            </Button>
            
            {showExportMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-theme glass shadow-lg">
                <div className="py-1">
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-2 text-left hover:bg-transparent flex items-center gap-2"
                  >
                    <span>PDF Document</span>
                    <span className="text-xs text-faint ml-auto">.pdf</span>
                  </button>
                  <button
                    onClick={() => handleExport('txt')}
                    className="w-full px-4 py-2 text-left hover:bg-transparent flex items-center gap-2"
                  >
                    <span>Text Report</span>
                    <span className="text-xs text-faint ml-auto">.txt</span>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left hover:bg-transparent flex items-center gap-2"
                  >
                    <span>JSON Format</span>
                    <span className="text-xs text-faint ml-auto">.json</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-theme bg-white/60 p-3 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-faint" htmlFor="qa-rewrite-prompt">
          Optional QA rewrite prompt
        </label>
        <textarea
          id="qa-rewrite-prompt"
          value={qaPrompt}
          onChange={(event) => setQaPrompt(event.target.value)}
          disabled={loading}
          rows={2}
          maxLength={2000}
          className="mt-2 w-full resize-y rounded-xl border border-theme bg-white/80 px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
          placeholder="Example: Make the report more concise and student-facing. Keep all evidence labels and do not invent new feedback."
        />
        <p className="mt-1 text-xs text-muted">
          Leave this empty to only refresh QA checks. Add a prompt to safely rewrite the report and run QA again.
        </p>
      </div>
    </div>
  );
}
