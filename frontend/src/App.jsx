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

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnalyzePage } from './pages/AnalyzePage.jsx';
import { InterviewPage } from './pages/InterviewPage.jsx';
import Login from './pages/Login.jsx'; 
import HomePage from './pages/HomePage.jsx';
import { ReportPage } from './pages/ReportPage.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';

export default function App() {
  return (
    <Router>
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
    </Router>
  );
}
