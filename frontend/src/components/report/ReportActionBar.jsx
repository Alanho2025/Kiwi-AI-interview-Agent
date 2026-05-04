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
export function ReportActionBar({ loading, onGenerate, onRunQa, onExport }) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = (format) => {
    setShowExportMenu(false);
    if (onExport) {
      onExport(format);
    }
  };

  return (
    <div className="flex flex-wrap gap-3 relative">
      <Button onClick={onGenerate} disabled={loading}>{loading ? 'Working...' : 'Generate report'}</Button>
      <Button onClick={onRunQa} variant="secondary" disabled={loading}>Run QA</Button>
      
      {onExport && (
        <div className="relative">
          <Button 
            variant="secondary" 
            disabled={loading}
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2"
          >
            <Download size={16} />
            Export
            <ChevronDown size={16} />
          </Button>
          
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
