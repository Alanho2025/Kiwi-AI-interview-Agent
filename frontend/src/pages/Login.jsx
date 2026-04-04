import React, { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { Bird } from 'lucide-react';
import { loginWithGoogle } from '../api/authApi.js';

import kiwiMicImg from '../assets/kiwiMicImg.png';
import kiwiHeadphoneImg from '../assets/kiwiHeadphoneImg.png';
import dataVizImg from '../assets/dataVizImg.png';

const AUTH_STORAGE_KEY = 'kiwi-auth-session';

export default function Login() {
  const navigate = useNavigate();
  const [isAgreed, setIsAgreed] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const existingSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (existingSession) {
      navigate('/home', { replace: true });
    }
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
      const data = await loginWithGoogle(credentialResponse.credential);
      const authSession = {
        userId: data.user?.id || '',
        email: data.user?.email || '',
        name: data.user?.full_name || '',
        picture: '',
        loginProvider: 'google',
        acceptedPrivacyTerms: true,
        loggedInAt: new Date().toISOString(),
        token: data.token || '',
      };

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans relative overflow-hidden">
      {/* 头部导航栏（保持不变） */}
      <header className="flex justify-between items-center px-8 py-6 w-full absolute top-0 z-20">
        <div className="flex items-center gap-2 text-emerald-500 font-bold text-xl">
          <Bird size={28} />
          <span className="text-gray-900">Kiwi Voice Coach</span>
        </div>
        <div className="text-sm text-gray-400">
          New to Kiwi Voice Coach?
        </div>
      </header>

      {/* 主要内容区 */}
      <main className="flex-1 flex items-center justify-center relative z-10 w-full mt-16">
        {/* 左侧装饰图 */}
        <div className="hidden xl:flex flex-col absolute left-[5%] 2xl:left-[10%] top-1/2 -translate-y-1/2 gap-8 z-0">
          <img src={kiwiMicImg} alt="Microphone" className="w-64 object-contain drop-shadow-sm" />
          <img src={kiwiHeadphoneImg} alt="Kiwi Bird" className="w-48 ml-8 object-contain drop-shadow-sm" />
        </div>

        {/* 右侧装饰图 */}
        <div className="hidden xl:block absolute right-[5%] 2xl:right-[10%] top-1/2 -translate-y-1/2 z-0">
          <img src={dataVizImg} alt="Data Visualization" className="w-[450px] object-contain drop-shadow-sm" />
        </div>

        {/* 中央登录卡片 */}
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 max-w-lg w-full mx-4 z-10">
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-4">
            Practice for your next NZ Tech Interview.
          </h1>
          <p className="text-gray-600 text-sm mb-8 leading-relaxed">
            Sharpen pronunciation, timing and clarity with AI-guided feedback tailored for New Zealand tech roles.
          </p>

          {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}

          {/* Google 登录按钮 */}
          <div className="mb-6 flex justify-center relative">
            <div className={`w-full flex justify-center transition-opacity duration-300 ${!isAgreed || isSubmitting ? 'opacity-50 grayscale' : 'opacity-100'}`}>
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap={false}
                shape="pill"
                size="large"
                width="320"
                text="signin_with"
              />
            </div>
          </div>

          <div className="text-xs text-gray-400 font-medium mb-4">Privacy & terms</div>

          {/* 信息说明框 */}
          <div className="border border-gray-100 rounded-xl p-4 mb-4 bg-[#fafafa]">
            <p className="text-xs text-gray-400 leading-relaxed">
              Secure voice coaching – quick setup. One click to connect your Google account and start practicing.
            </p>
          </div>

          {/* 隐私条款勾选框 */}
          <label className="flex items-start gap-3 border border-gray-100 rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex-shrink-0 pt-0.5">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                checked={isAgreed}
                onChange={(e) => {
                  setIsAgreed(e.target.checked);
                  if (e.target.checked) setError('');
                }}
              />
            </div>
            <span className="text-xs text-gray-500 leading-relaxed select-none">
              I agree to the NZ Privacy Act 2020 data processing terms.
            </span>
          </label>
        </div>
      </main>

      <footer className="w-full text-center pb-8 pt-4 z-20">
        <p className="text-xs text-gray-400">
          Your voice data is encrypted and used only for coaching feedback.
        </p>
      </footer>
    </div>
  );
}
