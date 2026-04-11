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
import { RecentActivitySection } from '../components/home/RecentActivitySection.jsx';
import { SessionHistorySection } from '../components/home/SessionHistorySection.jsx';
import { StartSessionCard } from '../components/home/StartSessionCard.jsx';
import { StatsSection } from '../components/home/StatsSection.jsx';
import { logoutFromSession } from '../api/authApi.js';
import { getSessionHistory } from '../api/sessionApi.js';
import { clearStoredAuthSession, getStoredAuthSession } from '../utils/authSession.js';
import {
  buildHomepageStats,
  buildRecentActivity,
  buildSessionHistoryRows,
  DEFAULT_SESSION_SETTINGS,
  getUserInitials,
  HOME_SESSION_DEFAULTS_KEY,
  parseStoredSessionDefaults,
  settingsSummary,
} from '../utils/sessionDisplay.js';

export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: 'Guest User', email: 'guest@kiwi.nz', picture: '', loginProvider: '' });
  const [isAvatarBroken, setIsAvatarBroken] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showSessionSettings, setShowSessionSettings] = useState(false);
  const [sessionDefaults, setSessionDefaults] = useState(DEFAULT_SESSION_SETTINGS);
  const [settingsSaved, setSettingsSaved] = useState('');

  useEffect(() => {
    const savedSession = getStoredAuthSession();
    if (!savedSession) {
      navigate('/login', { replace: true });
      return;
    }

    setUser({
      name: savedSession.name || 'Guest User',
      email: savedSession.email || 'guest@kiwi.nz',
      picture: savedSession.picture || '',
      loginProvider: savedSession.loginProvider || '',
    });
    setIsAvatarBroken(false);

    try {
      const rawDefaults = window.localStorage.getItem(HOME_SESSION_DEFAULTS_KEY);
      setSessionDefaults(parseStoredSessionDefaults(rawDefaults));
    } catch (error) {
      console.error('Failed to load homepage session defaults', error);
    }
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
    setSessionDefaults(nextDefaults);
    window.localStorage.setItem(HOME_SESSION_DEFAULTS_KEY, JSON.stringify(nextDefaults));
    setSettingsSaved(message);
    window.setTimeout(() => setSettingsSaved(''), 1800);
  };

  const handleSaveSessionDefaults = () => {
    persistSessionDefaults(sessionDefaults, 'Defaults saved');
  };

  const handleResetSessionDefaults = () => {
    persistSessionDefaults(DEFAULT_SESSION_SETTINGS, 'Defaults reset');
  };

  const handleSessionDefaultsChange = (field, value) => {
    setSessionDefaults((current) => ({ ...current, [field]: value }));
  };

  const handleSignOut = async () => {
    try {
      await logoutFromSession();
    } catch (error) {
      console.error('Failed to clear backend session', error);
    } finally {
      clearStoredAuthSession();
      navigate('/login', { replace: true });
    }
  };

  const handleOpenSession = (session) => {
    navigate(session.hasReport && session.displayStatus === 'Completed' ? `/report/${session.id}` : `/interview/${session.id}`);
  };

  const handleStartInterview = () => {
    navigate('/analysis');
  };

  const stats = buildHomepageStats(sessionHistory, historyLoading);
  const recentActivity = buildRecentActivity(sessionHistory);
  const sessionHistoryRows = buildSessionHistoryRows(sessionHistory);
  const summary = settingsSummary(sessionDefaults);
  const userInitials = getUserInitials(user.name);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12 font-sans text-gray-900">
      <HomeHeader
        user={user}
        isAvatarBroken={isAvatarBroken}
        userInitials={userInitials}
        onAvatarError={() => setIsAvatarBroken(true)}
        onSignOut={handleSignOut}
      />

      <main className="mx-auto mt-8 grid max-w-[1600px] grid-cols-1 gap-8 px-6 lg:grid-cols-12 lg:px-8">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <StartSessionCard
            summary={summary}
            showSessionSettings={showSessionSettings}
            sessionDefaults={sessionDefaults}
            settingsSaved={settingsSaved}
            onOpenInterview={handleStartInterview}
            onToggleSettings={() => setShowSessionSettings((current) => !current)}
            onChangeDefaults={handleSessionDefaultsChange}
            onSaveDefaults={handleSaveSessionDefaults}
            onResetDefaults={handleResetSessionDefaults}
          />
          <StatsSection stats={stats} />
          <SessionHistorySection
            historyLoading={historyLoading}
            sessionHistoryRows={sessionHistoryRows}
            onOpenSession={handleOpenSession}
          />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <RecentActivitySection
            historyLoading={historyLoading}
            recentActivity={recentActivity}
            completedCount={stats.completedSessions.length}
          />
          <QuickTipsCard />
          <PrivacySecurityCard email={user.email} loginProvider={user.loginProvider} />
        </div>
      </main>
    </div>
  );
}
