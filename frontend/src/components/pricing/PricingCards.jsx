import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';

export function PricingCards() {
  const navigate = useNavigate();

  return (
    <section className="relative z-10 py-16 px-6 mx-auto max-w-7xl">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Free Trial */}
        <div className="flex flex-col rounded-3xl glass p-8 shadow-sm transition hover:-translate-y-1">
          <div className="mb-6">
            <h3 className="text-2xl font-bold">Free Trial</h3>
            <p className="mt-2 text-sm h-10" style={{ color: 'var(--text-muted)' }}>
              Best for trying Kiwi AI before committing.
            </p>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">Free</span>
            </div>
            <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-faint)' }}>for 14 days</p>
          </div>
          <ul className="mb-8 space-y-4 flex-1">
            {[
              '1 CV + JD analysis.',
              '1 text mock interview.',
              '1 feedback report.',
              'Basic STAR feedback.',
              'Limited voice trial.'
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm font-medium">
                <Check size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-full border py-3 font-bold transition hover:opacity-70"
            style={{ borderColor: 'var(--border)' }}
          >
            Start free trial
          </button>
          <p className="mt-4 text-xs text-center leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            A short trial designed to show the full interview readiness loop without locking you into a subscription.
          </p>
        </div>

        {/* Individual Version */}
        <div className="relative flex flex-col rounded-3xl p-8 shadow-2xl transition hover:-translate-y-1" style={{ background: 'var(--bg-surface-alt)', border: '2px solid var(--accent)' }}>
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--accent)', color: '#000' }}>
            <Sparkles size={14} /> Recommended
          </div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold">Individual Version</h3>
            <p className="mt-2 text-sm h-10" style={{ color: 'var(--text-muted)' }}>
              Best for students and job seekers preparing for real interviews.
            </p>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">NZ$19.99</span>
              <span className="text-lg font-medium text-muted">/month</span>
            </div>
            <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-faint)' }}>Annual option: NZ$99-119/year</p>
          </div>
          <ul className="mb-8 space-y-4 flex-1">
            {[
              '8-10 complete mock interviews per month.',
              'CV and job-description matching.',
              'Text and voice interview practice.',
              'STAR scoring.',
              'Answer rewrites.',
              'Feedback reports.',
              'Interview history.',
              'Audio download.'
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm font-medium">
                <Check size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-full py-3 font-bold transition hover:opacity-90"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            Upgrade to Individual
          </button>
          <p className="mt-4 text-xs text-center leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            Use this when you are applying for internships, graduate roles, entry-level roles, or career-change positions.
          </p>
        </div>

        {/* Institutional Version */}
        <div className="flex flex-col rounded-3xl glass p-8 shadow-sm transition hover:-translate-y-1">
          <div className="mb-6">
            <h3 className="text-2xl font-bold">Institutional Version</h3>
            <p className="mt-2 text-sm h-10" style={{ color: 'var(--text-muted)' }}>
              Best for universities, career services, graduate programmes, and teams.
            </p>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold">Custom</span>
            </div>
            <p className="mt-1 text-sm font-medium leading-relaxed" style={{ color: 'var(--text-faint)' }}>
              Campus pilot: NZ$3k-5k<br />
              Annual: NZ$12-20/student
            </p>
          </div>
          <ul className="mb-8 space-y-4 flex-1">
            {[
              'Student or team access.',
              'Admin dashboard & Usage analytics.',
              'Common skill-gap insights.',
              'NZ workplace culture guidance.',
              'STAR feedback and answer rewrites.',
              'Report export.',
              'Custom rubric options.',
              'Data retention controls.',
              'Optional SSO for larger deployments.'
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm font-medium">
                <Check size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/contact-sales')}
            className="w-full rounded-full border py-3 font-bold transition hover:opacity-70"
            style={{ borderColor: 'var(--border)' }}
          >
            Request pilot
          </button>
          <p className="mt-4 text-xs text-center leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            Designed for organisations that need scalable interview practice without replacing human coaches.
          </p>
        </div>
      </div>
    </section>
  );
}
