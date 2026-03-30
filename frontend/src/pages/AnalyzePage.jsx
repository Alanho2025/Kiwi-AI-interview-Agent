import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { StepProgress } from '../components/layout/StepProgress.jsx';
import { CVManagementCard } from '../components/analyze/CVManagementCard.jsx';
import { JobContextCard } from '../components/analyze/JobContextCard.jsx';
import { NZSettingsCard } from '../components/analyze/NZSettingsCard.jsx';
import { AnalysisStatusCard } from '../components/analyze/AnalysisStatusCard.jsx';
import { Button } from '../components/common/Button.jsx';
import { uploadCV, getRecentCVs, selectCV } from '../api/uploadApi.js';
import { paraphraseJD, matchCV, generateInterviewPlan } from '../api/analyzeApi.js';

const ANALYZE_DRAFT_KEY = 'kiwi-analyze-draft';

export function AnalyzePage() {
  const navigate = useNavigate();
  
  const [recentCVs, setRecentCVs] = useState([]);
  const [selectedCV, setSelectedCV] = useState(null);
  const [rawJD, setRawJD] = useState('');
  const [structuredJD, setStructuredJD] = useState('');
  
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
      settings,
    }));
  }, [selectedCV, rawJD, structuredJD, settings]);

  const handleUpload = async (file) => {
    try {
      const res = await uploadCV(file);
      setSelectedCV(res);
      // Refresh recent CVs
      const updatedRecent = await getRecentCVs();
      setRecentCVs(updatedRecent);
      return true;
    } catch (error) {
      alert(error.message);
      return false;
    }
  };

  const handleSelectRecent = async (cvId) => {
    try {
      const res = await selectCV(cvId);
      setSelectedCV(res);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSummarizeJD = async () => {
    if (!rawJD.trim()) return;
    setIsSummarizingJD(true);
    setAnalysisStatus('summarizing');
    try {
      const jdRes = await paraphraseJD(rawJD);
      setStructuredJD(jdRes.structuredJD);
      setAnalysisStatus('idle');
    } catch (error) {
      alert('Failed to summarize JD: ' + error.message);
      setAnalysisStatus('error');
    } finally {
      setIsSummarizingJD(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedCV || !rawJD) {
      alert('Please provide both a CV and a Job Description.');
      return;
    }

    setAnalysisStatus('matching');
    
    try {
      let finalStructuredJD = structuredJD;
      // 1. Paraphrase JD if not already done
      if (!finalStructuredJD) {
        const jdRes = await paraphraseJD(rawJD);
        finalStructuredJD = jdRes.structuredJD;
        setStructuredJD(finalStructuredJD);
      }

      // 2. Match CV
      const matchRes = await matchCV(selectedCV.text, finalStructuredJD, settings);
      setAnalysisResult(matchRes);
      if (matchRes && matchRes.matchScore) {
        setMatchRate(matchRes.matchScore);
      }

      // 3. Generate Plan
      const planRes = await generateInterviewPlan(selectedCV.text, finalStructuredJD, settings, matchRes);
      
      setGeneratedSessionId(planRes.sessionId);
      setAnalysisStatus('success');

    } catch (error) {
      console.error(error);
      setAnalysisStatus('error');
      alert('Analysis failed: ' + error.message);
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
            />
            <JobContextCard 
              rawJD={rawJD} 
              setRawJD={setRawJD} 
              structuredJD={structuredJD}
              onSummarize={handleSummarizeJD}
              isSummarizing={isSummarizingJD}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            <NZSettingsCard 
              settings={settings} 
              setSettings={setSettings} 
            />
            <AnalysisStatusCard 
              status={analysisStatus} 
              matchRate={matchRate}
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
                  Start Interview
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  size="lg" 
                  className="w-full"
                  onClick={handleGeneratePlan}
                  disabled={!selectedCV || !rawJD || analysisStatus === 'matching' || analysisStatus === 'summarizing'}
                >
                  Generate Interview Plan
                </Button>
              )}
              <Button 
                variant="secondary" 
                size="lg" 
                className="w-full"
                onClick={() => {
                  window.localStorage.setItem(ANALYZE_DRAFT_KEY, JSON.stringify({
                    selectedCV,
                    rawJD,
                    structuredJD,
                    settings,
                  }));
                }}
              >
                Save & Continue Later
              </Button>
              <p className="text-xs text-gray-500 text-center mt-2">
                By generating, you agree to Kiwi Voice Coach's NZ privacy-compliant processing of uploaded materials.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
