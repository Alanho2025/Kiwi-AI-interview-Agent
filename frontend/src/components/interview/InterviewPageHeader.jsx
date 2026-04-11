/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: InterviewPageHeader should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { AppHeader } from '../layout/AppHeader.jsx';
import { formatDuration } from '../../utils/formatters.js';

export function InterviewPageHeader({ session, displayRole, compactRoleLabel, stageLabel, elapsedSeconds, onViewReport }) {
  const canViewReport = session?.status === 'completed' && Boolean(session?.hasReport);

  return (
    <AppHeader>
      <div className="flex items-center justify-end gap-6 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-500">Role</span>
          <span className="px-3 py-1 bg-[#e6f7f0] text-[#2eb886] text-sm font-medium rounded-full max-w-[220px] truncate">
            {compactRoleLabel}
          </span>
        </div>
        <div className="min-w-0 flex-1 max-w-[420px]">
          <div className="text-lg font-semibold text-gray-900 truncate">{displayRole} Interview</div>
          <div className="text-xs text-gray-500 mt-1 truncate">
            {(session?.analysisResult?.parsedJdProfile?.roleLevel || session?.settings?.seniorityLevel || 'mid')} • {stageLabel}
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Timer</p>
            <p className="text-lg font-mono font-medium text-gray-900">{formatDuration(elapsedSeconds)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Progress</p>
            <p className="text-sm font-medium text-gray-900">Question {session?.currentQuestionIndex} of {session?.totalQuestions}</p>
          </div>
          {canViewReport ? (
            <button className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={onViewReport}>
              View report
            </button>
          ) : null}
        </div>
      </div>
    </AppHeader>
  );
}
