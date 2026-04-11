/**
 * File responsibility: Page container.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: AnalyzePage should orchestrate the screen and compose child sections without burying domain rules in JSX.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { StepProgress } from '../components/layout/StepProgress.jsx';
import { CVManagementCard } from '../components/analyze/CVManagementCard.jsx';
import { JobContextCard } from '../components/analyze/JobContextCard.jsx';
import { NZSettingsCard } from '../components/analyze/NZSettingsCard.jsx';
import { AnalysisStatusCard } from '../components/analyze/AnalysisStatusCard.jsx';
import { AnalyzeActionsCard } from '../components/analyze/AnalyzeActionsCard.jsx';
import { StatusBanner } from '../components/common/StatusBanner.jsx';
import { uploadCV, getRecentCVs, selectCV } from '../api/uploadApi.js';
import { paraphraseJD, matchCV, generateInterviewPlan } from '../api/analyzeApi.js';
import {
  DEFAULT_ANALYZE_SETTINGS,
  loadAnalyzeDraft,
  persistAnalyzeDraft,
  resolveAnalyzeStep,
} from '../utils/analyzeDraft.js';

/**
 * Purpose: Execute the main responsibility for buildStatusMessage.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildStatusMessage = (type, title, message) => ({ type, title, message });

export function AnalyzePage() {
  const navigate = useNavigate();

  const [recentCVs, setRecentCVs] = useState([]);
  const [selectedCV, setSelectedCV] = useState(null);
  const [rawJD, setRawJD] = useState('');
  const [structuredJD, setStructuredJD] = useState('');
  const [structuredJDRubric, setStructuredJDRubric] = useState(null);
  const [summarizedRawJD, setSummarizedRawJD] = useState('');
  const [settings, setSettings] = useState(DEFAULT_ANALYZE_SETTINGS);
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [matchRate, setMatchRate] = useState(null);
  const [generatedSessionId, setGeneratedSessionId] = useState(null);
  const [isSummarizingJD, setIsSummarizingJD] = useState(false);
  const [pageStatus, setPageStatus] = useState(null);

  const currentStep = resolveAnalyzeStep(analysisStatus);

  const resetAnalysisState = () => {
    setAnalysisStatus('idle');
    setAnalysisResult(null);
    setMatchRate(null);
    setGeneratedSessionId(null);
  };

  const clearJDSummary = () => {
    setStructuredJD('');
    setStructuredJDRubric(null);
    setSummarizedRawJD('');
  };

  const handleRawJDChange = (value) => {
    setRawJD(value);
    resetAnalysisState();

    if (value.trim() !== summarizedRawJD.trim()) {
      clearJDSummary();
    }
  };

  const refreshRecentCVs = async () => {
    const updatedRecent = await getRecentCVs();
    setRecentCVs(updatedRecent);
  };

  const applyStructuredJD = (jdResponse, nextRawJD) => {
    setStructuredJD(jdResponse.structuredJD);
    setStructuredJDRubric(jdResponse.structuredJDRubric);
    setSummarizedRawJD(nextRawJD);
  };

  useEffect(() => {
    const restoredDraft = loadAnalyzeDraft();
    setSelectedCV(restoredDraft.selectedCV);
    setRawJD(restoredDraft.rawJD);
    setStructuredJD(restoredDraft.structuredJD);
    setStructuredJDRubric(restoredDraft.structuredJDRubric);
    setSummarizedRawJD(restoredDraft.summarizedRawJD);
    setSettings(restoredDraft.settings);

    getRecentCVs().then(setRecentCVs).catch(console.error);
  }, []);

  useEffect(() => {
    persistAnalyzeDraft({
      selectedCV,
      rawJD,
      structuredJD,
      structuredJDRubric,
      summarizedRawJD,
      settings,
    });
  }, [selectedCV, rawJD, structuredJD, structuredJDRubric, summarizedRawJD, settings]);

  const handleUpload = async (file) => {
    try {
      const uploadedCV = await uploadCV(file);
      resetAnalysisState();
      setSelectedCV(uploadedCV);
      setPageStatus(buildStatusMessage('success', 'CV uploaded', `${uploadedCV.name} was parsed into a CV profile and is ready for matching.`));
      await refreshRecentCVs();
      return true;
    } catch (error) {
      setPageStatus(buildStatusMessage('error', 'Upload failed', error.message));
      return false;
    }
  };

  const handleSelectRecent = async (cvId) => {
    try {
      const activeCV = await selectCV(cvId);
      resetAnalysisState();
      setSelectedCV(activeCV);
      setPageStatus(buildStatusMessage('info', 'CV selected', `${activeCV.name} is now the active CV for JD matching.`));
    } catch (error) {
      setPageStatus(buildStatusMessage('error', 'Could not select CV', error.message));
    }
  };

  const handleSummarizeJD = async () => {
    if (!rawJD.trim()) {
      return;
    }

    setIsSummarizingJD(true);
    setAnalysisStatus('summarizing');

    try {
      const jdResponse = await paraphraseJD(rawJD);
      applyStructuredJD(jdResponse, rawJD);
      setAnalysisStatus('idle');
      setPageStatus(buildStatusMessage('success', 'JD summary ready', 'The current JD summary will be used for CV matching.'));
    } catch (error) {
      setPageStatus(buildStatusMessage('error', 'JD summary failed', error.message));
      setAnalysisStatus('error');
    } finally {
      setIsSummarizingJD(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedCV || !rawJD) {
      setPageStatus(buildStatusMessage('error', 'Missing input', 'Please provide both a CV and a job description.'));
      return;
    }

    setAnalysisStatus('matching');

    try {
      let finalStructuredJD = structuredJD;
      let finalStructuredJDRubric = structuredJDRubric;
      const needsFreshSummary = !finalStructuredJD || !finalStructuredJDRubric || rawJD.trim() !== summarizedRawJD.trim();

      if (needsFreshSummary) {
        const jdResponse = await paraphraseJD(rawJD);
        finalStructuredJD = jdResponse.structuredJD;
        finalStructuredJDRubric = jdResponse.structuredJDRubric;
        applyStructuredJD(jdResponse, rawJD);
      }

      const matchResponse = await matchCV(selectedCV.id, rawJD, finalStructuredJDRubric, settings);
      setAnalysisResult(matchResponse);
      setMatchRate(matchResponse?.matchScore || null);

      const planResponse = await generateInterviewPlan({
        cvId: selectedCV.id,
        rawJD,
        jdText: finalStructuredJD,
        jdRubric: finalStructuredJDRubric,
        settings,
        analysisResult: matchResponse,
        matchAnalysisId: matchResponse.matchAnalysisId || null,
      });

      setGeneratedSessionId(planResponse.sessionId);
      setAnalysisStatus('success');
      setPageStatus(buildStatusMessage('success', 'Match analysis complete', 'Review the score breakdown before starting the text interview.'));
    } catch (error) {
      console.error(error);
      setAnalysisStatus('error');
      setPageStatus(buildStatusMessage('error', 'Analysis failed', error.message));
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">
      <AppHeader>
        <StepProgress currentStep={currentStep} />
      </AppHeader>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <CVManagementCard
              onUpload={handleUpload}
              recentCVs={recentCVs}
              onSelectRecent={handleSelectRecent}
              validationMessage={pageStatus?.type === 'error' && pageStatus.title === 'Upload failed' ? pageStatus.message : null}
            />
            <JobContextCard
              rawJD={rawJD}
              setRawJD={handleRawJDChange}
              structuredJD={structuredJD}
              structuredJDRubric={structuredJDRubric}
              onSummarize={handleSummarizeJD}
              isSummarizing={isSummarizingJD}
            />
          </div>

          <div className="space-y-8">
            {pageStatus ? (
              <StatusBanner
                variant={pageStatus.type}
                title={pageStatus.title}
                message={pageStatus.message}
              />
            ) : null}
            <NZSettingsCard settings={settings} setSettings={setSettings} />
            <AnalysisStatusCard
              status={analysisStatus}
              matchRate={matchRate}
              analysisResult={analysisResult}
            />
            <AnalyzeActionsCard
              analysisStatus={analysisStatus}
              generatedSessionId={generatedSessionId}
              selectedCV={selectedCV}
              rawJD={rawJD}
              onGeneratePlan={handleGeneratePlan}
              onStartInterview={() => navigate(`/interview/${generatedSessionId}`)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
