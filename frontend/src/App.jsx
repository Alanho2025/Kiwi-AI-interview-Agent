import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnalyzePage } from './pages/AnalyzePage.jsx';
import { InterviewPage } from './pages/InterviewPage.jsx';
import Login from './pages/Login.jsx'; 
import HomePage from './pages/HomePage.jsx';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<HomePage />} />
        {/* 下面是你原有的路由保持不变 */}
        <Route path="/" element={<AnalyzePage />} />
        <Route path="/interview/:sessionId" element={<InterviewPage />} />
      </Routes>
    </Router>
  );
}