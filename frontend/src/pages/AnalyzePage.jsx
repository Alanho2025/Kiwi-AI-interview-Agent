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

import { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { StepProgress } from '../components/layout/StepProgress.jsx';
import { CVManagementCard } from '../components/analyze/CVManagementCard.jsx';
import { JobContextCard } from '../components/analyze/JobContextCard.jsx';
import { NZSettingsCard } from '../components/analyze/NZSettingsCard.jsx';
import { AnalysisStatusCard } from '../components/analyze/AnalysisStatusCard.jsx';
import { AnalyzeActionsCard } from '../components/analyze/AnalyzeActionsCard.jsx';
import { StatusBanner } from '../components/common/StatusBanner.jsx';
import { uploadCV, getRecentCVs, selectCV, saveReviewedCvProfile, deleteCv } from '../api/uploadApi.js';
import { paraphraseJD, matchCV, generateInterviewPlan } from '../api/analyzeApi.js';
import {
  DEFAULT_ANALYZE_MODE,
  DEFAULT_ANALYZE_SETTINGS,
  loadAnalyzeDraft,
  persistAnalyzeDraft,
  resolveAnalyzeStep,
  sanitizeAnalyzeMode,
  sanitizeAnalyzeSettings,
} from '../utils/analyzeDraft.js';
import { stampHumanReviewMetadata } from '../utils/jdHumanReview.js';
import { buildCvReviewFormModel, buildReviewedCvProfilePayload } from '../utils/cvReviewViewModel.js';
import { buildSessionSetupPayload, saveSessionDefaults } from '../utils/sessionSettings.js';
import { DEFAULT_VOICE_DEVICE_CHECK } from '../hooks/useVoiceDeviceCheck.js';
import { useTour } from '../contexts/TourContext.jsx';

/**
 * Purpose: Execute the main responsibility for buildStatusMessage.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildStatusMessage = (type, title, message) => ({ type, title, message });
const JD_CONFIDENCE_THRESHOLD = 0.9;

const normalizeJDText = (value = '') => String(value || '').trim();

const formatList = (items = []) => (items?.length ? items.map((item) => `• ${typeof item === 'string' ? item : item?.label || item?.name || item}`).join('\n') : 'N/A');

const flattenTechnicalSkills = (technicalSkills = {}) => Object.values(technicalSkills || {}).flat().map((item) => item?.label || item?.name || item).filter(Boolean);

const formatStructuredJobDescription = (rubric = {}) => {
  const overview = rubric.jobOverview || {};
  const sections = rubric.sections || {};
  const technicalSkills = flattenTechnicalSkills(sections.technicalSkills);

  return `# ${overview.title || rubric.title || 'Target Role'}\n\n## Job Overview\n${formatList([
    overview.companyName && `Company: ${overview.companyName}`,
    overview.location && `Location: ${overview.location}`,
    overview.contractType && `Contract type: ${overview.contractType}`,
    overview.employmentType && `Employment type: ${overview.employmentType}`,
  ].filter(Boolean))}\n\n## What This Role Does\n${formatList(sections.responsibilities || rubric.roleSummary || [])}\n\n## Core Requirements\n${formatList(sections.mustHaveRequirements || rubric.mustHaveRequirements || [])}\n\n## Bonus Requirements\n${formatList(sections.niceToHaveRequirements || rubric.niceToHaveExperience || [])}\n\n## Technical Skills\n${formatList(technicalSkills)}\n\n## Soft Skills\n${formatList(sections.softSkills || rubric.softSkillRequirements || [])}\n\n## Benefits\n${formatList(sections.benefits || [])}\n\n## Application Notes\n${formatList(sections.applicationInstructions || [])}`;
};

const getJDParseConfidence = (rubric) => {
  const confidence = Number(rubric?.diagnostics?.confidence ?? rubric?.metadata?.confidence ?? 0);
  return Number.isFinite(confidence) ? confidence : 0;
};

const ANALYZE_TOUR_STEPS = [
  {
    target: '#tour-analyze-cv',
    content: 'First, upload your CV or select a recent one. The AI will use this to understand your background.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#tour-analyze-jd',
    content: 'Next, paste the Job Description. KiwiCoach will compare this with your CV to generate tailored interview questions.',
    placement: 'bottom',
  },
  {
    target: '#tour-analyze-actions',
    content: 'Once both are ready, click "Generate Plan". After it finishes matching, you can click "Start Interview". Go ahead and upload a CV now!',
    placement: 'top',
    spotlightClicks: true,
  }
];

export function AnalyzePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [recentCVs, setRecentCVs] = useState([]);
  const [selectedCV, setSelectedCV] = useState(null);
  const [rawJD, setRawJD] = useState('');
  const [structuredJD, setStructuredJD] = useState('');
  const [structuredJDRubric, setStructuredJDRubric] = useState(null);
  const [summarizedRawJD, setSummarizedRawJD] = useState('');
  const [structuredCVProfile, setStructuredCVProfile] = useState(null);
  const [cvHumanReviewedFileId, setCvHumanReviewedFileId] = useState('');
  const [cvReviewStatus, setCvReviewStatus] = useState('unreviewed');
  const [jdHumanReviewedRawJD, setJdHumanReviewedRawJD] = useState('');
  const [jdReviewStatus, setJdReviewStatus] = useState('unreviewed');
  const [settings, setSettings] = useState(DEFAULT_ANALYZE_SETTINGS);
  const [sessionMode, setSessionMode] = useState(DEFAULT_ANALYZE_MODE);
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [matchRate, setMatchRate] = useState(null);
  const [generatedSessionId, setGeneratedSessionId] = useState(null);
  const [isSummarizingJD, setIsSummarizingJD] = useState(false);
  const [isSavingCVReview, setIsSavingCVReview] = useState(false);
  const [deletingCvId, setDeletingCvId] = useState('');
  const [pageStatus, setPageStatus] = useState(null);
  const [voiceDeviceCheck, setVoiceDeviceCheck] = useState(DEFAULT_VOICE_DEVICE_CHECK);
  const isGeneratingPlanRef = useRef(false);

  const { startTour, globalTourStep, advanceGlobalTour } = useTour();

  const currentStep = resolveAnalyzeStep(analysisStatus);
  const isVoiceReady = voiceDeviceCheck?.browser?.status === 'ok'
    && voiceDeviceCheck?.mic?.status === 'ok'
    && voiceDeviceCheck?.speaker?.status === 'ok';
  const normalizedRawJD = normalizeJDText(rawJD);
  const hasCurrentJDSummary = Boolean(
    structuredJD
    && structuredJDRubric
    && normalizedRawJD
    && normalizedRawJD === normalizeJDText(summarizedRawJD)
  );
  const jdParseConfidence = getJDParseConfidence(structuredJDRubric);
  const isCvEdited = cvReviewStatus === 'edited';
  const isJdEdited = jdReviewStatus === 'edited';
  const requiresJdHumanReview = Boolean(
    hasCurrentJDSummary
    && jdReviewStatus !== 'verified'
  );
  const isJdHumanVerified = Boolean(hasCurrentJDSummary && jdReviewStatus === 'verified');
  const canUseCurrentJDSummary = Boolean(hasCurrentJDSummary && jdReviewStatus === 'verified');
  const isCvHumanVerified = Boolean(selectedCV?.id && cvReviewStatus === 'verified' && cvHumanReviewedFileId === selectedCV.id);

  useEffect(() => {
    // Trigger if the tour is meant for this page, or if user jumped here from Home via spotlight click
    if (globalTourStep === 'analyze' || globalTourStep === 'home') {
      advanceGlobalTour('analyze');
      setTimeout(() => {
        startTour(ANALYZE_TOUR_STEPS);
      }, 1000);
    }
  }, [globalTourStep, startTour, advanceGlobalTour]);

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
    setJdHumanReviewedRawJD('');
    setJdReviewStatus('unreviewed');
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
    setJdHumanReviewedRawJD('');
    setJdReviewStatus('unreviewed');
  };

  useEffect(() => {
    const restoredDraft = loadAnalyzeDraft();
    setSelectedCV(restoredDraft.selectedCV);
    setStructuredCVProfile(restoredDraft.structuredCVProfile || (restoredDraft.selectedCV ? buildCvReviewFormModel(restoredDraft.selectedCV) : null));
    setCvHumanReviewedFileId(restoredDraft.cvHumanReviewedFileId || '');
    setCvReviewStatus(restoredDraft.cvReviewStatus || 'unreviewed');
    setRawJD(restoredDraft.rawJD);
    setStructuredJD(restoredDraft.structuredJD);
    setStructuredJDRubric(restoredDraft.structuredJDRubric);
    setSummarizedRawJD(restoredDraft.summarizedRawJD);
    setJdHumanReviewedRawJD(restoredDraft.jdHumanReviewedRawJD);
    setJdReviewStatus(restoredDraft.jdReviewStatus || 'unreviewed');
    const homeSessionSettings = location.state?.sessionDefaults
      ? sanitizeAnalyzeSettings(location.state.sessionDefaults)
      : null;
    setSettings(homeSessionSettings || restoredDraft.settings);
    setSessionMode(sanitizeAnalyzeMode(location.state?.sessionMode || restoredDraft.sessionMode));

    getRecentCVs().then(setRecentCVs).catch(console.error);
  }, [location.state]);

  useEffect(() => {
    persistAnalyzeDraft({
      selectedCV,
      structuredCVProfile,
      cvHumanReviewedFileId,
      cvReviewStatus,
      rawJD,
      structuredJD,
      structuredJDRubric,
      summarizedRawJD,
      jdHumanReviewedRawJD,
      jdReviewStatus,
      settings,
      sessionMode,
    });
  }, [selectedCV, structuredCVProfile, cvHumanReviewedFileId, cvReviewStatus, rawJD, structuredJD, structuredJDRubric, summarizedRawJD, jdHumanReviewedRawJD, jdReviewStatus, settings, sessionMode]);

  const handleUpload = async (file) => {
    try {
      const uploadedCV = await uploadCV(file);
      resetAnalysisState();
      setSelectedCV(uploadedCV);
      setStructuredCVProfile(buildCvReviewFormModel(uploadedCV));
      setCvHumanReviewedFileId('');
      setCvReviewStatus('unreviewed');
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
      setStructuredCVProfile(buildCvReviewFormModel(activeCV));
      setCvHumanReviewedFileId('');
      setCvReviewStatus('unreviewed');
      setPageStatus(buildStatusMessage('info', 'CV selected', `${activeCV.name} is now the active CV for JD matching.`));
    } catch (error) {
      setPageStatus(buildStatusMessage('error', 'Could not select CV', error.message));
    }
  };

  const handleDeleteRecent = async (cv) => {
    if (!cv?.id) {
      return;
    }

    const confirmed = window.confirm(`Delete ${cv.name}? This removes it from your recent CV list.`);
    if (!confirmed) {
      return;
    }

    setDeletingCvId(cv.id);
    try {
      await deleteCv(cv.id);
      if (selectedCV?.id === cv.id) {
        setSelectedCV(null);
        setStructuredCVProfile(null);
        setCvHumanReviewedFileId('');
        setCvReviewStatus('unreviewed');
        resetAnalysisState();
      }
      await refreshRecentCVs();
      setPageStatus(buildStatusMessage('success', 'CV deleted', `${cv.name} was removed from your recent CVs.`));
    } catch (error) {
      setPageStatus(buildStatusMessage('error', 'Could not delete CV', error.message));
    } finally {
      setDeletingCvId('');
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
      const confidence = getJDParseConfidence(jdResponse.structuredJDRubric);
      if (confidence < JD_CONFIDENCE_THRESHOLD) {
        setPageStatus(buildStatusMessage(
          'info',
          'Review JD summary before matching',
          `AI confidence is ${Math.round(confidence * 100)}%. Check the extracted role details and confirm the summary before CV-JD matching.`
        ));
      } else {
        setPageStatus(buildStatusMessage('success', 'JD summary ready', 'The current JD summary is high-confidence. Review it once before CV-JD matching.'));
      }
    } catch (error) {
      setPageStatus(buildStatusMessage('error', 'JD summary failed', error.message));
      setAnalysisStatus('error');
    } finally {
      setIsSummarizingJD(false);
    }
  };

  const handleStartInterview = () => {
    navigate(`/interview/${generatedSessionId}`);
  };

  const handleSettingsChange = (nextSettings) => {
    const safeSettings = sanitizeAnalyzeSettings(nextSettings);
    resetAnalysisState();
    setSettings(safeSettings);
    saveSessionDefaults(safeSettings);
  };

  const handleSessionModeChange = (nextMode) => {
    resetAnalysisState();
    setSessionMode(sanitizeAnalyzeMode(nextMode));
  };

  const handleStructuredJDRubricChange = (nextRubric) => {
    const reviewedRubric = stampHumanReviewMetadata(nextRubric, 'edited');
    setStructuredJDRubric(reviewedRubric);
    setStructuredJD(formatStructuredJobDescription(reviewedRubric));
    setJdReviewStatus('edited');
    setJdHumanReviewedRawJD('');
    resetAnalysisState();
  };

  const handleStructuredCVProfileChange = (nextProfile) => {
    setStructuredCVProfile(nextProfile);
    setCvReviewStatus('edited');
    setCvHumanReviewedFileId('');
    resetAnalysisState();
  };

  const handleConfirmJDSummary = () => {
    if (!hasCurrentJDSummary) {
      setPageStatus(buildStatusMessage('error', 'Summarise current JD first', 'The JD text has changed. Summarise it again before confirming.'));
      return;
    }

    const verifiedRubric = stampHumanReviewMetadata(structuredJDRubric, 'verified');
    setStructuredJDRubric(verifiedRubric);
    setStructuredJD(formatStructuredJobDescription(verifiedRubric));
    setJdHumanReviewedRawJD(rawJD);
    setJdReviewStatus('verified');
    setPageStatus(buildStatusMessage('success', 'JD summary reviewed', 'KiwiCoach will use this human-reviewed JD summary for CV-JD matching.'));
  };

  const handleConfirmCVReview = async () => {
    if (!selectedCV?.id) {
      setPageStatus(buildStatusMessage('error', 'Select a CV first', 'Upload or select a CV before reviewing the parsed CV fields.'));
      return;
    }

    setIsSavingCVReview(true);
    try {
      const reviewPayload = buildReviewedCvProfilePayload(structuredCVProfile || buildCvReviewFormModel(selectedCV));
      const reviewedCV = await saveReviewedCvProfile(selectedCV.id, reviewPayload);
      setSelectedCV(reviewedCV);
      setStructuredCVProfile(buildCvReviewFormModel(reviewedCV));
      setCvHumanReviewedFileId(reviewedCV.id);
      setCvReviewStatus('verified');
      resetAnalysisState();
      setPageStatus(buildStatusMessage('success', 'CV parse reviewed', 'KiwiCoach will use this reviewed CV profile for CV-JD matching.'));
    } catch (error) {
      setPageStatus(buildStatusMessage('error', 'CV review failed', error.message));
    } finally {
      setIsSavingCVReview(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (isGeneratingPlanRef.current) {
      return;
    }

    if (!selectedCV || !rawJD) {
      setPageStatus(buildStatusMessage('error', 'Missing input', 'Please provide both a CV and a job description.'));
      return;
    }

    if (!isCvHumanVerified) {
      setPageStatus(buildStatusMessage('info', 'Review CV parse first', 'Check the CV fields used for matching, then mark the CV parse as reviewed.'));
      return;
    }

    if (!hasCurrentJDSummary) {
      setPageStatus(buildStatusMessage('info', 'Summarise JD first', 'Generate and review the JD summary before running CV-JD matching.'));
      return;
    }

    if (!canUseCurrentJDSummary) {
      setPageStatus(buildStatusMessage('info', 'Review JD summary first', 'Edit the parsed JD fields if needed, then mark the JD as reviewed before generating the match.'));
      return;
    }

    isGeneratingPlanRef.current = true;
    setAnalysisStatus('matching');

    try {
      const finalStructuredJDRubric = stampHumanReviewMetadata(structuredJDRubric, isJdHumanVerified ? 'verified' : 'unreviewed');
      const finalStructuredJD = formatStructuredJobDescription(finalStructuredJDRubric);

      const matchResponse = await matchCV(selectedCV.id, rawJD, finalStructuredJDRubric, settings);
      setAnalysisResult(matchResponse);
      setMatchRate(matchResponse?.matchScore || null);

      const planResponse = await generateInterviewPlan({
        cvId: selectedCV.id,
        rawJD,
        jdText: finalStructuredJD,
        jdRubric: finalStructuredJDRubric,
        settings,
        sessionSetup: buildSessionSetupPayload(settings, sessionMode),
        mode: sessionMode,
        matchAnalysisId: matchResponse.matchAnalysisId || null,
      });

      setGeneratedSessionId(planResponse.sessionId);
      setAnalysisStatus('success');
      const modeLabel = sessionMode === 'voice' ? 'voice' : 'text';
      setPageStatus(buildStatusMessage('success', 'Match analysis complete', `Review the score breakdown before continuing to the ${modeLabel} interview session.`));
    } catch (error) {
      console.error(error);
      setAnalysisStatus('error');
      setPageStatus(buildStatusMessage('error', 'Analysis failed', error.message));
    } finally {
      isGeneratingPlanRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">
      <AppHeader>
        <StepProgress currentStep={currentStep} />
      </AppHeader>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-2 xl:gap-8">
          <div className="space-y-5 sm:space-y-6 xl:space-y-8">
            <div id="tour-analyze-cv">
              <CVManagementCard
                onUpload={handleUpload}
                selectedCV={selectedCV}
                recentCVs={recentCVs}
                onSelectRecent={handleSelectRecent}
                onDeleteRecent={handleDeleteRecent}
                deletingCvId={deletingCvId}
                isCvHumanVerified={isCvHumanVerified}
                onConfirmCVReview={handleConfirmCVReview}
                cvReviewProfile={structuredCVProfile}
                onCvReviewProfileChange={handleStructuredCVProfileChange}
                isCvEdited={isCvEdited}
                isCvReviewSaving={isSavingCVReview}
                validationMessage={pageStatus?.type === 'error' && pageStatus.title === 'Upload failed' ? pageStatus.message : null}
              />
            </div>
            <div id="tour-analyze-jd">
              <JobContextCard
                rawJD={rawJD}
                setRawJD={handleRawJDChange}
                structuredJD={structuredJD}
                structuredJDRubric={structuredJDRubric}
                onStructuredJDRubricChange={handleStructuredJDRubricChange}
                onSummarize={handleSummarizeJD}
                isSummarizing={isSummarizingJD}
                jdConfidenceThreshold={JD_CONFIDENCE_THRESHOLD}
                isJdHumanVerified={isJdHumanVerified}
                requiresJdHumanReview={requiresJdHumanReview}
                isJdEdited={isJdEdited}
                onConfirmJDSummary={handleConfirmJDSummary}
              />
            </div>
          </div>

          <div className="space-y-5 sm:space-y-6 xl:space-y-8">
            {pageStatus ? (
              <StatusBanner
                variant={pageStatus.type}
                title={pageStatus.title}
                message={pageStatus.message}
              />
            ) : null}
            <NZSettingsCard
              settings={settings}
              setSettings={handleSettingsChange}
              sessionMode={sessionMode}
              setSessionMode={handleSessionModeChange}
              voiceDeviceCheck={voiceDeviceCheck}
              setVoiceDeviceCheck={setVoiceDeviceCheck}
            />
            <AnalysisStatusCard
              status={analysisStatus}
              matchRate={matchRate}
              analysisResult={analysisResult}
            />
            <div id="tour-analyze-actions">
              <AnalyzeActionsCard
                analysisStatus={analysisStatus}
                generatedSessionId={generatedSessionId}
                selectedCV={selectedCV}
                rawJD={rawJD}
                hasCurrentJDSummary={hasCurrentJDSummary}
                jdParseConfidence={jdParseConfidence}
                jdConfidenceThreshold={JD_CONFIDENCE_THRESHOLD}
                requiresJdHumanReview={requiresJdHumanReview}
                canUseJDSummary={canUseCurrentJDSummary}
                isCvHumanVerified={isCvHumanVerified}
                onGeneratePlan={handleGeneratePlan}
                onStartInterview={handleStartInterview}
                sessionMode={sessionMode}
                isVoiceReady={isVoiceReady}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
