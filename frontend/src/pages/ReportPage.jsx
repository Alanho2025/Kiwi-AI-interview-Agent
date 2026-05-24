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

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { StatusBanner } from '../components/common/StatusBanner.jsx';
import { AnswerRewriteSection } from '../components/report/AnswerRewriteSection.jsx';
import { CoachingSection } from '../components/report/CoachingSection.jsx';
import { QuoteAnalysisSection } from '../components/report/QuoteAnalysisSection.jsx';
import { CommunicationProfileSection } from '../components/report/CommunicationProfileSection.jsx';
import { NZWorkplaceFitSection } from '../components/report/NZWorkplaceFitSection.jsx';
import { CompanyMotivationFitSection } from '../components/report/CompanyMotivationFitSection.jsx';
import { TurnBreakdownSection } from '../components/report/TurnBreakdownSection.jsx';
import { InsightsSection } from '../components/report/InsightsSection.jsx';
import { ReportActionBar } from '../components/report/ReportActionBar.jsx';
import { ReportDetailSections } from '../components/report/ReportDetailSections.jsx';
import { ReportHeroCard } from '../components/report/ReportHeroCard.jsx';
import { CommercialStressTestSection } from '../components/report/CommercialStressTestSection.jsx';
import { LoadingInsightPanel } from '../components/common/LoadingInsightPanel.jsx';
import { useReportData } from '../hooks/useReportData.js';
import { buildReportViewModel } from '../utils/reportView/index.js';
import { useTour } from '../contexts/TourContext.jsx';

const REPORT_TOUR_STEPS = [
  {
    target: '#tour-report-hero',
    content: 'Your performance at a glance — see your overall score, CV-JD match, and interview quality in one place.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#tour-report-insights',
    content: 'Deep-dive into what the data says about your interview — evidence strength, use of examples, and more.',
    placement: 'top',
  },
  {
    target: '#tour-report-turns',
    content: 'Review every single answer turn by turn. See what you did well and how to improve each response.',
    placement: 'top',
  },
  {
    target: 'body',
    content: 'That concludes the tour! You can review your report or start a new session. Click Finish to exit the tour.',
    placement: 'center',
  }
];

/**
 * Purpose: Execute the main responsibility for ReportPage.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function ReportPage() {
  const { sessionId } = useParams();
  const { reportData, status, loading, handleGenerate, handleQa, handleExport, handleDownloadRecording, recordingStatus } = useReportData(sessionId);
  const viewModel = buildReportViewModel(reportData);
  const { startTour, globalTourStep, advanceGlobalTour } = useTour();

  useEffect(() => {
    if (!loading && reportData && (globalTourStep === 'report' || globalTourStep === 'interview')) {
      advanceGlobalTour('report');
      setTimeout(() => {
        startTour(REPORT_TOUR_STEPS);
      }, 500);
    }
  }, [globalTourStep, loading, reportData, startTour, advanceGlobalTour]);

  return (
    <div className="min-h-screen bg-transparent">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-4 sm:space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <StatusBanner {...status} />
        <ReportActionBar 
          loading={loading} 
          onGenerate={handleGenerate} 
          onRunQa={handleQa} 
          onExport={handleExport}
          onDownloadRecording={handleDownloadRecording}
          recordingStatus={recordingStatus}
        />

        {loading && !reportData ? (
          <div className="rounded-2xl border border-theme glass p-4 shadow-sm sm:p-6">
            <LoadingInsightPanel
              stage="report"
              skeletonLayout="report"
              title="KiwiCoach is building your coaching report..."
              message="Your answers are being summarised before detailed metrics are shown."
            />
          </div>
        ) : (
          <div id="report-printable-area" className="space-y-6">
            <div id="tour-report-hero">
              <ReportHeroCard
                report={viewModel.report}
                qa={viewModel.qa}
                takeaway={viewModel.takeaway}
                scoreBand={viewModel.scoreBand}
                generationSource={viewModel.generationSource}
              />
            </div>
            <div id="tour-report-insights" className="space-y-6">
              <CommercialStressTestSection commercialStressTest={viewModel.commercialStressTest} />
              <InsightsSection dataInsights={viewModel.dataInsights} strengthHighlights={viewModel.strengthHighlights} />
            </div>
            <NZWorkplaceFitSection fit={viewModel.nzWorkplaceFit} />
            <CompanyMotivationFitSection fit={viewModel.companyMotivationFit} />
            <CommunicationProfileSection profile={viewModel.communicationProfile} />
            <CoachingSection improvementPriorities={viewModel.improvementPriorities} coachingAdvice={viewModel.coachingAdvice} />
            <QuoteAnalysisSection quoteAnalyses={viewModel.quoteAnalyses} />
            <div id="tour-report-turns">
              <TurnBreakdownSection turnBreakdowns={viewModel.turnBreakdowns} />
            </div>
            <AnswerRewriteSection answerRewriteTips={viewModel.answerRewriteTips} />
            <ReportDetailSections
              report={viewModel.report}
              qa={viewModel.qa}
              interviewMetrics={viewModel.interviewMetrics}
              evidenceDiagnostics={viewModel.evidenceDiagnostics}
              qaDiagnostics={viewModel.qaDiagnostics}
            />
          </div>
        )}
      </main>
    </div>
  );
}
