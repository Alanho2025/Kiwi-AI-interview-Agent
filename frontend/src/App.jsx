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
const OpsLitePage = lazy(() => import('./pages/OpsLitePage.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const PricingPage = lazy(() => import('./pages/PricingPage.jsx'));
const ContactSalesPage = lazy(() => import('./pages/ContactSalesPage.jsx'));

import { useTheme } from './hooks/useTheme.js';

function PageLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent text-muted">
      <div className="flex items-center gap-3 rounded-lg glass px-4 py-3 shadow-sm ring-1 ring-accent">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span className="text-sm font-medium">Loading page...</span>
      </div>
    </div>
  );
}

export default function App() {
  useTheme(); // Initialize theme context globally
  return (
    <TourProvider>
      <TourGuide />
      <Router>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/contact-sales" element={<ContactSalesPage />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              {/* Alias /home to /dashboard for backwards compatibility */}
              <Route path="/home" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<HomePage />} />
              <Route path="/analysis" element={<AnalyzePage />} />
              <Route path="/interview/:sessionId" element={<InterviewPage />} />
              <Route path="/report/:sessionId" element={<ReportPage />} />
              <Route path="/ops-lite" element={<OpsLitePage />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </TourProvider>
  );
}
