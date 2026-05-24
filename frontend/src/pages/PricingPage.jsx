import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bird } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.js';

import { PricingHero } from '../components/pricing/PricingHero.jsx';
import { PricingCards } from '../components/pricing/PricingCards.jsx';
import { FeatureTable } from '../components/pricing/FeatureTable.jsx';
import { PricingSections } from '../components/pricing/PricingSections.jsx';
import { PricingFAQ } from '../components/pricing/PricingFAQ.jsx';

export function PricingPage() {
  const navigate = useNavigate();
  useTheme();

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Background Orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-[140px] animate-float opacity-50" style={{ background: 'var(--orb-1)' }} />
      <div className="pointer-events-none absolute top-1/4 -right-40 h-[500px] w-[500px] rounded-full blur-[120px] animate-float-slow opacity-50" style={{ background: 'var(--orb-2)' }} />

      {/* Floating Navbar */}
      <nav className="fixed top-6 left-1/2 z-50 flex w-[92%] max-w-5xl -translate-x-1/2 items-center justify-between rounded-full glass px-6 py-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 transition hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--accent-glow)' }}>
            <Bird size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="font-bold tracking-tight text-lg">Kiwi Coach</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="hidden text-sm font-semibold sm:block transition hover:opacity-70">Log in</button>
          <button onClick={() => navigate('/login')} className="rounded-full px-5 py-2 text-sm font-bold transition hover:scale-105 active:scale-95" style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}>
            Get Started
          </button>
        </div>
      </nav>

      <PricingHero />
      <PricingCards />
      <FeatureTable />
      <PricingSections />
      <PricingFAQ />

      {/* Footer */}
      <footer className="relative z-10 border-t py-16 text-center" style={{ borderColor: 'var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          © 2026 Kiwi Coach. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default PricingPage;
