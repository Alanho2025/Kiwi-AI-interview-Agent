import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bird, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.js';

export function ContactSalesPage() {
  const navigate = useNavigate();
  useTheme();
  
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Mock submission
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Background Orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-[140px] animate-float opacity-50" style={{ background: 'var(--orb-1)' }} />

      {/* Floating Navbar */}
      <nav className="fixed top-6 left-1/2 z-50 flex w-[92%] max-w-5xl -translate-x-1/2 items-center justify-between rounded-full glass px-6 py-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 transition hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--accent-glow)' }}>
            <Bird size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="font-bold tracking-tight text-lg">Kiwi Coach</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pricing')} className="text-sm font-semibold transition hover:opacity-70">Pricing</button>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-xl px-6 pt-44 pb-24 sm:pt-52">
        <div className="text-center mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Contact Sales</p>
          <h1 className="text-3xl font-bold sm:text-5xl">Request a Pilot</h1>
          <p className="mt-4 text-lg" style={{ color: 'var(--text-muted)' }}>Get in touch to discuss institutional plans, campus pilots, or custom team coaching.</p>
        </div>

        <div className="rounded-3xl glass p-8 shadow-xl">
          {submitted ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <CheckCircle2 size={48} className="mb-6" style={{ color: 'var(--accent)' }} />
              <h3 className="text-2xl font-bold mb-2">Message Sent</h3>
              <p style={{ color: 'var(--text-muted)' }}>Thank you for reaching out. Our team will get back to you within 24 hours.</p>
              <button 
                onClick={() => navigate('/')} 
                className="mt-8 rounded-full px-6 py-3 font-bold transition hover:opacity-80" 
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                Back to Home
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold mb-2">Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full rounded-xl border p-3 bg-transparent transition focus:ring-2" 
                  style={{ borderColor: 'var(--border)', outlineColor: 'var(--accent)' }} 
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Email</label>
                <input 
                  type="email" 
                  required
                  className="w-full rounded-xl border p-3 bg-transparent transition focus:ring-2" 
                  style={{ borderColor: 'var(--border)', outlineColor: 'var(--accent)' }} 
                  placeholder="jane@university.edu"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Organisation / University</label>
                <input 
                  type="text" 
                  required
                  className="w-full rounded-xl border p-3 bg-transparent transition focus:ring-2" 
                  style={{ borderColor: 'var(--border)', outlineColor: 'var(--accent)' }} 
                  placeholder="University of Auckland"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">How can we help?</label>
                <textarea 
                  required
                  rows="4"
                  className="w-full rounded-xl border p-3 bg-transparent transition focus:ring-2" 
                  style={{ borderColor: 'var(--border)', outlineColor: 'var(--accent)' }} 
                  placeholder="Tell us about your expected number of students/employees and your timeline..."
                ></textarea>
              </div>
              <button 
                type="submit" 
                className="w-full group flex items-center justify-center gap-2 rounded-xl px-6 py-4 font-bold transition hover:opacity-90" 
                style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
              >
                Send Request
                <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default ContactSalesPage;
