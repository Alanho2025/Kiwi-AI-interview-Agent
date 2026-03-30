import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Loader2, CheckCircle2, Percent } from 'lucide-react';

export function AnalysisStatusCard({ status, matchRate }) {
  // status: 'idle', 'summarizing', 'matching', 'success', 'error'
  
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Analysis Status</CardTitle>
          <p className="text-sm text-gray-500 mt-1">AI is preparing a tailored interview plan based on your CV and the job description.</p>
        </div>
      </CardHeader>
      <CardContent>
        {status === 'idle' && (
          <div className="text-sm text-gray-500 text-center py-6">
            Upload a CV and paste a Job Description to begin analysis.
          </div>
        )}
        
        {status === 'summarizing' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#e6f7f0] flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[#2eb886] animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">AI is summarizing the Job Description...</p>
                <p className="text-xs text-gray-500">Extracting key requirements and skills.</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#2eb886] w-1/3 animate-pulse rounded-full"></div>
            </div>
          </div>
        )}

        {status === 'matching' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#e6f7f0] flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[#2eb886] animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">AI is analyzing requirements and matching your background...</p>
                <p className="text-xs text-gray-500">Estimated time: 10-20s</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#2eb886] w-2/3 animate-pulse rounded-full"></div>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">Analysis runs locally and stores encrypted snippets for session review.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Analysis complete!</p>
                <p className="text-xs text-gray-500">Your interview plan is ready.</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-full rounded-full"></div>
            </div>
            {matchRate !== undefined && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700">
                  <Percent className="w-4 h-4 text-[#2eb886]" />
                  <span className="text-sm font-medium">CV to JD Match Rate</span>
                </div>
                <span className="text-lg font-bold text-[#2eb886]">{matchRate}%</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
