import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

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

export function PricingFAQ() {
  return (
    <section className="relative z-10 border-t py-24 sm:py-32" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-alt)' }}>
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>FAQ</p>
          <h2 className="text-3xl font-bold sm:text-4xl">Frequently asked questions</h2>
        </div>
        <div>
          <FAQItem q="Is Kiwi AI a replacement for career advisers or human coaches?" a="No. Kiwi AI is designed as a scalable practice layer. It helps users prepare before meeting a human adviser, coach, or manager." />
          <FAQItem q="Why is the free plan limited?" a="Kiwi AI uses AI, voice, document parsing, storage, and report generation. A limited trial lets users experience the full value while keeping the service sustainable." />
          <FAQItem q="Can universities customise the rubric?" a="Yes. Institutional customers can customise rubrics, guidance, and reporting based on their career-service goals." />
          <FAQItem q="Can companies use Kiwi AI for candidate screening?" a="Kiwi AI should be used for coaching, practice, and communication development. It should not be used as the sole basis for hiring decisions." />
          <FAQItem q="Does Kiwi AI support New Zealand interview expectations?" a="Yes. Kiwi AI is designed around New Zealand workplace communication, STAR-style evidence, role fit, and culturally grounded interview guidance." />
        </div>
      </div>
    </section>
  );
}
