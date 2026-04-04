import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bird, Clock, Star, Briefcase, Mic, TrendingUp, Settings, FileText
} from 'lucide-react';
import { PrivacySecurityCard } from '../components/home/PrivacySecurityCard.jsx';

const AUTH_STORAGE_KEY = 'kiwi-auth-session';

// --- Mock Data (模拟数据) ---
const sessionHistory = [
  { id: 1, date: '2026-03-18', title: 'Backend Engineer – Aotearoa Tech', sub: 'Full-stack interview simulation', score: null, status: 'Completed', icon: Bird },
  { id: 2, date: '2026-03-10', title: 'Frontend Engineer – Southern Cloud', sub: 'UI timing & clarity practice', score: 76, status: 'Draft', icon: Briefcase },
  { id: 3, date: '2026-02-25', title: 'Data Engineer – Kiwi Analytics', sub: 'Clear pronunciation focus', score: null, status: 'Completed', icon: Star },
  { id: 4, date: '2026-02-11', title: 'Mobile Engineer – Tui Mobile', sub: 'Timing & intonation practice', score: 69, status: 'Draft', icon: FileText },
  { id: 5, date: '2026-01-28', title: 'DevOps Engineer – HarbourOps', sub: 'Clarity and command practice', score: null, status: 'Completed', icon: Settings },
];

const recentActivity = [
  { id: 1, title: 'Timed Practice', date: '18 Mar', duration: '7 min', avgScore: 82, status: 'Completed', icon: Clock },
  { id: 2, title: 'Mock Interview', date: '10 Mar', duration: '18 min', avgScore: 76, status: 'Draft', icon: FileText },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    name: 'Guest User',
    email: 'guest@kiwi.nz',
    picture: '',
    loginProvider: '',
  });
  const [isAvatarBroken, setIsAvatarBroken] = useState(false);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!savedSession) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const parsedSession = JSON.parse(savedSession);
      setUser({
        name: parsedSession.name || 'Guest User',
        email: parsedSession.email || 'guest@kiwi.nz',
        picture: parsedSession.picture || '',
        loginProvider: parsedSession.loginProvider || '',
      });
      setIsAvatarBroken(false);
    } catch (error) {
      console.error('Failed to restore auth session', error);
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleSignOut = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    navigate('/login', { replace: true });
  };

  const userInitials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
              <div className="flex items-center gap-4">
                <button className="border border-gray-300 rounded-full px-6 py-3 text-sm font-semibold hover:bg-gray-50 transition">
                  Customize
                </button>
                <button
                  className="bg-[#20B2AA] text-white rounded-full px-6 py-3 text-sm font-semibold shadow-md hover:bg-[#1c9c95] transition"
                  onClick={() => navigate('/')}
                >
                  Start New Session
                </button>
                <span className="text-xs text-gray-400 ml-2">Estimated time: <strong className="text-gray-600">10–20 min</strong></span>
              </div>
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
            <StatCard icon={<Clock size={20}/>} title="Total Sessions" value="124" />
            <StatCard icon={<Star size={20}/>} title="Avg. Score" value="78" iconBg="bg-[#20B2AA] text-white" />
            <StatCard icon={<Briefcase size={20}/>} title="Target Role" value="Software Engineer – Backend" />
          </div>

          {/* 3. Session History */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-xl font-bold">Session History</h2>
              <span className="text-sm text-gray-400">Manage and review past sessions</span>
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
              {sessionHistory.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-center py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition rounded-xl px-2 -mx-2">
                  <div className="col-span-2 text-sm font-medium">{item.date}</div>
                  <div className="col-span-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                      <item.icon size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-400">{item.sub}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-center font-bold text-sm">
                    {item.score ? item.score : '-'}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                      item.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {item.status}
                    </span>
                    <button className="border border-emerald-200 text-emerald-600 rounded-full px-4 py-1 text-xs font-semibold hover:bg-emerald-50 transition whitespace-nowrap">
                      View Report
                    </button>
                  </div>
                </div>
              ))}
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
                <p className="text-xs text-gray-400">Quick snapshot of last week</p>
              </div>
              <span className="text-xs text-gray-400">Updated: 2 days ago</span>
            </div>
            <div className="flex flex-col gap-4">
              {recentActivity.map(activity => (
                <div key={activity.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                      <activity.icon size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{activity.title} • {activity.date}</div>
                      <div className="text-xs text-gray-400">{activity.duration} – Avg score {activity.avgScore}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${activity.status === 'Completed' ? 'text-emerald-500' : 'text-orange-500'}`}>
                    {activity.status}
                  </span>
                </div>
              ))}
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

          <PrivacySecurityCard />

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
