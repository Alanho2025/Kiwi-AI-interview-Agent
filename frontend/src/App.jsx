/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: App should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';
import { TourProvider } from './contexts/TourContext.jsx';
import { TourGuide } from './components/tour/TourGuide.jsx';

const lazyNamedPage = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));

const AnalyzePage = lazyNamedPage(() => import('./pages/AnalyzePage.jsx'), 'AnalyzePage');
const InterviewPage = lazyNamedPage(() => import('./pages/InterviewPage.jsx'), 'InterviewPage');
const ReportPage = lazyNamedPage(() => import('./pages/ReportPage.jsx'), 'ReportPage');
const Login = lazy(() => import('./pages/Login.jsx'));
const HomePage = lazy(() => import('./pages/HomePage.jsx'));

function PageLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
      <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
        <Loader2 className="h-5 w-5 animate-spin text-[#2eb886]" />
        <span className="text-sm font-medium">Loading page...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TourProvider>
      <TourGuide />
      <Router>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/analysis" element={<AnalyzePage />} />
              <Route path="/interview/:sessionId" element={<InterviewPage />} />
              <Route path="/report/:sessionId" element={<ReportPage />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </TourProvider>
  );
}
