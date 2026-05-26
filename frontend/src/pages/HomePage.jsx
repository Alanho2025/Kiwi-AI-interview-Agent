/**
 * File responsibility: Page container.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: HomePage should orchestrate the screen and compose child sections without burying domain rules in JSX.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrivacySecurityCard } from '../components/home/PrivacySecurityCard.jsx';
import { HomeHeader } from '../components/home/HomeHeader.jsx';
import { QuickTipsCard } from '../components/home/QuickTipsCard.jsx';
import { TokenUsageSummary } from '../components/home/TokenUsageSummary.jsx';
import { RecentActivitySection } from '../components/home/RecentActivitySection.jsx';
import { SessionHistorySection } from '../components/home/SessionHistorySection.jsx';
import { StartSessionCard } from '../components/home/StartSessionCard.jsx';
import { StatsSection } from '../components/home/StatsSection.jsx';
import { getCurrentUser, logoutFromSession } from '../api/authApi.js';
import { getSessionHistory, deleteSession } from '../api/sessionApi.js';
import {
  buildHomepageStats,
  buildRecentActivity,
  buildSessionHistoryRows,
  getUserInitials,
  resolveSessionOpenPath,
} from '../utils/sessionDisplay.js';
import {
  DEFAULT_SESSION_SETTINGS,
  loadSessionDefaults,
  resetSessionDefaults,
  saveSessionDefaults,
  settingsSummary,
} from '../utils/sessionSettings.js';
import { useTour } from '../contexts/TourContext.jsx';

const HOME_TOUR_STEPS = [
  {
    target: 'body',
    content: 'Welcome to Kiwi Voice Coach! Let\'s take a quick tour to show you how to crush your next Tech Interview.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#tour-session-history',
    content: 'All your past sessions are saved here. You can revisit your feedback and track your progress over time.',
    placement: 'top',
  },
  {
    target: '#tour-start-card',
    content: 'Here is where you begin. Select Voice or Text mode, and click Start to set up your session. Go ahead and click it!',
    placement: 'bottom',
    spotlightClicks: true, // Allow clicking the start button under the spotlight
  }
];

export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: 'Guest User', email: 'guest@kiwi.nz', picture: '', loginProvider: '' });
  const [isAvatarBroken, setIsAvatarBroken] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showSessionSettings, setShowSessionSettings] = useState(false);
  const [sessionDefaults, setSessionDefaults] = useState(DEFAULT_SESSION_SETTINGS);
  const [settingsSaved, setSettingsSaved] = useState('');
  const [voiceStartWarning, setVoiceStartWarning] = useState('');
  const { startTour, globalTourStep, startGlobalTour } = useTour();

  const handleStartTour = () => {
    startGlobalTour();
  };

  useEffect(() => {
    // If global tour is on 'home' step, run Home steps
    if (globalTourStep === 'home') {
      setTimeout(() => {
        startTour(HOME_TOUR_STEPS);
      }, 500);
    }
  }, [globalTourStep, startTour]);

  useEffect(() => {
    // Auto-start for brand new users
    if (localStorage.getItem('kiwi_tour_completed') !== 'true') {
      localStorage.setItem('kiwi_tour_completed', 'true');
      startGlobalTour();
    }
  }, [startGlobalTour]);

  useEffect(() => {
    let isActive = true;

    const loadHomeState = async () => {
      try {
        const data = await getCurrentUser();
        if (!isActive) {
          return;
        }

        const currentUser = data.user || {};
        setUser({
          name: currentUser.full_name || 'Guest User',
          email: currentUser.email || 'guest@kiwi.nz',
          picture: '',
          loginProvider: 'google',
        });
        setIsAvatarBroken(false);
      } catch (_error) {
        if (isActive) {
          navigate('/login', { replace: true });
        }
        return;
      }

      if (isActive) {
        setSessionDefaults(loadSessionDefaults());
      }
    };

    loadHomeState();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        const data = await getSessionHistory(20);
        setSessionHistory(data.sessions || []);
      } catch (error) {
        console.error('Failed to load session history', error);
        setSessionHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, []);

  const persistSessionDefaults = (nextDefaults, message) => {
    const safeDefaults = saveSessionDefaults(nextDefaults);
    setSessionDefaults(safeDefaults);
    setSettingsSaved(message);
    window.setTimeout(() => setSettingsSaved(''), 1800);
  };

  const handleSaveSessionDefaults = () => {
    persistSessionDefaults(sessionDefaults, 'Defaults saved');
  };

  const handleResetSessionDefaults = () => {
    persistSessionDefaults(resetSessionDefaults(), 'Defaults reset');
  };

  const handleSessionDefaultsChange = (field, value) => {
    setVoiceStartWarning('');
    setSessionDefaults((current) => ({ ...current, [field]: value }));
  };

  const handleSignOut = async () => {
    try {
      await logoutFromSession();
    } catch (error) {
      console.error('Failed to clear backend session', error);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleOpenSession = (session) => {
    navigate(resolveSessionOpenPath(session));
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId);
      // Refresh the session history list after deletion
      const data = await getSessionHistory(20);
      setSessionHistory(data.sessions || []);
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error; // Re-throw to let SessionHistorySection handle the error
    }
  };

  const handleStartInterview = (sessionMode) => {
    const safeDefaults = saveSessionDefaults(sessionDefaults);
    setSessionDefaults(safeDefaults);
    navigate('/analysis', { state: { sessionMode, sessionDefaults: safeDefaults } });
  };

  const stats = buildHomepageStats(sessionHistory, historyLoading);
  const recentActivity = buildRecentActivity(sessionHistory);
  const sessionHistoryRows = buildSessionHistoryRows(sessionHistory);
  const summary = settingsSummary(sessionDefaults);
  const userInitials = getUserInitials(user.name);

  return (
    <div className="relative min-h-screen overflow-hidden pb-16" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Floating ambient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full blur-[120px] animate-float" style={{ background: 'var(--orb-1)' }} />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full blur-[100px] animate-float-slow" style={{ background: 'var(--orb-2)' }} />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-[80px] animate-float" style={{ background: 'var(--orb-3)', animationDelay: '3s' }} />

      <HomeHeader
        user={user}
        isAvatarBroken={isAvatarBroken}
        userInitials={userInitials}
        onAvatarError={() => setIsAvatarBroken(true)}
        onSignOut={handleSignOut}
        onStartTour={handleStartTour}
        onOpenOps={() => navigate('/ops-lite')}
      />

      <main className="relative mx-auto mt-8 sm:mt-10 grid max-w-[1400px] grid-cols-1 gap-6 px-4 sm:px-8 lg:px-10 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8 animate-fade-in-up">
          <div id="tour-start-card">
            <StartSessionCard
              summary={summary}
              showSessionSettings={showSessionSettings}
              sessionDefaults={sessionDefaults}
              settingsSaved={settingsSaved}
              voiceStartWarning={voiceStartWarning}
              onOpenTextInterview={() => handleStartInterview('text')}
              onOpenVoiceInterview={() => handleStartInterview('voice')}
              onToggleSettings={() => setShowSessionSettings((current) => !current)}
              onChangeDefaults={handleSessionDefaultsChange}
              onSaveDefaults={handleSaveSessionDefaults}
              onResetDefaults={handleResetSessionDefaults}
            />
          </div>
          <StatsSection stats={stats} />
          <div id="tour-session-history">
            <SessionHistorySection
              historyLoading={historyLoading}
              sessionHistoryRows={sessionHistoryRows}
              onOpenSession={handleOpenSession}
              onDeleteSession={handleDeleteSession}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:col-span-4 xl:flex xl:flex-col xl:gap-6 animate-fade-in-up animate-delay-200">
          <RecentActivitySection
            historyLoading={historyLoading}
            recentActivity={recentActivity}
            completedCount={stats.completedSessions.length}
          />
          <QuickTipsCard />
          <TokenUsageSummary />
          <PrivacySecurityCard email={user.email} loginProvider={user.loginProvider} />
        </div>
      </main>
    </div>
  );
}
