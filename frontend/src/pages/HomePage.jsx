import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bird, Clock, Star, Briefcase, Mic, TrendingUp, Settings, FileText
} from 'lucide-react';
import { PrivacySecurityCard } from '../components/home/PrivacySecurityCard.jsx';
import { logoutFromSession } from '../api/authApi.js';
import { getSessionHistory } from '../api/sessionApi.js';
import { clearStoredAuthSession, getStoredAuthSession } from '../utils/authSession.js';

const HOME_SESSION_DEFAULTS_KEY = 'kiwi-home-session-defaults';

const formatFullDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-NZ', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const formatShortDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-NZ', {
    month: 'short',
    day: 'numeric',
  });
};

const formatDurationLabel = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  if (safeSeconds < 60) return '<1 min';
  const minutes = Math.round(safeSeconds / 60);
  return `${minutes} min`;
};

const getHistoryIcon = (status = '', hasReport = false) => {
  if (hasReport) return FileText;
  if (status === 'completed') return Star;
  if (status === 'paused') return Clock;
  if (status === 'in_progress') return Mic;
  return Briefcase;
};

const summarizeSession = (session = {}) => {
  if (session.planPreview) return session.planPreview;
  if (session.scoreBand) return session.scoreBand;
  if (session.status === 'completed') return 'Interview completed';
  if (session.status === 'in_progress') return 'Interview in progress';
  return 'Interview session';
};

const isPresentNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

const resolveDisplayScore = (session = {}) => {
  if (isPresentNumber(session.displayScore)) return Number(session.displayScore);
  if (isPresentNumber(session.overallScore)) return Number(session.overallScore);
  if (isPresentNumber(session.matchScore)) return Number(session.matchScore);
  return null;
};

const DEFAULT_SESSION_SETTINGS = {
  seniorityLevel: 'Junior/Grad',
  enableNZCultureFit: false,
  focusArea: 'Combined',
};

const seniorityOptions = ['Junior/Grad', 'Mid-level', 'Senior'];
const focusOptions = ['Technical', 'Behavioral', 'Combined'];

const settingsSummary = (settings = DEFAULT_SESSION_SETTINGS) => ({
  level: settings.seniorityLevel || 'Junior/Grad',
  focus: settings.focusArea || 'Combined',
  nzContext: settings.enableNZCultureFit ? 'On' : 'Off',
});

