import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx';
import './index.css';
import { getGoogleClientConfig } from './api/authApi.js';

const rootElement = document.getElementById('root');

const renderApp = (clientId = '') => {
  createRoot(rootElement).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>,
  );
};

const bootstrap = async () => {
  try {
    const data = await getGoogleClientConfig();
    renderApp(data.clientId);
  } catch (error) {
    console.error('Failed to load Google client config', error);
    renderApp('');
  }
};

bootstrap();
