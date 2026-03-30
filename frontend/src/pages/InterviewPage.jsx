import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { CandidateCard } from '../components/interview/CandidateCard.jsx';
import { TipCard } from '../components/interview/TipCard.jsx';
import { SessionInfoCard } from '../components/interview/SessionInfoCard.jsx';
import { InterviewChatPanel } from '../components/interview/InterviewChatPanel.jsx';
import { TranscriptPanel } from '../components/interview/TranscriptPanel.jsx';
import { TextBackupCard } from '../components/interview/TextBackupCard.jsx';
import { startInterview, replyInterview, pauseInterview, resumeInterview, repeatQuestion, endInterview } from '../api/interviewApi.js';
import { getSession } from '../api/sessionApi.js';
import { exportTranscript } from '../api/exportApi.js';
import { formatDuration } from '../utils/formatters.js';

export function InterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timerOffset, setTimerOffset] = useState(0);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await getSession(sessionId);
        setSession(data.session);
        if (data.session.status === 'ready') {
          const startData = await startInterview(sessionId);
          setSession(startData.session);
        }
      } catch (error) {
        console.error(error);
        alert('Failed to load session');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId, navigate]);

  useEffect(() => {
    let interval;
    if (session && session.status === 'in_progress') {
      setTimerOffset(0);
      interval = setInterval(() => {
        setTimerOffset((value) => value + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [session]);

  const elapsedSeconds = (session?.elapsedSeconds || 0) + (session?.status === 'in_progress' ? timerOffset : 0);

  const handleReply = async (answer) => {
    if (isSubmitting || !answer?.trim()) return;
    setIsSubmitting(true);
    
    // Save previous session state for rollback if needed
    const previousSession = { ...session };
    
    try {
      // Optimistically update the session with the user's answer
      setSession(prev => ({
        ...prev,
        transcript: [
          ...prev.transcript,
          { role: 'user', text: answer.trim(), timestamp: new Date().toISOString() }
        ]
      }));

      const data = await replyInterview(sessionId, answer.trim());
      setSession(data.session);
    } catch (error) {
      setSession(previousSession);
      alert('Failed to send reply: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async () => {
    try {
      if (session.status === 'paused') {
        // Resume
        const data = await resumeInterview(sessionId);
        setSession(data.session);
      } else {
        const data = await pauseInterview(sessionId);
        setSession(data.session);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRepeat = async () => {
    try {
      const data = await repeatQuestion(sessionId);
      if (data.question) {
        setSession((prev) => {
          if (!prev) {
            return prev;
          }

          const lastMessage = prev.transcript[prev.transcript.length - 1];
          if (lastMessage?.role === 'ai' && lastMessage.text === data.question) {
            return prev;
          }

          return {
            ...prev,
            transcript: [
              ...prev.transcript,
              { role: 'ai', text: data.question, timestamp: new Date().toISOString() },
            ],
          };
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleEnd = async () => {
    if (!window.confirm('Are you sure you want to end the interview?')) return;
    try {
      const data = await endInterview(sessionId);
      setSession(data.session);
      alert('Interview ended. You can now review your transcript.');
    } catch (error) {
      console.error(error);
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportTranscript(sessionId);
      const text = result.transcriptText;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${sessionId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading session...</div>;
  if (!session) return <div className="min-h-screen flex items-center justify-center">Session not found.</div>;

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col h-screen overflow-hidden">
      <AppHeader>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Target Role</span>
            <span className="px-3 py-1 bg-[#e6f7f0] text-[#2eb886] text-sm font-medium rounded-full">
              {session.targetRole}
            </span>
          </div>
          <div className="text-lg font-semibold text-gray-900">Mock Interview</div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Timer</p>
              <p className="text-lg font-mono font-medium text-gray-900">{formatDuration(elapsedSeconds)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Progress</p>
              <p className="text-sm font-medium text-gray-900">Question {session.currentQuestionIndex} of {session.totalQuestions}</p>
            </div>
          </div>
        </div>
      </AppHeader>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-12 gap-6 h-[calc(100vh-64px)] overflow-hidden min-h-0">
        {/* Left Panel */}
        <div className="col-span-3 flex flex-col gap-6 overflow-y-auto pr-2 pb-6 min-h-0">
          <CandidateCard 
            candidateName={session.candidateName} 
            status={session.status === 'in_progress' ? 'Live' : session.status} 
            planPreview={session.analysisResult?.planPreview}
          />
          <TipCard 
            title="Interview Focus" 
            description={session.analysisResult?.interviewFocus?.length > 0 
              ? `Focusing on: ${session.analysisResult.interviewFocus.join(', ')}.${session.settings?.enableNZCultureFit ? ' Remember to highlight teamwork for NZ culture.' : ''} Use the STAR technique to answer questions clearly.` 
              : `${session.settings?.enableNZCultureFit ? 'Remember to highlight teamwork for NZ culture. ' : ''}Use the STAR technique to answer questions clearly.`} 
          />
          <SessionInfoCard totalQuestions={session.totalQuestions} seniorityLevel={session.settings?.seniorityLevel} />
        </div>

        {/* Center Panel */}
        <div className="col-span-6 flex flex-col h-full pb-6 min-h-0">
          <InterviewChatPanel 
            transcript={session.transcript}
            onReply={handleReply}
            onPause={handlePause}
            onRepeat={handleRepeat}
            onEnd={handleEnd}
            isPaused={session.status === 'paused'}
            isSubmitting={isSubmitting}
            candidateName={session.candidateName}
          />
        </div>

        {/* Right Panel */}
        <div className="col-span-3 flex flex-col gap-6 h-full pb-6 min-h-0">
          <div className="flex-1 overflow-hidden min-h-0">
            <TranscriptPanel transcript={session.transcript} onExport={handleExport} candidateName={session.candidateName} />
          </div>
          <div className="shrink-0">
            <TextBackupCard onSubmit={handleReply} disabled={isSubmitting || session.status === 'paused'} />
          </div>
        </div>
      </main>
    </div>
  );
}
