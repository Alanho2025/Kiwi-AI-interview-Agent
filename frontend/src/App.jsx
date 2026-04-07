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
        <Route path="/" element={<Navigate to="/login" replace />} />
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
