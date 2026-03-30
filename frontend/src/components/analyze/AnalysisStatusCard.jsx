import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Loader2, CheckCircle2 } from 'lucide-react';

const CircularScore = ({ value, label, score, weight, detail }) => {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const angle = safeValue * 3.6;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <div
          className="relative h-20 w-20 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(#2eb886 ${angle}deg, #e5e7eb ${angle}deg 360deg)`,
          }}
        >
          <div className="absolute inset-[8px] flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-lg font-bold text-gray-900">{safeValue}</span>
            <span className="text-[10px] uppercase tracking-wide text-gray-400">%</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">Contribution</span>
        <span className="text-sm font-semibold text-[#2eb886]">{score} / {weight}</span>
      </div>
    </div>
  );
};

const formatCoverageDetail = (matchedCount, totalCount, fallback) => {
  if (!totalCount) {
    return fallback;
  }

  return `${matchedCount} / ${totalCount} matched`;
};

export function AnalysisStatusCard({ status, matchRate, analysisResult }) {
  // status: 'idle', 'summarizing', 'matching', 'success', 'error'
  const details = analysisResult?.matchingDetails;
  const weightedBreakdown = details?.weightedBreakdown;
  
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Analysis Status</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Track JD summary progress and review how the uploaded CV matches the current job description.</p>
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
            <p className="text-xs text-gray-400 text-center mt-4">The backend is comparing the parsed CV text against the raw JD and its structured rubric.</p>
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
                <p className="text-xs text-gray-500">Your JD summary and CV match results are ready to review.</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-full rounded-full"></div>
            </div>
            {matchRate !== undefined && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Overall Match Score</p>
                      <p className="mt-1 text-xs text-gray-500">Calculated from parsed CV text and the structured rubric extracted from the raw JD.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-[#2eb886]">{matchRate}<span className="text-lg text-gray-400">/100</span></p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-gray-200 pt-3">
                    <p className="text-xs text-gray-500">
                      This is a rule-based score. It is not a free-form AI estimate. Each quadrant below shows how the total was calculated from the same JD rubric used in the summary.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <CircularScore
                    label="Soft Skill Requirement"
                    value={(weightedBreakdown?.softSkills?.rawRatio || 0) * 100}
                    score={weightedBreakdown?.softSkills?.score || 0}
                    weight={weightedBreakdown?.softSkills?.weight || 45}
                    detail={formatCoverageDetail(
                      weightedBreakdown?.softSkills?.matchedCount || 0,
                      weightedBreakdown?.softSkills?.totalCount || 0,
                      'No clear soft-skill requirements detected'
                    )}
                  />
                  <CircularScore
                    label="Technical Skill Requirement"
                    value={(weightedBreakdown?.technicalSkills?.rawRatio || 0) * 100}
                    score={weightedBreakdown?.technicalSkills?.score || 0}
                    weight={weightedBreakdown?.technicalSkills?.weight || 35}
                    detail={formatCoverageDetail(
                      weightedBreakdown?.technicalSkills?.matchedCount || 0,
                      weightedBreakdown?.technicalSkills?.totalCount || 0,
                      'No clear technical requirements detected'
                    )}
                  />
                  <CircularScore
                    label="Qualification Match"
                    value={(weightedBreakdown?.qualificationMatch?.rawRatio || 0) * 100}
                    score={weightedBreakdown?.qualificationMatch?.score || 0}
                    weight={weightedBreakdown?.qualificationMatch?.weight || 15}
                    detail={formatCoverageDetail(
                      weightedBreakdown?.qualificationMatch?.matchedCount || 0,
                      weightedBreakdown?.qualificationMatch?.totalCount || 0,
                      'No explicit qualification requirements detected'
                    )}
                  />
                  <CircularScore
                    label="Roles Match"
                    value={(weightedBreakdown?.rolesMatch?.rawRatio || 0) * 100}
                    score={weightedBreakdown?.rolesMatch?.score || 0}
                    weight={weightedBreakdown?.rolesMatch?.weight || 5}
                    detail={
                      formatCoverageDetail(
                        weightedBreakdown?.rolesMatch?.matchedCount || 0,
                        weightedBreakdown?.rolesMatch?.totalCount || 0,
                        'No clear role scope detected'
                      )
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
