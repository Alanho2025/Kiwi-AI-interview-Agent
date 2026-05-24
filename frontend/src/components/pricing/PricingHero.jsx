import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function PricingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-44 pb-20 text-center sm:pt-52">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-glow)' }}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: 'var(--accent)' }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
        </span>
        Flexible Pricing
      </div>

      <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
        Pricing that fits how people <span style={{ color: 'var(--accent)' }}>actually prepare</span> for interviews
      </h1>

      <p className="mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl" style={{ color: 'var(--text-muted)' }}>
        Start with one guided interview loop. Upgrade when you need repeated practice, voice coaching, detailed reports, or team-wide interview readiness.
      </p>

      <p className="mt-4 max-w-3xl text-md leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Kiwi AI is not just another chatbot. It reads your CV, understands the job description, runs a targeted mock interview, and gives evidence-backed feedback grounded in New Zealand workplace expectations.
      </p>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <button onClick={() => navigate('/login')} className="group flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-bold shadow-lg transition hover:scale-105 active:scale-95" style={{ background: 'var(--accent)', color: '#000' }}>
          Start free trial
          <ArrowRight size={18} className="transition group-hover:translate-x-1" />
        </button>
        <button onClick={() => navigate('/contact-sales')} className="flex items-center justify-center gap-2 rounded-full border px-8 py-4 text-base font-bold transition hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          View institutional options
        </button>
      </div>
    </section>
  );
}
