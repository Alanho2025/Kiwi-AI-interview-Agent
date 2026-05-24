import React from 'react';
import { Check, Minus } from 'lucide-react';

export function FeatureTable() {
  const features = [
    { name: 'CV + JD analysis', free: 'Limited', ind: 'Included', inst: 'Included' },
    { name: 'Text mock interview', free: '1 session', ind: 'Monthly allowance', inst: 'Organisation-wide' },
    { name: 'Voice interview', free: 'Limited', ind: 'Included', inst: 'Included' },
    { name: 'STAR feedback', free: 'Basic', ind: 'Full', inst: 'Full + rubric options' },
    { name: 'Answer rewrite', free: 'Limited', ind: 'Included', inst: 'Included' },
    { name: 'Feedback report', free: '1 report', ind: 'Included', inst: 'Included' },
    { name: 'Audio download', free: 'Not included', ind: 'Included', inst: 'Included' },
    { name: 'Interview history', free: 'Not included', ind: 'Included', inst: 'Included' },
    { name: 'Admin dashboard', free: 'Not included', ind: 'Not included', inst: 'Included' },
    { name: 'Usage analytics', free: 'Not included', ind: 'Not included', inst: 'Included' },
    { name: 'Custom rubric', free: 'Not included', ind: 'Not included', inst: 'Optional' },
    { name: 'SSO', free: 'Not included', ind: 'Not included', inst: 'Optional' },
  ];

  const renderValue = (val) => {
    if (val === 'Included') {
      return <Check size={20} className="mx-auto" style={{ color: 'var(--accent)' }} />;
    }
    if (val === 'Not included') {
      return <Minus size={20} className="mx-auto" style={{ color: 'var(--text-faint)' }} />;
    }
    return <span className="text-sm font-medium">{val}</span>;
  };

  return (
    <section className="relative z-10 mx-auto max-w-5xl px-6 py-24 sm:py-32">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Compare plans</h2>
        <p className="mt-4 text-lg" style={{ color: 'var(--text-muted)' }}>Find the right fit for your interview preparation needs.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="py-4 px-4 font-bold w-1/3">Feature</th>
              <th className="py-4 px-4 font-bold text-center w-2/9">Free Trial</th>
              <th className="py-4 px-4 font-bold text-center w-2/9">Individual</th>
              <th className="py-4 px-4 font-bold text-center w-2/9">Institutional</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {features.map((f, i) => (
              <tr key={i} className="transition hover:bg-black/5 dark:hover:bg-white/5">
                <td className="py-4 px-4 text-sm font-medium">{f.name}</td>
                <td className="py-4 px-4 text-center" style={{ color: 'var(--text-muted)' }}>{renderValue(f.free)}</td>
                <td className="py-4 px-4 text-center" style={{ color: 'var(--text-muted)' }}>{renderValue(f.ind)}</td>
                <td className="py-4 px-4 text-center" style={{ color: 'var(--text-muted)' }}>{renderValue(f.inst)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
