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

import { useCallback, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { StepProgress } from '../components/layout/StepProgress.jsx';
import { CVManagementCard } from '../components/analyze/CVManagementCard.jsx';
import { JobContextCard } from '../components/analyze/JobContextCard.jsx';
import { NZSettingsCard } from '../components/analyze/NZSettingsCard.jsx';
import { AnalysisStatusCard } from '../components/analyze/AnalysisStatusCard.jsx';
import { AnalyzeActionsCard } from '../components/analyze/AnalyzeActionsCard.jsx';
import { AnalysisWorkflowShell } from '../components/analyze/AnalysisWorkflowShell.jsx';
import { StatusBanner } from '../components/common/StatusBanner.jsx';
import { uploadCV, getRecentCVs, selectCV, saveReviewedCvProfile, deleteCv } from '../api/uploadApi.js';
import { confirmRoleFitReview, paraphraseJD, startCompanyValuesEnrichment, getSavedJDs } from '../api/analyzeApi.js';
import { getSession } from '../api/sessionApi.js';
import {
  DEFAULT_ANALYZE_MODE,
  DEFAULT_ANALYZE_SETTINGS,
  loadAnalyzeDraft,
  persistAnalyzeDraft,
  sanitizeAnalyzeMode,
  sanitizeAnalyzeSettings,
} from '../utils/analyzeDraft.js';
import { stampHumanReviewMetadata } from '../utils/jdHumanReview.js';
import { buildCvReviewFormModel, buildReviewedCvProfilePayload } from '../utils/cvReviewViewModel.js';
import { buildSessionSetupPayload, saveSessionDefaults } from '../utils/sessionSettings.js';
import { DEFAULT_VOICE_DEVICE_CHECK } from '../hooks/useVoiceDeviceCheck.js';
import { useMatchAnalysisFlow } from '../hooks/useMatchAnalysisFlow.js';
import { useTour } from '../contexts/TourContext.jsx';

import {
  buildStatusMessage,
  JD_CONFIDENCE_THRESHOLD,
  normalizeJDText,
  formatStructuredJobDescription,
  getJDParseConfidence,
  firstNonEmptyObject,
  ANALYZE_TOUR_STEPS,
  WORKFLOW_STEP_IDS,
  workflowHeaderSteps,
  resolveDraftWorkflowStep,
} from '../utils/analyzePageBuilder.js';

export function AnalyzePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [recentCVs, setRecentCVs] = useState([]);
  const [selectedCV, setSelectedCV] = useState(null);
  const [rawJD, setRawJD] = useState('');
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState('');
  const [userCompanyContext, setUserCompanyContext] = useState('');
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
  const {
    analysisStatus,
    analysisResult,
    matchRate,
    generatedSessionId,
    questionPoolInfo,
    planStatus,
    progressStages,
    currentStage,
    run: runMatchAnalysis,
    retryPlan,
    reset: resetMatchAnalysis,
    hydrate: hydrateMatchAnalysis,
  } = useMatchAnalysisFlow();
  const [isSummarizingJD, setIsSummarizingJD] = useState(false);
  const [isSavingCVReview, setIsSavingCVReview] = useState(false);
  const [deletingCvId, setDeletingCvId] = useState('');
  const [pageStatus, setPageStatus] = useState(null);
  const [voiceDeviceCheck, setVoiceDeviceCheck] = useState(DEFAULT_VOICE_DEVICE_CHECK);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(WORKFLOW_STEP_IDS.CV_UPLOAD);
  const [savedJDs, setSavedJDs] = useState([]);
  const [isLoadingSavedJDs, setIsLoadingSavedJDs] = useState(false);
  const isGeneratingPlanRef = useRef(false);

  const { startTour, globalTourStep, advanceGlobalTour } = useTour();

  const fetchSavedJDs = useCallback(async () => {
    setIsLoadingSavedJDs(true);
    try {
      const response = await getSavedJDs();
      setSavedJDs(response.savedJDs || []);
    } catch (error) {
      console.error('Failed to load saved JDs:', error);
    } finally {
      setIsLoadingSavedJDs(false);
    }
  }, []);

  const syncCanonicalRequirementsFromSections = (rubric = {}) => {
    const sections = rubric.sections || {};
    const mustHaves = (sections.mustHaveRequirements || []).map((line, index) => ({
      id: `req-must-${index + 1}`,
      label: line,
      mustHave: true,
      type: 'hard',
      category: 'technical_skill',
      importance: 'high',
    }));
    const niceToHaves = (sections.niceToHaveRequirements || []).map((line, index) => ({
      id: `req-nice-${index + 1}`,
      label: line,
      mustHave: false,
      type: 'soft',
      category: 'preferred_skill',
      importance: 'medium',
    }));
    const updatedReqs = [...mustHaves, ...niceToHaves];
    return updatedReqs.length ? updatedReqs : (rubric.requirements || []);
  };

  const handleSelectSavedJD = (fingerprint) => {
    const selected = savedJDs.find((jd) => jd.jdFingerprint === fingerprint);
    if (!selected) return;

    resetAnalysisState();
    setRawJD(selected.rawJD || '');
    setCompanyWebsiteUrl(selected.websiteUrl || '');
    setUserCompanyContext(selected.roleFitProfile?.companyUnderstanding?.summary || '');
    setStructuredJD(selected.rawJD ? formatStructuredJobDescription(selected.jdRubric) : '');
    setStructuredJDRubric(selected.jdRubric);
    setSummarizedRawJD(selected.rawJD || '');
    setJdHumanReviewedRawJD(selected.rawJD || '');

    // Fix Issue 2: Respect true saved review status instead of forcing 'verified'
    const savedReviewStatus = selected.jdRubric?.metadata?.humanReviewStatus || selected.humanReviewStatus || 'unreviewed';
    setJdReviewStatus(savedReviewStatus);

    if (savedReviewStatus === 'verified') {
      setActiveWorkflowStep(WORKFLOW_STEP_IDS.SESSION_SETUP);
      setPageStatus(buildStatusMessage('success', 'Saved JD selected', `Loaded verified "${selected.title || 'Saved JD'}". Proceed to session setup.`));
    } else {
      setActiveWorkflowStep(WORKFLOW_STEP_IDS.JD_REVIEW);
      setPageStatus(buildStatusMessage('info', 'Saved JD selected (Unreviewed)', `Loaded "${selected.title || 'Saved JD'}". Please review the JD fields before matching.`));
    }
  };

  const isVoiceReady = voiceDeviceCheck?.browser?.status === 'ok'
    && voiceDeviceCheck?.mic?.status === 'ok'
    && voiceDeviceCheck?.speaker?.status === 'ok';
  const normalizedRawJD = normalizeJDText(rawJD);
  const hasCompanyContext = Boolean(companyWebsiteUrl.trim() || userCompanyContext.trim());
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
  const isSessionSetupReady = sessionMode !== 'voice' || isVoiceReady;
  const displayedAnalysisStatus = isSummarizingJD ? 'summarizing' : analysisStatus;
  const workflowStepOrder = [
    WORKFLOW_STEP_IDS.CV_UPLOAD,
    WORKFLOW_STEP_IDS.CV_REVIEW,
    WORKFLOW_STEP_IDS.JD_INPUT,
    WORKFLOW_STEP_IDS.JD_REVIEW,
    WORKFLOW_STEP_IDS.SESSION_SETUP,
    WORKFLOW_STEP_IDS.MATCH_RESULT,
  ];
  const currentStep = workflowStepOrder.indexOf(activeWorkflowStep) + 1 || 1;
  const workflowSteps = [
    {
      id: WORKFLOW_STEP_IDS.CV_UPLOAD,
      label: 'Upload CV',
      detail: selectedCV ? selectedCV.name : 'Upload or choose a recent CV.',
      complete: Boolean(selectedCV),
      blocked: false,
    },
    {
      id: WORKFLOW_STEP_IDS.CV_REVIEW,
      label: 'Check CV Parse',
      detail: isCvHumanVerified ? 'Reviewed CV profile is ready.' : 'Review extracted evidence before JD matching.',
      complete: isCvHumanVerified,
      blocked: !selectedCV,
      warning: Boolean(selectedCV && !isCvHumanVerified),
    },
    {
      id: WORKFLOW_STEP_IDS.JD_INPUT,
      label: 'Paste JD',
      detail: rawJD.trim() ? 'JD text is ready to summarise.' : 'Paste the target job description.',
      complete: Boolean(rawJD.trim()),
      blocked: !isCvHumanVerified,
    },
    {
      id: WORKFLOW_STEP_IDS.JD_REVIEW,
      label: 'Check JD Parse',
      detail: isJdHumanVerified ? 'Reviewed JD summary is ready.' : 'Summarise and review parsed JD fields.',
      complete: isJdHumanVerified,
      blocked: !rawJD.trim() || !isCvHumanVerified,
      warning: Boolean(hasCurrentJDSummary && !isJdHumanVerified),
    },
    {
      id: WORKFLOW_STEP_IDS.SESSION_SETUP,
      label: sessionMode === 'voice' ? 'Device Check' : 'Session Setup',
      detail: sessionMode === 'voice'
        ? isVoiceReady ? 'Voice devices are ready.' : 'Check microphone and speaker.'
        : 'Choose interview mode and question settings.',
      complete: isSessionSetupReady,
      blocked: !isJdHumanVerified,
      warning: Boolean(sessionMode === 'voice' && !isVoiceReady && isJdHumanVerified),
    },
    {
      id: WORKFLOW_STEP_IDS.MATCH_RESULT,
      label: 'Match Result',
      detail: generatedSessionId
        ? 'Interview plan is ready.'
        : analysisResult
          ? planStatus === 'preparing'
            ? 'Match complete. Preparing the interview session.'
            : planStatus === 'failed'
              ? 'Match complete. Interview preparation needs another try.'
              : 'Match analysis is saved.'
          : 'Generate match analysis.',
      complete: Boolean(analysisResult),
      blocked: !isJdHumanVerified || !isSessionSetupReady,
    },
  ];

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
    resetMatchAnalysis();
  };

  const handleWorkflowStepChange = (stepId) => {
    const nextStep = workflowSteps.find((step) => step.id === stepId);
    if (!nextStep || nextStep.blocked) {
      return;
    }

    setActiveWorkflowStep(stepId);
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

    if ([WORKFLOW_STEP_IDS.JD_REVIEW, WORKFLOW_STEP_IDS.SESSION_SETUP, WORKFLOW_STEP_IDS.MATCH_RESULT].includes(activeWorkflowStep)) {
      setActiveWorkflowStep(WORKFLOW_STEP_IDS.JD_INPUT);
    }
  };

  const handleCompanyContextChange = (setter) => (value) => {
    setter(value);
    resetAnalysisState();
    clearJDSummary();
    setActiveWorkflowStep(WORKFLOW_STEP_IDS.JD_INPUT);
  };

  const refreshRecentCVs = async () => {
    const updatedRecent = await getRecentCVs();
    setRecentCVs(updatedRecent);
  };

  const applyStructuredJD = (jdResponse, nextRawJD) => {
    setStructuredJD(jdResponse.structuredJD);
    setStructuredJDRubric(jdResponse.structuredJDRubric);
    setSummarizedRawJD(jdResponse.rawJD || nextRawJD);
    setJdHumanReviewedRawJD('');
    setJdReviewStatus('unreviewed');
    if (jdResponse.rawJD) {
      setRawJD(jdResponse.rawJD);
    }
  };

  const restoreReadySessionAnalysis = useCallback((session) => {
    const setup = session?.analysisSetup || {};
    const restoredSelectedCV = setup.selectedCV || null;
    const restoredRubric = firstNonEmptyObject(
      setup.structuredJDRubric,
      session?.analysisResult?.parsedJdProfile,
      session?.analysisResult?.matchingDetails?.rubric
    );
    const restoredStructuredJD = setup.structuredJD || (restoredRubric ? formatStructuredJobDescription(restoredRubric) : '');
    const restoredRawJD = setup.rawJD || restoredStructuredJD;
    const restoredAnalysisResult = session?.analysisResult || null;
    const restoredSettings = sanitizeAnalyzeSettings(setup.settings || session?.settings || DEFAULT_ANALYZE_SETTINGS);

    setSelectedCV(restoredSelectedCV);
    setStructuredCVProfile(restoredSelectedCV ? buildCvReviewFormModel(restoredSelectedCV) : null);
    setCvHumanReviewedFileId(setup.cvHumanReviewedFileId || restoredSelectedCV?.id || session?.cvFileId || '');
    setCvReviewStatus(setup.cvReviewStatus || (restoredSelectedCV ? 'verified' : 'unreviewed'));
    setRawJD(restoredRawJD);
    setCompanyWebsiteUrl(setup.companyWebsiteUrl || restoredRubric?.roleFit?.companyContext?.websiteUrl || '');
    setUserCompanyContext(setup.userCompanyContext || restoredRubric?.roleFit?.companyContext?.manualContext || '');
    setStructuredJD(restoredStructuredJD);
    setStructuredJDRubric(restoredRubric);
    setSummarizedRawJD(setup.summarizedRawJD || restoredRawJD);
    setJdHumanReviewedRawJD(setup.jdHumanReviewedRawJD || restoredRawJD);
    setJdReviewStatus(setup.jdReviewStatus || (restoredRubric ? 'verified' : 'unreviewed'));
    setSettings(restoredSettings);
    setSessionMode(sanitizeAnalyzeMode(setup.sessionMode || session?.mode || DEFAULT_ANALYZE_MODE));
    setVoiceDeviceCheck(DEFAULT_VOICE_DEVICE_CHECK);
    hydrateMatchAnalysis({
      analysisResult: restoredAnalysisResult,
      generatedSessionId: session?.id || null,
      questionPoolInfo: setup.questionPoolInfo || null,
    });
    setActiveWorkflowStep(WORKFLOW_STEP_IDS.MATCH_RESULT);
    setPageStatus(buildStatusMessage('success', 'Match analysis complete', 'Review the score breakdown before starting the interview session.'));
  }, [hydrateMatchAnalysis]);

  useEffect(() => {
    let isActive = true;
    const resumeSessionId = new URLSearchParams(location.search).get('sessionId');
    const restoredDraft = loadAnalyzeDraft();
    const homeSessionSettings = location.state?.sessionDefaults
      ? sanitizeAnalyzeSettings(location.state.sessionDefaults)
      : null;

    setSelectedCV(restoredDraft.selectedCV);
    setStructuredCVProfile(restoredDraft.structuredCVProfile || (restoredDraft.selectedCV ? buildCvReviewFormModel(restoredDraft.selectedCV) : null));
    setCvHumanReviewedFileId(restoredDraft.cvHumanReviewedFileId || '');
    setCvReviewStatus(restoredDraft.cvReviewStatus || 'unreviewed');
    setRawJD(restoredDraft.rawJD);
    setCompanyWebsiteUrl(restoredDraft.companyWebsiteUrl || '');
    setUserCompanyContext(restoredDraft.userCompanyContext || '');
    setStructuredJD(restoredDraft.structuredJD);
    setStructuredJDRubric(restoredDraft.structuredJDRubric);
    setSummarizedRawJD(restoredDraft.summarizedRawJD);
    setJdHumanReviewedRawJD(restoredDraft.jdHumanReviewedRawJD);
    setJdReviewStatus(restoredDraft.jdReviewStatus || 'unreviewed');
    setSettings(homeSessionSettings || restoredDraft.settings);
    setSessionMode(sanitizeAnalyzeMode(location.state?.sessionMode || restoredDraft.sessionMode));
    setActiveWorkflowStep(resolveDraftWorkflowStep(restoredDraft));

    const loadResumeSession = async () => {
      if (!resumeSessionId) {
        return;
      }

      try {
        const data = await getSession(resumeSessionId);
        if (!isActive) {
          return;
        }

        const session = data.session;
        if (session?.status === 'completed' && session?.hasReport) {
          navigate(`/report/${session.id}`, { replace: true });
          return;
        }

        if (session?.status && session.status !== 'ready') {
          navigate(`/interview/${session.id}`, { replace: true });
          return;
        }

        restoreReadySessionAnalysis(session);
      } catch (error) {
        if (isActive) {
          setPageStatus(buildStatusMessage('error', 'Could not restore analysis', error.message || 'Open the session from dashboard again.'));
        }
      }
    };

    getRecentCVs().then((items) => {
      if (isActive) setRecentCVs(items);
    }).catch(console.error);
    fetchSavedJDs().catch(console.error);
    loadResumeSession();

    return () => {
      isActive = false;
    };
  }, [location.search, location.state, navigate, restoreReadySessionAnalysis, fetchSavedJDs]);

  useEffect(() => {
    persistAnalyzeDraft({
      selectedCV,
      structuredCVProfile,
      cvHumanReviewedFileId,
      cvReviewStatus,
      rawJD,
      companyWebsiteUrl,
      userCompanyContext,
      structuredJD,
      structuredJDRubric,
      summarizedRawJD,
      jdHumanReviewedRawJD,
      jdReviewStatus,
      settings,
      sessionMode,
    });
  }, [selectedCV, structuredCVProfile, cvHumanReviewedFileId, cvReviewStatus, rawJD, companyWebsiteUrl, userCompanyContext, structuredJD, structuredJDRubric, summarizedRawJD, jdHumanReviewedRawJD, jdReviewStatus, settings, sessionMode]);

  const handleUpload = async (file) => {
    try {
      const uploadedCV = await uploadCV(file);
      resetAnalysisState();
      setSelectedCV(uploadedCV);
      setStructuredCVProfile(buildCvReviewFormModel(uploadedCV));
      setCvHumanReviewedFileId('');
      setCvReviewStatus('unreviewed');
      setActiveWorkflowStep(WORKFLOW_STEP_IDS.CV_REVIEW);
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
      setActiveWorkflowStep(WORKFLOW_STEP_IDS.CV_REVIEW);
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
        setActiveWorkflowStep(WORKFLOW_STEP_IDS.CV_UPLOAD);
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
    if (!hasCompanyContext) {
      setPageStatus(buildStatusMessage('info', 'Add company context', 'Provide the company website or a short manual company context before summarising the JD.'));
      return;
    }

    setIsSummarizingJD(true);

    try {
      const jdResponse = await paraphraseJD({ rawJD, companyWebsiteUrl, userCompanyContext });
      applyStructuredJD(jdResponse, rawJD);
      setActiveWorkflowStep(WORKFLOW_STEP_IDS.JD_REVIEW);
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
    setActiveWorkflowStep(WORKFLOW_STEP_IDS.SESSION_SETUP);
  };

  const handleSessionModeChange = (nextMode) => {
    resetAnalysisState();
    setSessionMode(sanitizeAnalyzeMode(nextMode));
    setActiveWorkflowStep(WORKFLOW_STEP_IDS.SESSION_SETUP);
  };

  const handleStructuredJDRubricChange = (nextRubric) => {
    const syncedRequirements = syncCanonicalRequirementsFromSections(nextRubric);
    const updatedRubric = {
      ...nextRubric,
      requirements: syncedRequirements,
    };
    const reviewedRubric = stampHumanReviewMetadata(updatedRubric, 'edited');
    setStructuredJDRubric(reviewedRubric);
    setStructuredJD(formatStructuredJobDescription(reviewedRubric));
    setJdReviewStatus('edited');
    setJdHumanReviewedRawJD('');
    resetAnalysisState();
    setActiveWorkflowStep(WORKFLOW_STEP_IDS.JD_REVIEW);
  };

  const handleStructuredCVProfileChange = (nextProfile) => {
    setStructuredCVProfile(nextProfile);
    setCvReviewStatus('edited');
    setCvHumanReviewedFileId('');
    resetAnalysisState();
    setActiveWorkflowStep(WORKFLOW_STEP_IDS.CV_REVIEW);
  };

  const handleConfirmJDSummary = async () => {
    if (!hasCurrentJDSummary) {
      setPageStatus(buildStatusMessage('error', 'Summarise current JD first', 'The JD text has changed. Summarise it again before confirming.'));
      return;
    }

    // Validation check for required fields
    const rubric = structuredJDRubric || {};
    const overview = rubric.jobOverview || {};
    const sections = rubric.sections || {};
    const roleFit = rubric.roleFit || {};

    const missingFields = [];
    if (!String(overview.title || rubric.title || '').trim()) missingFields.push('Role title');
    if (!String(overview.companyName || rubric.companyName || '').trim()) missingFields.push('Company');
    if (!(sections.responsibilities || rubric.roleSummary || []).length) missingFields.push('Responsibilities');
    if (!(sections.mustHaveRequirements || rubric.mustHaveRequirements || []).length) missingFields.push('Must-have requirements');
    if (!String(roleFit.companyUnderstanding?.summary || '').trim()) missingFields.push('Company understanding');
    if (!(roleFit.roleIntent?.items || []).length) missingFields.push('Role intent priorities');

    if (missingFields.length > 0) {
      setPageStatus(buildStatusMessage('error', 'Required fields missing', `Please fill in the following required fields before marking as reviewed: ${missingFields.join(', ')}.`));
      return;
    }

    const syncedRequirements = syncCanonicalRequirementsFromSections(structuredJDRubric);
    const rubricWithReqs = {
      ...structuredJDRubric,
      requirements: syncedRequirements,
    };
    let verifiedRubric = stampHumanReviewMetadata(rubricWithReqs, 'verified');
    if (verifiedRubric.roleFit?.jdFingerprint) {
      try {
        const confirmed = await confirmRoleFitReview({
          jdFingerprint: verifiedRubric.roleFit.jdFingerprint,
          baseVersion: verifiedRubric.roleFit.review?.baseVersion,
          jdRubric: verifiedRubric,
        });
        verifiedRubric = {
          ...verifiedRubric,
          roleFit: confirmed.roleFit || verifiedRubric.roleFit,
        };
      } catch (error) {
        setPageStatus(buildStatusMessage('error', 'JD review conflict', error.message || 'Re-summarise the JD and review the latest version.'));
        return;
      }
    }

    setStructuredJDRubric(verifiedRubric);
    setStructuredJD(formatStructuredJobDescription(verifiedRubric));
    setJdHumanReviewedRawJD(rawJD);
    setJdReviewStatus('verified');
    setActiveWorkflowStep(WORKFLOW_STEP_IDS.SESSION_SETUP);
    try {
      const enrichment = await startCompanyValuesEnrichment({
        rawJD,
        jdRubric: verifiedRubric,
        companyWebsiteUrl: verifiedRubric.jobOverview?.companyWebsiteUrl || '',
      });
      const backgroundMessage = enrichment?.searchQueued
        ? enrichment.expectedSearchProvider === 'manual_website'
          ? 'Company-specific coaching will use the provided company website.'
          : 'Company-specific coaching is being prepared with Serper search in the background.'
        : 'Company-specific search could not start because no company name or website was available.';
      setPageStatus(buildStatusMessage('success', 'JD summary reviewed', `KiwiCoach will use this human-reviewed JD summary for CV-JD matching. ${backgroundMessage}`));
    } catch (error) {
      setPageStatus(buildStatusMessage('warning', 'JD summary reviewed', `The JD is ready for matching, but company-specific coaching search did not start: ${error.message}`));
    }
    fetchSavedJDs().catch(console.error);
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
      setActiveWorkflowStep(WORKFLOW_STEP_IDS.JD_INPUT);
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
    setActiveWorkflowStep(WORKFLOW_STEP_IDS.MATCH_RESULT);

    try {
      const finalStructuredJDRubric = stampHumanReviewMetadata(structuredJDRubric, isJdHumanVerified ? 'verified' : 'unreviewed');
      const finalStructuredJD = formatStructuredJobDescription(finalStructuredJDRubric);

      await runMatchAnalysis({
        matchInput: {
          cvId: selectedCV.id,
          rawJD,
          jdRubric: finalStructuredJDRubric,
          settings,
        },
        planInput: {
          cvId: selectedCV.id,
          rawJD,
          jdText: finalStructuredJD,
          jdRubric: finalStructuredJDRubric,
          settings,
          sessionSetup: buildSessionSetupPayload(settings, sessionMode),
          mode: sessionMode,
        },
      });

      setActiveWorkflowStep(WORKFLOW_STEP_IDS.MATCH_RESULT);
      const modeLabel = sessionMode === 'voice' ? 'voice' : 'text';
      setPageStatus(buildStatusMessage('success', 'Match analysis complete', `Review the score breakdown before continuing to the ${modeLabel} interview session.`));
    } catch (error) {
      console.error(error);
      if (error.phase === 'plan') {
        setPageStatus(buildStatusMessage(
          'error',
          'Interview preparation failed',
          `${error.message} Your Match is saved and does not need to run again.`,
        ));
      } else {
        setPageStatus(buildStatusMessage('error', 'Analysis failed', error.message));
      }
    } finally {
      isGeneratingPlanRef.current = false;
    }
  };

  const handleRetryPlan = async () => {
    if (isGeneratingPlanRef.current) {
      return;
    }

    isGeneratingPlanRef.current = true;
    try {
      await retryPlan();
      const modeLabel = sessionMode === 'voice' ? 'voice' : 'text';
      setPageStatus(buildStatusMessage(
        'success',
        'Interview preparation ready',
        `Your saved Match is unchanged. Continue to the ${modeLabel} interview session when you are ready.`,
      ));
    } catch (error) {
      setPageStatus(buildStatusMessage(
        'error',
        'Interview preparation failed',
        `${error.message} Your Match is still saved.`,
      ));
    } finally {
      isGeneratingPlanRef.current = false;
    }
  };

  const isCvWorkflowStep = [WORKFLOW_STEP_IDS.CV_UPLOAD, WORKFLOW_STEP_IDS.CV_REVIEW].includes(activeWorkflowStep);
  const isJdWorkflowStep = [WORKFLOW_STEP_IDS.JD_INPUT, WORKFLOW_STEP_IDS.JD_REVIEW].includes(activeWorkflowStep);
  const isSetupWorkflowStep = activeWorkflowStep === WORKFLOW_STEP_IDS.SESSION_SETUP;
  const isMatchWorkflowStep = activeWorkflowStep === WORKFLOW_STEP_IDS.MATCH_RESULT;

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <AppHeader>
        <StepProgress currentStep={currentStep} steps={workflowHeaderSteps(sessionMode)} />
      </AppHeader>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <div className="space-y-5 sm:space-y-6">
          <div id="tour-analyze-workflow">
            <AnalysisWorkflowShell
              steps={workflowSteps}
              activeStepId={activeWorkflowStep}
              onStepChange={handleWorkflowStepChange}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8">
            <div className="space-y-5 sm:space-y-6 xl:space-y-8">
              {isCvWorkflowStep ? (
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
              ) : null}

              {isJdWorkflowStep ? (
                <div id="tour-analyze-jd">
                  <JobContextCard
                    rawJD={rawJD}
                    setRawJD={handleRawJDChange}
                    companyWebsiteUrl={companyWebsiteUrl}
                    setCompanyWebsiteUrl={handleCompanyContextChange(setCompanyWebsiteUrl)}
                    userCompanyContext={userCompanyContext}
                    setUserCompanyContext={handleCompanyContextChange(setUserCompanyContext)}
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
                    savedJDs={savedJDs}
                    isLoadingSavedJDs={isLoadingSavedJDs}
                    onSelectSavedJD={handleSelectSavedJD}
                  />
                </div>
              ) : null}

              {isSetupWorkflowStep ? (
                <NZSettingsCard
                  settings={settings}
                  setSettings={handleSettingsChange}
                  sessionMode={sessionMode}
                  setSessionMode={handleSessionModeChange}
                  voiceDeviceCheck={voiceDeviceCheck}
                  setVoiceDeviceCheck={setVoiceDeviceCheck}
                />
              ) : null}

              {isMatchWorkflowStep ? (
                <AnalysisStatusCard
                  status={analysisStatus}
                  matchRate={matchRate}
                  analysisResult={analysisResult}
                  questionPoolInfo={questionPoolInfo}
                  planStatus={planStatus}
                  progressStages={progressStages}
                  currentStage={currentStage}
                />
              ) : null}
            </div>

            <div className="space-y-5 sm:space-y-6 xl:sticky xl:top-24 xl:self-start">
              {pageStatus ? (
                <StatusBanner
                  variant={pageStatus.type}
                  title={pageStatus.title}
                  message={pageStatus.message}
                />
              ) : null}

              <div id="tour-analyze-actions">
                <AnalyzeActionsCard
                  analysisStatus={displayedAnalysisStatus}
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
                  onRetryPlan={handleRetryPlan}
                  onStartInterview={handleStartInterview}
                  sessionMode={sessionMode}
                  isVoiceReady={isVoiceReady}
                  planStatus={planStatus}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
