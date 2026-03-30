import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnalyzePage } from './pages/AnalyzePage.jsx';
import { InterviewPage } from './pages/InterviewPage.jsx';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AnalyzePage />} />
        <Route path="/interview/:sessionId" element={<InterviewPage />} />
      </Routes>
    </Router>
  );
}
