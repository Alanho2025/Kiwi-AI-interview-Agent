import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { StepProgress } from '../components/layout/StepProgress.jsx';
import { CVManagementCard } from '../components/analyze/CVManagementCard.jsx';
import { JobContextCard } from '../components/analyze/JobContextCard.jsx';
import { NZSettingsCard } from '../components/analyze/NZSettingsCard.jsx';
import { AnalysisStatusCard } from '../components/analyze/AnalysisStatusCard.jsx';
import { Button } from '../components/common/Button.jsx';
import { StatusBanner } from '../components/common/StatusBanner.jsx';
import { uploadCV, getRecentCVs, selectCV } from '../api/uploadApi.js';
import { paraphraseJD, matchCV, generateInterviewPlan } from '../api/analyzeApi.js';

const ANALYZE_DRAFT_KEY = 'kiwi-analyze-draft';

export function AnalyzePage() {
  const navigate = useNavigate();
  
  const [recentCVs, setRecentCVs] = useState([]);
  const [selectedCV, setSelectedCV] = useState(null);
  const [rawJD, setRawJD] = useState('');
  const [structuredJD, setStructuredJD] = useState('');
  const [structuredJDRubric, setStructuredJDRubric] = useState(null);
  
  const [settings, setSettings] = useState({
    seniorityLevel: 'Junior/Grad',
    enableNZCultureFit: false,
    focusArea: 'Combined'
  });
  
  const [analysisStatus, setAnalysisStatus] = useState('idle'); // idle, summarizing, matching, success, error
  const [analysisResult, setAnalysisResult] = useState(null);
  const [matchRate, setMatchRate] = useState(null);
  const [generatedSessionId, setGeneratedSessionId] = useState(null);
  const [isSummarizingJD, setIsSummarizingJD] = useState(false);
  const [pageStatus, setPageStatus] = useState(null);

  let currentStep = 1;
  if (analysisStatus === 'matching' || analysisStatus === 'summarizing') {
    currentStep = 2;
  } else if (analysisStatus === 'success') {
    currentStep = 3;
  }

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(ANALYZE_DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setSelectedCV(parsed.selectedCV || null);
        setRawJD(parsed.rawJD || '');
        setStructuredJD(parsed.structuredJD || '');
        setStructuredJDRubric(parsed.structuredJDRubric || null);
        setSettings(parsed.settings || {
          seniorityLevel: 'Junior/Grad',
          enableNZCultureFit: false,
          focusArea: 'Combined'
        });
      } catch (error) {
        console.error('Failed to restore analyze draft', error);
      }
    }

    // Fetch recent CVs on mount
    getRecentCVs().then(setRecentCVs).catch(console.error);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ANALYZE_DRAFT_KEY, JSON.stringify({
      selectedCV,
      rawJD,
      structuredJD,
      structuredJDRubric,
      settings,
    }));
  }, [selectedCV, rawJD, structuredJD, structuredJDRubric, settings]);

  const handleUpload = async (file) => {
    try {
      const res = await uploadCV(file);
      setSelectedCV(res);
      setPageStatus({
        type: 'success',
        title: 'CV uploaded',
        message: `${res.name} was parsed and is ready for matching.`,
      });
      // Refresh recent CVs
      const updatedRecent = await getRecentCVs();
      setRecentCVs(updatedRecent);
      return true;
    } catch (error) {
      setPageStatus({
        type: 'error',
        title: 'Upload failed',
        message: error.message,
      });
      return false;
    }
  };

  const handleSelectRecent = async (cvId) => {
    try {
      const res = await selectCV(cvId);
      setSelectedCV(res);
      setPageStatus({
        type: 'info',
        title: 'CV selected',
        message: `${res.name} is now the active CV for JD matching.`,
      });
    } catch (error) {
      setPageStatus({
        type: 'error',
        title: 'Could not select CV',
        message: error.message,
      });
    }
  };

  const handleSummarizeJD = async () => {
    if (!rawJD.trim()) return;
    setIsSummarizingJD(true);
    setAnalysisStatus('summarizing');
    try {
      const jdRes = await paraphraseJD(rawJD);
      setStructuredJD(jdRes.structuredJD);
      setStructuredJDRubric(jdRes.structuredJDRubric);
      setAnalysisStatus('idle');
      setPageStatus({
        type: 'success',
        title: 'JD summary ready',
        message: 'The current JD summary will be used for CV matching.',
      });
    } catch (error) {
      setPageStatus({
        type: 'error',
        title: 'JD summary failed',
        message: error.message,
      });
      setAnalysisStatus('error');
    } finally {
      setIsSummarizingJD(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedCV || !rawJD) {
      setPageStatus({
        type: 'error',
        title: 'Missing input',
        message: 'Please provide both a CV and a job description.',
      });
      return;
    }

    setAnalysisStatus('matching');
    
    try {
      let finalStructuredJD = structuredJD;
      let finalStructuredJDRubric = structuredJDRubric;
      // 1. Paraphrase JD if not already done
      if (!finalStructuredJD || !finalStructuredJDRubric) {
        const jdRes = await paraphraseJD(rawJD);
        finalStructuredJD = jdRes.structuredJD;
        finalStructuredJDRubric = jdRes.structuredJDRubric;
        setStructuredJD(finalStructuredJD);
        setStructuredJDRubric(finalStructuredJDRubric);
      }

      // 2. Match CV
      const matchRes = await matchCV(selectedCV.text, rawJD, finalStructuredJDRubric, settings);
      setAnalysisResult(matchRes);
      if (matchRes && matchRes.matchScore) {
        setMatchRate(matchRes.matchScore);
      }

      // 3. Generate Plan
      const planRes = await generateInterviewPlan(selectedCV.text, finalStructuredJD, settings, matchRes);
      
      setGeneratedSessionId(planRes.sessionId);
      setAnalysisStatus('success');
      setPageStatus({
        type: 'success',
        title: 'Match analysis complete',
        message: 'Review the score breakdown before starting the text interview.',
      });

    } catch (error) {
      console.error(error);
      setAnalysisStatus('error');
      setPageStatus({
        type: 'error',
        title: 'Analysis failed',
        message: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">
      <AppHeader>
        <StepProgress currentStep={currentStep} />
      </AppHeader>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            <CVManagementCard 
              onUpload={handleUpload} 
              recentCVs={recentCVs} 
              onSelectRecent={handleSelectRecent} 
              validationMessage={pageStatus?.type === 'error' && pageStatus.title === 'Upload failed' ? pageStatus.message : null}
            />
            <JobContextCard 
              rawJD={rawJD} 
              setRawJD={setRawJD} 
              structuredJD={structuredJD}
              structuredJDRubric={structuredJDRubric}
              onSummarize={handleSummarizeJD}
              isSummarizing={isSummarizingJD}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {pageStatus ? (
              <StatusBanner
                variant={pageStatus.type}
                title={pageStatus.title}
                message={pageStatus.message}
              />
            ) : null}
            <NZSettingsCard 
              settings={settings} 
              setSettings={setSettings} 
            />
            <AnalysisStatusCard 
              status={analysisStatus} 
              matchRate={matchRate}
              analysisResult={analysisResult}
            />

            {/* Action Buttons */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col gap-4">
              {analysisStatus === 'success' && generatedSessionId ? (
                <Button 
                  variant="primary" 
                  size="lg" 
                  className="w-full"
                  onClick={() => navigate(`/interview/${generatedSessionId}`)}
                >
                  Start Text Interview
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  size="lg" 
                  className="w-full"
                  onClick={handleGeneratePlan}
                  disabled={!selectedCV || !rawJD || analysisStatus === 'matching' || analysisStatus === 'summarizing'}
                >
                  Generate Match Analysis
                </Button>
              )}
              <p className="text-xs text-gray-500 text-center mt-2">
                Current scope: CV upload, JD summary, CV to JD match score, and text interview.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
