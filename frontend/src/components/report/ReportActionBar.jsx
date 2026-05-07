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
import { useState } from 'react';

/**
 * Purpose: Execute the main responsibility for ReportActionBar.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function ReportActionBar({ loading, onGenerate, onRunQa, onExport, onDownloadRecording, recordingStatus }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const canDownloadRecording = Boolean(onDownloadRecording) && recordingStatus?.state === 'ready';

  const handleExport = (format) => {
    setShowExportMenu(false);
    if (onExport) {
      onExport(format);
    }
  };

  return (
    <div className="sticky top-16 z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-gray-100 bg-gray-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-wrap sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <Button className="shrink-0" onClick={onGenerate} disabled={loading}>{loading ? 'Working...' : 'Generate report'}</Button>
      <Button className="shrink-0" onClick={onRunQa} variant="secondary" disabled={loading}>Run QA</Button>
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
        <div className="relative">
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
            <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="py-1">
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  <span>PDF Document</span>
                  <span className="text-xs text-gray-500 ml-auto">.pdf</span>
                </button>
                <button
                  onClick={() => handleExport('txt')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  <span>Text Report</span>
                  <span className="text-xs text-gray-500 ml-auto">.txt</span>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  <span>JSON Format</span>
                  <span className="text-xs text-gray-500 ml-auto">.json</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
