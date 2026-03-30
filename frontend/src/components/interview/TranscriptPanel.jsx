import { Card, CardContent } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { Bird } from 'lucide-react';
import { formatClockTime } from '../../utils/formatters.js';

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
