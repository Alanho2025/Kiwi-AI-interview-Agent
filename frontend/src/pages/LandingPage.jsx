import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bird, ArrowRight, Mic, FileText, BarChart3, Shield,
  Globe2, MessageSquare, ChevronDown, Star, CheckCircle2,
  Upload, BrainCircuit, Headphones, ClipboardCheck, Lock, Sparkles,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme.js';

/* ── Tiny reusable pieces ─────────────────────────────── */

function Badge({ children }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-glow)' }}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: 'var(--accent)' }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
      </span>
      {children}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
      {children}
    </p>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="group rounded-3xl glass p-7 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
        <Icon size={22} />
      </div>
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-4xl font-extrabold sm:text-5xl" style={{ color: 'var(--accent)' }}>{value}</div>
      <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b py-5" style={{ borderColor: 'var(--border)' }}>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <span className="pr-4 font-semibold">{q}</span>
        <ChevronDown size={18} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{a}</p>}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  useTheme();

  const goLogin = () => navigate('/login');

  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Background Orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-[140px] animate-float" style={{ background: 'var(--orb-1)' }} />
      <div className="pointer-events-none absolute top-1/4 -right-40 h-[500px] w-[500px] rounded-full blur-[120px] animate-float-slow" style={{ background: 'var(--orb-2)' }} />

      {/* ── Floating Navbar ── */}
      <nav className="fixed top-6 left-1/2 z-50 flex w-[92%] max-w-5xl -translate-x-1/2 items-center justify-between rounded-full glass px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--accent-glow)' }}>
            <Bird size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="font-bold tracking-tight text-lg">Kiwi Coach</span>
        </div>
        <div className="hidden items-center gap-8 text-sm font-medium sm:flex" style={{ color: 'var(--text-muted)' }}>
          <a href="#how-it-works" className="transition hover:opacity-70">How it works</a>
          <a href="#features" className="transition hover:opacity-70">Features</a>
          <a href="#faq" className="transition hover:opacity-70">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={goLogin} className="hidden text-sm font-semibold sm:block transition hover:opacity-70">Log in</button>
          <button onClick={goLogin} className="rounded-full px-5 py-2 text-sm font-bold transition hover:scale-105 active:scale-95" style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-44 pb-20 text-center sm:pt-52">
        <Badge>AI-Powered Voice Interview Coach</Badge>

        <h1 className="mt-8 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
          Land your dream job with{' '}
          <span style={{ color: 'var(--accent)' }}>real-time AI coaching</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl" style={{ color: 'var(--text-muted)' }}>
          Upload your CV, paste the job description, and practice with a voice AI that coaches you turn-by-turn - then get a detailed performance report.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <button onClick={goLogin} className="group flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-bold shadow-lg transition hover:scale-105 active:scale-95" style={{ background: 'var(--accent)', color: '#000' }}>
            Start Practicing Free
            <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </button>
          <a href="#how-it-works" className="flex items-center justify-center gap-2 rounded-full border px-8 py-4 text-base font-bold transition hover:opacity-70" style={{ borderColor: 'var(--border)' }}>
            See How It Works
          </a>
        </div>

        {/* Social proof strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm" style={{ color: 'var(--text-faint)' }}>
          <span className="flex items-center gap-1"><Star size={14} style={{ color: 'var(--accent)' }} /> Built for NZ job market</span>
          <span>·</span>
          <span>Voice-first AI coaching</span>
          <span>·</span>
          <span>Free practice access</span>
        </div>

        {/* Hero video */}
        <div className="mt-16 w-full max-w-5xl rounded-[2rem] glass p-2 shadow-2xl relative sm:p-3">
          <div className="absolute inset-0 -z-10 rounded-[2rem] opacity-40 blur-3xl" style={{ background: 'var(--accent-glow)' }} />
          <div className="aspect-[16/9] w-full rounded-[1.5rem] overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex h-10 w-full items-center gap-2 border-b px-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-alt)' }}>
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <div className="relative flex h-[calc(100%-2.5rem)] w-full items-center justify-center overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
              <video src="/videos/hero_demo.mp4" autoPlay loop muted playsInline className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </main>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="mb-16 text-center">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="text-3xl font-bold sm:text-5xl">Three steps to interview confidence</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: 'var(--text-muted)' }}>From CV upload to coaching report — your entire interview prep workflow in one place.</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { step: '01', icon: Upload, title: 'Upload & Match', desc: 'Upload your CV and paste the job description. Our AI instantly compares your skills against the role requirements and identifies gap areas to focus on.' },
            { step: '02', icon: Mic, title: 'Voice Interview', desc: 'Practice with an AI interviewer that asks tailored questions via voice, listens to your answers, and adapts the next turn after each response.' },
            { step: '03', icon: BarChart3, title: 'Get Your Report', desc: 'Receive a comprehensive performance report with turn-by-turn scoring, answer rewrites, coaching advice, and NZ workplace culture fit analysis.' },
          ].map((item, i) => (
            <div key={i} className="rounded-3xl glass p-8 transition hover:-translate-y-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                  <item.icon size={20} />
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--text-faint)' }}>Step {item.step}</span>
              </div>
              <h3 className="mb-3 text-xl font-bold">{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="relative z-10 border-t py-24 sm:py-32" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <SectionLabel>Features</SectionLabel>
            <h2 className="text-3xl font-bold sm:text-5xl">Everything you need to prepare</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: 'var(--text-muted)' }}>Purpose-built tools for every stage of your interview journey.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={BrainCircuit} title="AI CV–JD Matching" desc="Automatically extracts and compares your skills with job requirements, highlighting gaps and strengths before you even start practicing." />
            <FeatureCard icon={Headphones} title="Voice-Native Coaching" desc="Full-duplex voice AI that speaks, listens, and interrupts naturally — just like a real interviewer. No typing required." />
            <FeatureCard icon={MessageSquare} title="Session Transcription" desc="Your spoken answers are transcribed during voice sessions so your conversation history can support review, scoring, and report generation." />
            <FeatureCard icon={ClipboardCheck} title="Turn-by-Turn Scoring" desc="Each answer scored individually with evidence analysis, communication profiling, and specific rewrite suggestions." />
            <FeatureCard icon={Globe2} title="NZ Workplace Fit" desc="Specialized coaching on New Zealand workplace communication signals, local interview norms, and role-appropriate answer style." />
            <FeatureCard icon={Lock} title="Privacy First" desc="Recordings are tied to your signed-in account for session review. Google sign-in only uses your name and email." />
          </div>
        </div>
      </section>

      {/* ── Specialized Coaching Section ── */}
      <section className="relative z-10 border-t py-24 sm:py-32" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-alt)' }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <SectionLabel>Specialized coaching</SectionLabel>
              <h2 className="mb-6 text-3xl font-bold sm:text-4xl">Tailored to your role, level, and region</h2>
              <p className="mb-8 text-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Whether you're a junior grad entering the NZ job market or an experienced developer switching roles, Kiwi Coach adapts its question difficulty, coaching tone, and cultural tips to match your situation.
              </p>
              <ul className="space-y-4">
                {[
                  'Junior / Graduate combined interviews',
                  'Mid-level technical deep-dives',
                  'Behavioural & situational questions',
                  'NZ workplace communication guidance',
                  'Speech clarity and answer structure feedback',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 font-medium">
                    <CheckCircle2 size={18} style={{ color: 'var(--accent)' }} /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={goLogin} className="mt-10 rounded-full px-8 py-3 font-bold transition hover:opacity-80" style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}>
                Try It Now — Free
              </button>
            </div>

            {/* Feature detail cards (staggered) */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl glass p-7 shadow-sm">
                <Sparkles size={28} className="mb-5" style={{ color: 'var(--accent)' }} />
                <h3 className="mb-2 font-bold">Smart Question Generation</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>AI reads your CV and JD to generate interview questions that mirror what real hiring managers would ask.</p>
              </div>
              <div className="rounded-3xl glass p-7 shadow-sm mt-0 sm:mt-10">
                <FileText size={28} className="mb-5" style={{ color: 'var(--accent)' }} />
                <h3 className="mb-2 font-bold">Answer Rewrite Engine</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>After each session, get AI-rewritten versions of your weakest answers showing exactly how to improve.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats / Why Choose Us ── */}
      <section className="relative z-10 border-t py-24 sm:py-32" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 text-center">
            <SectionLabel>Why Kiwi Coach</SectionLabel>
            <h2 className="text-3xl font-bold sm:text-5xl">Built for real interview preparation</h2>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <StatCard value="Free" label="Practice access" />
            <StatCard value="Live" label="Voice session flow" />
            <StatCard value="NZ" label="Locale-specific coaching" />
            <StatCard value="Auth" label="Account-based access" />
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl glass p-8">
              <h3 className="mb-3 text-lg font-bold">Built for voice, not text</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Most interview prep tools rely on typing. Kiwi Coach is voice-native — you speak naturally, the AI listens and responds in real-time, building the muscle memory that matters in a real interview.
              </p>
            </div>
            <div className="rounded-3xl glass p-8">
              <h3 className="mb-3 text-lg font-bold">Personalized to your background</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Your CV profile and target job description drive every question, every coaching tip, and every report insight. No generic practice — every session is uniquely yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative z-10 border-t py-24 sm:py-32" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-alt)' }}>
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="text-3xl font-bold sm:text-4xl">Frequently asked questions</h2>
          </div>
          <div>
            <FAQItem q="What is Kiwi Coach?" a="Kiwi Coach is an AI-powered voice interview coaching platform. It uses your CV and the target job description to generate tailored mock interviews, supports voice-based practice, and delivers a comprehensive performance report afterwards." />
            <FAQItem q="How does the voice interview work?" a="Once you upload your CV and paste the job description, Kiwi Coach generates a personalized interview plan. You then enter a voice session where the AI asks questions out loud, listens to your spoken answers, and adapts the next turn after each response. It supports interruption during assistant speech for a more natural conversation flow." />
            <FAQItem q="Is my data secure?" a="We use Google Sign-In which only accesses your name and email. Voice recordings are tied to your signed-in account for session review, and session history can be removed from your dashboard." />
            <FAQItem q="What's included in the interview report?" a="Your report includes an overall score, CV–JD match rate, turn-by-turn answer analysis, communication profiling, NZ workplace culture fit assessment, coaching priorities, answer rewrite suggestions, and evidence diagnostics." />
            <FAQItem q="Is Kiwi Coach free?" a="The current practice flow does not require payment details. You can upload your CV, run mock interviews, and generate coaching reports as part of the demo experience." />
            <FAQItem q="Why NZ-specific coaching?" a="Kiwi Coach is built with New Zealand's job market in mind. It includes coaching on workplace communication signals, local interview norms, and expectations specific to the NZ hiring landscape." />
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 py-24 sm:py-32 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[400px] w-[400px] rounded-full blur-[120px] opacity-30" style={{ background: 'var(--accent)' }} />
        </div>
        <div className="relative z-10 mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold sm:text-5xl">Ready to ace your next interview?</h2>
          <p className="mt-5 text-lg" style={{ color: 'var(--text-muted)' }}>Start with the current free practice flow - no payment details required.</p>
          <button onClick={goLogin} className="group mt-10 inline-flex items-center gap-2 rounded-full px-10 py-4 text-lg font-bold shadow-xl transition hover:scale-105 active:scale-95" style={{ background: 'var(--accent)', color: '#000' }}>
            Get Started Free
            <ArrowRight size={20} className="transition group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t py-16" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto grid max-w-6xl gap-12 px-6 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--accent-glow)' }}>
                <Bird size={14} style={{ color: 'var(--accent)' }} />
              </div>
              <span className="font-bold">Kiwi Coach</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>AI-powered voice interview coaching built for the NZ job market.</p>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Product</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li><a href="#how-it-works" className="transition hover:opacity-70">How it works</a></li>
              <li><a href="#features" className="transition hover:opacity-70">Features</a></li>
              <li><a href="#faq" className="transition hover:opacity-70">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Interview Types</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li>Behavioural Interviews</li>
              <li>Technical Deep-dives</li>
              <li>Graduate Combined</li>
              <li>Voice-only Practice</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Legal</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-6xl border-t px-6 pt-8 text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
          © 2026 Kiwi Coach. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
