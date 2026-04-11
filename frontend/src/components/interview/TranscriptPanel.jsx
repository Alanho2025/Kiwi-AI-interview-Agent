/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: TranscriptPanel should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Card, CardContent } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { Bird } from 'lucide-react';
import { formatClockTime } from '../../utils/formatters.js';

/**
 * Purpose: Execute the main responsibility for TranscriptPanel.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function TranscriptPanel({ transcript, onExport, candidateName = "Candidate" }) {
  const firstName = candidateName.split(' ')[0];
  const initials = candidateName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <Card className="h-full flex flex-col min-h-0">
      <div className="p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">Conversation History</h3>
        <span className="text-xs text-gray-400">Text Interview</span>
      </div>
      
      <CardContent className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">
        {transcript.map((msg, idx) => (
          <div key={idx} className="flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-[#e6f7f0] text-[#2eb886]' : 'bg-gray-100 text-gray-500'}`}>
              {msg.role === 'ai' ? <Bird className="w-4 h-4" /> : <span className="text-xs font-medium">{initials}</span>}
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">{msg.role === 'ai' ? 'KiwiCoach' : firstName}</span>
                <span className="text-xs text-gray-400">{formatClockTime(msg.timestamp)}</span>
              </div>
              <p className="text-sm text-gray-600">{msg.text}</p>
            </div>
          </div>
        ))}
      </CardContent>

      <div className="p-5 border-t border-gray-100 flex justify-end items-center bg-gray-50 shrink-0">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onExport}>Export</Button>
          <Button variant="secondary" size="sm">Flag</Button>
        </div>
      </div>
    </Card>
  );
}
