/**
 * File responsibility: Page container.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: ReportPage should orchestrate the screen and compose child sections without burying domain rules in JSX.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { useParams } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { StatusBanner } from '../components/common/StatusBanner.jsx';
import { AnswerRewriteSection } from '../components/report/AnswerRewriteSection.jsx';
import { CoachingSection } from '../components/report/CoachingSection.jsx';
import { InsightsSection } from '../components/report/InsightsSection.jsx';
import { ReportActionBar } from '../components/report/ReportActionBar.jsx';
import { ReportDetailSections } from '../components/report/ReportDetailSections.jsx';
import { ReportHeroCard } from '../components/report/ReportHeroCard.jsx';
import { useReportData } from '../hooks/useReportData.js';
import { buildReportViewModel } from '../utils/reportView/index.js';

/**
 * Purpose: Execute the main responsibility for ReportPage.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function ReportPage() {
  const { sessionId } = useParams();
  const { reportData, status, loading, handleGenerate, handleQa } = useReportData(sessionId);
  const viewModel = buildReportViewModel(reportData);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <StatusBanner {...status} />
        <ReportActionBar loading={loading} onGenerate={handleGenerate} onRunQa={handleQa} />

        <ReportHeroCard
          report={viewModel.report}
          qa={viewModel.qa}
          candidateFeedback={viewModel.candidateFeedback}
          takeaway={viewModel.takeaway}
          scoreBand={viewModel.scoreBand}
          generationSource={viewModel.generationSource}
        />
        <InsightsSection dataInsights={viewModel.dataInsights} strengthHighlights={viewModel.strengthHighlights} />
        <CoachingSection improvementPriorities={viewModel.improvementPriorities} coachingAdvice={viewModel.coachingAdvice} />
        <AnswerRewriteSection answerRewriteTips={viewModel.answerRewriteTips} />
        <ReportDetailSections
          report={viewModel.report}
          qa={viewModel.qa}
          interviewMetrics={viewModel.interviewMetrics}
          evidenceDiagnostics={viewModel.evidenceDiagnostics}
          qaDiagnostics={viewModel.qaDiagnostics}
        />
      </main>
    </div>
  );
}
