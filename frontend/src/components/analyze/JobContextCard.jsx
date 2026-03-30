import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { TextArea } from '../common/TextArea.jsx';
import { Button } from '../common/Button.jsx';
import { Loader2, UploadCloud } from 'lucide-react';

export function JobContextCard({ rawJD, setRawJD, structuredJD, onSummarize, isSummarizing }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Job Context</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Paste the job description so AI can tailor interview questions and coaching tips.</p>
        </div>
        <div className="text-xs text-gray-400">NZ-focused analysis</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Paste Job Description (JD)</h4>
          <TextArea 
            rows={structuredJD ? 6 : 12} 
            placeholder="Copy the job requirements from SEEK or LinkedIn here..."
            value={rawJD}
            onChange={(e) => setRawJD(e.target.value)}
            maxLength={6000}
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500">Tip: include responsibilities, tech stack, and must-have skills.</p>
            <p className="text-xs text-gray-400">{rawJD.length}/6000</p>
          </div>
        </div>

        <Button 
          variant="secondary" 
          onClick={onSummarize} 
          disabled={!rawJD.trim() || isSummarizing}
          className="w-full flex items-center justify-center gap-2"
        >
          {isSummarizing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Summarizing...</>
          ) : (
            <><UploadCloud className="w-4 h-4" /> Upload & Summarize JD</>
          )}
        </Button>

        {structuredJD && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="text-sm font-medium text-gray-900 mb-2">JD Summary</h4>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {structuredJD}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