export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    name: 'Guest User',
    email: 'guest@kiwi.nz',
    picture: '',
    loginProvider: '',
  });
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
      if (rawDefaults) {
        const parsedDefaults = JSON.parse(rawDefaults);
        setSessionDefaults({
          seniorityLevel: parsedDefaults.seniorityLevel || DEFAULT_SESSION_SETTINGS.seniorityLevel,
          enableNZCultureFit: Boolean(parsedDefaults.enableNZCultureFit),
          focusArea: parsedDefaults.focusArea || DEFAULT_SESSION_SETTINGS.focusArea,
        });
      }
    } catch (error) {
      console.error('Failed to load homepage session defaults', error);
    }

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
  }, [navigate]);

  const handleSaveSessionDefaults = () => {
    window.localStorage.setItem(HOME_SESSION_DEFAULTS_KEY, JSON.stringify(sessionDefaults));
    setSettingsSaved('Defaults saved');
    window.setTimeout(() => setSettingsSaved(''), 1800);
  };

  const handleResetSessionDefaults = () => {
    setSessionDefaults(DEFAULT_SESSION_SETTINGS);
    window.localStorage.setItem(HOME_SESSION_DEFAULTS_KEY, JSON.stringify(DEFAULT_SESSION_SETTINGS));
    setSettingsSaved('Defaults reset');
    window.setTimeout(() => setSettingsSaved(''), 1800);
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

  const userInitials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const completedSessions = sessionHistory.filter((item) => item.status === 'completed');
  const scoredSessions = sessionHistory
    .map((item) => resolveDisplayScore(item))
    .filter((value) => Number.isFinite(Number(value)));
  const averageScore = scoredSessions.length
    ? Math.round(scoredSessions.reduce((sum, value) => sum + Number(value || 0), 0) / scoredSessions.length)
    : '-';
  const latestRole = sessionHistory[0]?.displayTitle || sessionHistory[0]?.targetRole || 'No sessions yet';
  const recentActivity = sessionHistory.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.displayTitle || item.targetRole || 'Interview Session',
    date: formatShortDate(item.createdAt),
    duration: formatDurationLabel(item.durationSeconds),
    avgScore: Number.isFinite(Number(resolveDisplayScore(item))) ? Math.round(Number(resolveDisplayScore(item))) : '-',
    status: item.status === 'completed' ? 'Completed' : item.status === 'in_progress' ? 'In Progress' : item.status === 'paused' ? 'Paused' : 'Draft',
    icon: getHistoryIcon(item.status, item.hasReport),
  }));
  const summary = settingsSummary(sessionDefaults);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-gray-900 pb-12">
      
      {/* --- 顶部导航栏 Header --- */}
      <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-500 font-bold text-xl">
          <Bird size={28} />
          <span className="text-gray-900">Kiwi Voice Coach</span>
        </div>
        
        <div className="hidden md:block text-sm font-medium text-gray-600">
          Ready to start? Click the big Start button or select a mode.
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {user.picture && !isAvatarBroken ? (
              <img 
                src={user.picture}
                alt={user.name}
                className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                referrerPolicy="no-referrer"
                onError={() => setIsAvatarBroken(true)}
              />
            ) : (
              <div className="w-10 h-10 rounded-full border border-gray-200 bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-bold">
                {userInitials || 'KV'}
              </div>
            )}
            <div className="hidden sm:block text-right">
              <div className="text-sm font-bold text-gray-900 underline decoration-gray-300 underline-offset-2">
                {user.name || user.email}
              </div>
              <div className="text-xs text-gray-400">
                {user.email}
                {user.loginProvider ? ` · Connected via ${user.loginProvider}` : ''}
              </div>
            </div>
          </div>
          <button
            className="border border-gray-300 rounded-full px-5 py-2 text-sm font-semibold hover:bg-gray-50 transition"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* --- 主体内容区 Main Content --- */}
      <main className="max-w-[1600px] mx-auto px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ================= 左侧栏 (占 8 列) ================= */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* 1. Start New Session Card */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
            <div className="max-w-md z-10">
              <h1 className="text-3xl font-extrabold mb-3">Start New Session</h1>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                Fast, NZ-focused interview practice for pronunciation, timing and clarity. 
                Securely recorded to your Google account with NZ privacy compliance.
              </p>
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Session settings</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">Level: {summary.level}</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">Focus: {summary.focus}</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">NZ Context: {summary.nzContext}</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">Adjust level, focus, and NZ interview context before starting.</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  className="border border-gray-300 rounded-full px-6 py-3 text-sm font-semibold hover:bg-gray-50 transition"
                  onClick={() => setShowSessionSettings((value) => !value)}
                >
                  Session Settings
                </button>
                <button
                  className="bg-[#20B2AA] text-white rounded-full px-6 py-3 text-sm font-semibold shadow-md hover:bg-[#1c9c95] transition"
                  onClick={() => navigate('/analysis')}
                >
                  Start New Session
                </button>
                <span className="text-xs text-gray-400 ml-2">Estimated time: <strong className="text-gray-600">10–20 min</strong></span>
              </div>
              {showSessionSettings ? (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 max-w-lg">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Level</span>
                      <select
                        className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                        value={sessionDefaults.seniorityLevel}
                        onChange={(event) => setSessionDefaults((prev) => ({ ...prev, seniorityLevel: event.target.value }))}
                      >
                        {seniorityOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Focus</span>
                      <div className="flex items-center gap-1 rounded-full border border-gray-300 bg-white p-1">
                        {focusOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSessionDefaults((prev) => ({ ...prev, focusArea: option }))}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              sessionDefaults.focusArea === option
                                ? 'bg-[#20B2AA] text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">NZ Context</span>
                      <button
                        type="button"
                        onClick={() => setSessionDefaults((prev) => ({ ...prev, enableNZCultureFit: !prev.enableNZCultureFit }))}
                        className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                          sessionDefaults.enableNZCultureFit
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-gray-300 bg-white text-gray-600'
                        }`}
                        aria-pressed={sessionDefaults.enableNZCultureFit}
                        aria-label="Toggle NZ context"
                      >
                        <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition ${
                          sessionDefaults.enableNZCultureFit ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}>
                          <span className={`h-3 w-3 rounded-full bg-white shadow transition ${
                            sessionDefaults.enableNZCultureFit ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`} />
                        </span>
                        {sessionDefaults.enableNZCultureFit ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-[#20B2AA] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1c9c95]"
                      onClick={handleSaveSessionDefaults}
                    >
                      Save Defaults
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-gray-300 px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-100"
                      onClick={handleResetSessionDefaults}
                    >
                      Reset
                    </button>
                    {settingsSaved ? <span className="text-[11px] font-semibold text-emerald-600">{settingsSaved}</span> : null}
                  </div>
                </div>
              ) : null}
            </div>
            
            {/* 卡片右侧的小组件和插画占位 */}
            <div className="hidden md:flex flex-col items-end gap-4 z-10">
              <div className="bg-white/80 backdrop-blur border border-gray-100 shadow-sm rounded-2xl p-4 w-48 text-sm">
                <div className="text-gray-400 text-xs mb-1">Upcoming</div>
                <div className="font-semibold mb-3">Mic Check • 2 mins</div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Quality</span>
                  <span className="font-bold text-gray-900">Good</span>
                </div>
              </div>
            </div>
            {/* 背景麦克风装饰 (用灰色圆形代替实际图片) */}
            <div className="absolute right-[-20px] top-[-20px] w-64 h-64 bg-gray-50 rounded-full opacity-50 z-0 flex items-center justify-center">
                <Mic size={100} className="text-gray-200" />
            </div>
          </div>

          {/* 2. Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard icon={<Clock size={20}/>} title="Total Sessions" value={historyLoading ? '...' : String(sessionHistory.length)} />
            <StatCard icon={<Star size={20}/>} title="Avg. Score" value={historyLoading ? '...' : String(averageScore)} iconBg="bg-[#20B2AA] text-white" />
            <StatCard icon={<Briefcase size={20}/>} title="Latest Role" value={historyLoading ? '...' : latestRole} />
          </div>

          {/* 3. Session History */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-xl font-bold">Session History</h2>
              <span className="text-sm text-gray-400">Your recent interview sessions</span>
            </div>
            
            {/* Table Header */}
            <div className="grid grid-cols-12 text-xs font-semibold text-gray-400 border-b border-gray-100 pb-3 mb-4">
              <div className="col-span-2">Date</div>
              <div className="col-span-6">Job Title</div>
              <div className="col-span-2 text-center">Overall Score</div>
              <div className="col-span-2 text-right">Status</div>
            </div>

            {/* Table Body */}
            <div className="flex flex-col gap-2">
              {historyLoading ? (
                <div className="py-10 text-sm text-gray-400">Loading session history...</div>
              ) : sessionHistory.length === 0 ? (
                <div className="py-10 text-sm text-gray-400">No interview sessions yet. Start a new session to build your history.</div>
              ) : (
                sessionHistory.map((item) => {
                  const ItemIcon = getHistoryIcon(item.status, item.hasReport);
                  const displayStatus = item.status === 'completed'
                    ? 'Completed'
                    : item.status === 'in_progress'
                      ? 'In Progress'
                      : item.status === 'paused'
                        ? 'Paused'
                        : 'Draft';

                  return (
                    <div key={item.id} className="grid grid-cols-12 items-center py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition rounded-xl px-2 -mx-2">
                      <div className="col-span-2 text-sm font-medium">{formatFullDate(item.createdAt)}</div>
                      <div className="col-span-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                          <ItemIcon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{item.displayTitle || item.targetRole || 'Interview Session'}</div>
                          <div className="text-xs text-gray-400 truncate">{summarizeSession(item)}</div>
                        </div>
                      </div>
                      <div className="col-span-2 text-center font-bold text-sm">
                        {Number.isFinite(Number(resolveDisplayScore(item))) ? Math.round(Number(resolveDisplayScore(item))) : '-'}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                          displayStatus === 'Completed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : displayStatus === 'In Progress'
                              ? 'bg-sky-50 text-sky-600'
                              : displayStatus === 'Paused'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-orange-50 text-orange-600'
                        }`}>
                          {displayStatus}
                        </span>
                        <button
                          className="border border-emerald-200 text-emerald-600 rounded-full px-4 py-1 text-xs font-semibold hover:bg-emerald-50 transition whitespace-nowrap"
                          onClick={() => navigate(item.hasReport && displayStatus === 'Completed' ? `/report/${item.id}` : `/interview/${item.id}`)}
                        >
                          {item.hasReport && displayStatus === 'Completed' ? 'View Report' : 'Open Session'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ================= 右侧栏 (占 4 列) ================= */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* 1. Recent Activity */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold">Recent Activity</h3>
                <p className="text-xs text-gray-400">Latest updates from your sessions</p>
              </div>
              <span className="text-xs text-gray-400">{historyLoading ? 'Syncing...' : `${completedSessions.length} completed`}</span>
            </div>
            <div className="flex flex-col gap-4">
              {historyLoading ? (
                <div className="text-sm text-gray-400">Loading recent activity...</div>
              ) : recentActivity.length === 0 ? (
                <div className="text-sm text-gray-400">No recent activity yet. Your completed and draft sessions will appear here.</div>
              ) : (
                recentActivity.map(activity => (
                  <div key={activity.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                        <activity.icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{activity.title} • {activity.date}</div>
                        <div className="text-xs text-gray-400 truncate">{activity.duration} – Avg score {activity.avgScore}</div>
                      </div>
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${
                      activity.status === 'Completed'
                        ? 'text-emerald-500'
                        : activity.status === 'In Progress'
                          ? 'text-sky-500'
                          : activity.status === 'Paused'
                            ? 'text-amber-600'
                            : 'text-orange-500'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Quick Tips */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Quick Tips</h3>
              <span className="text-xs text-gray-400">Bite-sized</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-4 mb-6">
              <li>Speak clearly at a steady pace – aim for 140-160 wpm for technical answers.</li>
              <li>Emphasize keywords in NZ English pronunciations: 'process', 'schedule', 'route'.</li>
              <li>Use the timed mode to build concise answers under pressure.</li>
            </ul>
            {/* 图表占位 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="h-24 w-full bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100 flex items-end p-2">
                <TrendingUp className="text-emerald-300 opacity-50 w-full h-full" />
              </div>
              <div className="text-[10px] text-gray-400 mt-2">Weekly practice trend</div>
            </div>
          </div>

          <PrivacySecurityCard email={user.email} loginProvider={user.loginProvider} />

        </div>
      </main>
    </div>
  );
}

// 提取的子组件：顶部的三个数据统计卡片
function StatCard({ icon, title, value, iconBg = "bg-emerald-50 text-emerald-600" }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-400 font-medium mb-1">{title}</div>
        <div className="text-2xl font-extrabold text-gray-900 leading-none mb-2">{value}</div>
        {/* 底部细条装饰 */}
        <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden mt-3">
          <div className="h-full bg-gray-300 w-2/3 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
