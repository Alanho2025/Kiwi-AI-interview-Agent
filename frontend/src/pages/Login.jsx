/**
 * File responsibility: Page container.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: Login should orchestrate the screen and compose child sections without burying domain rules in JSX.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React, { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { Bird, ShieldCheck } from 'lucide-react';
import { getCurrentUser, loginWithGoogle } from '../api/authApi.js';

import kiwiMicImg from '../assets/kiwiMicImg.png';
import kiwiHeadphoneImg from '../assets/kiwiHeadphoneImg.png';
import dataVizImg from '../assets/dataVizImg.png';

export default function Login() {
  const navigate = useNavigate();
  const [isAgreed, setIsAgreed] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadCurrentUser = async () => {
      try {
        await getCurrentUser();
        if (isActive) {
          navigate('/home', { replace: true });
        }
      } catch (_error) {
        // Stay on the login page when there is no active cookie-backed session.
      }
    };

    loadCurrentUser();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  const handleSuccess = async (credentialResponse) => {
    if (!isAgreed) {
      setError('Please agree to the Privacy Act terms before continuing.');
      return;
    }

    if (!credentialResponse?.credential) {
      setError('Login failed. Missing Google credential.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await loginWithGoogle(credentialResponse.credential, { termsAccepted: isAgreed });
      navigate('/home', { replace: true });
    } catch (loginError) {
      console.error('Failed to log in with Google', loginError);
      setError(loginError.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleError = () => {
    console.error('Google Login Failed');
    setError('Login failed. Please try again.');
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-transparent font-sans text-primary">
      <header className="absolute top-0 z-20 flex w-full items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex items-center gap-2 text-lg font-bold text-emerald-500 sm:text-xl">
          <Bird size={28} />
          <span className="text-primary">Kiwi Voice Coach</span>
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-theme glass/80 px-3 py-2 text-sm text-muted shadow-sm backdrop-blur sm:flex">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Secure coaching workspace
        </div>
      </header>

      <main className="relative z-10 mt-16 flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="absolute left-[5%] top-1/2 z-0 hidden -translate-y-1/2 flex-col gap-8 xl:flex 2xl:left-[10%]">
          <img src={kiwiMicImg} alt="Microphone" className="w-64 object-contain drop-shadow-sm" />
          <img src={kiwiHeadphoneImg} alt="Kiwi Bird" className="w-48 ml-8 object-contain drop-shadow-sm" />
        </div>

        <div className="absolute right-[5%] top-1/2 z-0 hidden -translate-y-1/2 xl:block 2xl:right-[10%]">
          <img src={dataVizImg} alt="Data Visualization" className="w-[450px] object-contain drop-shadow-sm" />
        </div>

        <div className="z-10 w-full max-w-lg rounded-2xl border border-theme glass p-6 shadow-sm sm:p-8">
          <h1 className="mb-4 text-3xl font-extrabold leading-tight text-primary">
            Practice for your next NZ job interview.
          </h1>
          <p className="mb-6 text-sm leading-6 text-muted">
            Sharpen judgement, evidence, timing, and clarity with AI-guided feedback tailored for roles across New Zealand.
          </p>

          {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}

          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-faint">Privacy & terms</div>

          <div className="mb-4 rounded-xl border border-theme bg-transparent p-4">
            <p className="text-sm leading-6 text-muted">
              Your interview audio and documents are used only to create coaching feedback for your account.
            </p>
          </div>

          <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-theme glass p-4 transition hover:border-theme">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-theme text-emerald-600 focus:ring-emerald-500"
              checked={isAgreed}
              onChange={(e) => {
                setIsAgreed(e.target.checked);
                if (e.target.checked) setError('');
              }}
            />
            <span className="text-sm leading-6 text-muted">
              I agree to the NZ Privacy Act 2020 data processing terms.
            </span>
          </label>

          <div className="relative mb-3 flex justify-center">
            <div className={`flex w-full justify-center transition-opacity duration-300 ${!isAgreed || isSubmitting ? 'pointer-events-none opacity-50 grayscale' : 'opacity-100'}`}>
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap={false}
                shape="pill"
                size="large"
                width="240"
                text="signin_with"
              />
            </div>
          </div>

          <p className="text-center text-xs leading-5 text-faint">
            {!isAgreed ? 'Accept the privacy terms to enable Google sign in.' : isSubmitting ? 'Signing you in...' : 'One click connects your Google account and opens your practice workspace.'}
          </p>
        </div>
      </main>

      <footer className="z-20 w-full px-4 pb-8 pt-4 text-center">
        <p className="mx-auto max-w-md text-xs leading-5 text-faint">
          Your voice data is encrypted and used only for coaching feedback.
        </p>
      </footer>
    </div>
  );
}
