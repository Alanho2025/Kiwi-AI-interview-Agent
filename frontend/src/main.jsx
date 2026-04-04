import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';  // 新增
import App from './App.jsx';
import './index.css';

// 你的 Google Client ID
const clientId = "394786670055-0d0cf48c668p290qfgmdjmj2natck5ka.apps.googleusercontent.com";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);