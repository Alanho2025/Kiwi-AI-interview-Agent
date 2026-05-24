import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Users, Building2 } from 'lucide-react';

export function PricingSections() {
  const navigate = useNavigate();

  return (
    <>
      {/* Why Kiwi AI Section */}
      <section className="relative z-10 border-t py-24 sm:py-32" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Why Kiwi AI</p>
            <h2 className="text-3xl font-bold sm:text-5xl">Built for real interview readiness, not random practice questions</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="rounded-3xl glass p-8">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                <Target size={22} />
              </div>
              <h3 className="mb-3 text-xl font-bold">The Real Problem</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Generic interview tools can help you practise, but they often miss the real problem. Candidates do not just need more questions. They need to know whether their answers match the role, show enough evidence, and communicate value clearly.
              </p>
            </div>
            <div className="rounded-3xl glass p-8">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                <Users size={22} />
              </div>
              <h3 className="mb-3 text-xl font-bold">One Coaching Loop</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Kiwi AI connects your CV, the job description, and your interview answers into one coaching loop. It helps you find weak evidence, unclear STAR structure, missing job-description links, and communication gaps before the real interview.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Campus Section */}
      <section className="relative z-10 border-t py-24 sm:py-32" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-alt)' }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Campus</p>
              <h2 className="mb-6 text-3xl font-bold sm:text-4xl">A scalable practice layer for career services</h2>
              <p className="mb-8 text-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Career advisers cannot run unlimited 1:1 mock interviews for every student. Kiwi AI gives students a guided practice layer before they meet an adviser.
              </p>
              <p className="mb-8 text-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Students arrive more prepared. Advisers spend less time on basic structure. Career services get better visibility into common preparation gaps.
              </p>
              <button onClick={() => navigate('/contact-sales')} className="rounded-full px-8 py-3 font-bold transition hover:opacity-80" style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}>
                Start a campus pilot
              </button>
            </div>
            <div className="rounded-[2rem] border overflow-hidden shadow-2xl relative" style={{ borderColor: 'var(--border)' }}>
              <div className="absolute inset-0 -z-10 rounded-[2rem] opacity-40 blur-3xl" style={{ background: 'var(--accent-glow)' }} />
              <img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1470&auto=format&fit=crop" alt="Students on campus" className="w-full h-full object-cover aspect-[4/3] opacity-80" />
            </div>
          </div>
        </div>
      </section>

      {/* Company Section */}
      <section className="relative z-10 border-t py-24 sm:py-32" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2 lg:flex-row-reverse">
             <div className="order-2 lg:order-1 rounded-[2rem] border overflow-hidden shadow-2xl relative" style={{ borderColor: 'var(--border)' }}>
              <div className="absolute inset-0 -z-10 rounded-[2rem] opacity-40 blur-3xl" style={{ background: 'var(--accent-glow)' }} />
              <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1470&auto=format&fit=crop" alt="Team meeting" className="w-full h-full object-cover aspect-[4/3] opacity-80" />
            </div>
            <div className="order-1 lg:order-2">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Company</p>
              <h2 className="mb-6 text-3xl font-bold sm:text-4xl">Coaching for graduate programmes and internal mobility</h2>
              <p className="mb-8 text-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Kiwi AI can help teams practise interview communication, role fit, and evidence-based answers. It is designed for coaching and readiness, not automated hiring decisions.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  'Graduate programme preparation',
                  'Internal mobility readiness',
                  'Communication training',
                  'Structured practice before important conversations',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>
                    <Building2 size={18} style={{ color: 'var(--accent)' }} /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/contact-sales')} className="rounded-full px-8 py-3 font-bold transition hover:opacity-80 border" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                Talk to us
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
