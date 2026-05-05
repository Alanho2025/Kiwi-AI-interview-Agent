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

const buildPrimaryTitle = ({ isVoiceMode, title }) => {
  if (isVoiceMode) return 'Mock Interview';
  return title;
};

export function InterviewPageHeader({ session, title, roleFamilyLabel, exactRoleTitle, modeLabel, levelLabel, stageLabel, elapsedSeconds, controlMode = 'question_limited', timeLimitSeconds = null, isVoiceMode = false, onViewReport }) {
  const isCompleted = session?.status === 'completed';
  const isNotStarted = session?.status === 'ready';
  const hasReport = Boolean(session?.hasReport);
  const showReportButton = isCompleted;
  const isTimeLimited = controlMode === 'time_limited' && Number(timeLimitSeconds) > 0;
  const timerLabel = isTimeLimited ? (isNotStarted ? 'Time limit' : 'Time left') : (isNotStarted ? 'Timer starts after start' : 'Timer');
  const timerValue = isTimeLimited ? formatDuration(Math.max(0, Number(timeLimitSeconds) - Number(elapsedSeconds || 0))) : formatDuration(elapsedSeconds);

  const buttonText = hasReport ? 'View Report' : 'Generate Report';
  const buttonClass = hasReport
    ? 'rounded-full bg-[#2eb886] text-white px-6 py-3 text-sm font-semibold hover:bg-[#25a06d] shadow-md hover:shadow-lg transition-all duration-200'
    : 'rounded-full bg-[#3b82f6] text-white px-6 py-3 text-sm font-semibold hover:bg-[#2563eb] shadow-md hover:shadow-lg transition-all duration-200';

  if (isVoiceMode) {
    return (
      <AppHeader>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden sm:inline text-sm text-gray-500">Target Role</span>
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#e6f7f0] text-[#2eb886] text-xs sm:text-sm font-medium rounded-full max-w-[180px] sm:max-w-[260px] truncate">
              {exactRoleTitle || roleFamilyLabel}
            </span>
          </div>
          <div className="hidden sm:block min-w-0 flex-1 text-center">
            <div className="text-lg sm:text-[28px] font-semibold text-gray-900 truncate">{buildPrimaryTitle({ isVoiceMode, title })}</div>
          </div>
          <div className="flex items-center gap-4 sm:gap-8 shrink-0">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{timerLabel}</p>
              <p className="text-[20px] sm:text-[28px] font-mono font-medium text-gray-900">{timerValue}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Progress</p>
              <p className="text-sm font-medium text-gray-900">Question {session?.currentQuestionIndex} of {session?.totalQuestions}</p>
            </div>
            {showReportButton ? (
              <button className={buttonClass} onClick={onViewReport}>
                {buttonText}
              </button>
            ) : null}
          </div>
        </div>
      </AppHeader>
    );
  }

  return (
    <AppHeader>
      <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-6 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-500">Role family</span>
          <span className="px-3 py-1 bg-[#e6f7f0] text-[#2eb886] text-sm font-medium rounded-full max-w-[220px] truncate">
            {roleFamilyLabel}
          </span>
        </div>
        <div className="min-w-0 flex-1 max-w-[420px]">
          <div className="text-lg font-semibold text-gray-900 truncate">{title}</div>
          <div className="text-xs text-gray-500 mt-1 truncate">
            Exact role: {exactRoleTitle} • Mode: {modeLabel} • {levelLabel} • {stageLabel}
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{timerLabel}</p>
            <p className="text-lg font-mono font-medium text-gray-900">{timerValue}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Progress</p>
            <p className="text-sm font-medium text-gray-900">Question {session?.currentQuestionIndex} of {session?.totalQuestions}</p>
          </div>
          {showReportButton ? (
            <button className={buttonClass} onClick={onViewReport}>
              {buttonText}
            </button>
          ) : null}
        </div>
      </div>
    </AppHeader>
  );
}
