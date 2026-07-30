import { useState } from 'react';

import { saveReportReflection } from '../../api/reportApi.js';

const FOCUS_OPTIONS = [
  ['scope', 'Scope or assumptions'],
  ['evidence', 'Evidence or examples'],
  ['verification', 'Verification or judgement'],
  ['structure', 'Answer structure'],
  ['communication', 'Communication'],
  ['other', 'Other'],
];

export function CandidateReflectionCard({ sessionId, reflections = [] }) {
  const [text, setText] = useState('');
  const [focusArea, setFocusArea] = useState('other');
  const [savedReflections, setSavedReflections] = useState(reflections);
  const [status, setStatus] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await saveReportReflection({ sessionId, reflection: text, focusArea });
      const saved = result?.reflection;
      if (saved) setSavedReflections((items) => [...items, saved].slice(-5));
      setText('');
      setStatus('Reflection saved. It will not change your interview score.');
    } catch (error) {
      setStatus(error.message || 'Your reflection could not be saved.');
    }
  };

  return (
    <section className="rounded-xl border border-theme bg-theme-surface p-4 sm:p-5" aria-labelledby="candidate-reflection-title">
      <h2 id="candidate-reflection-title" className="text-base font-semibold text-primary">Optional real-interview reflection</h2>
      <p className="mt-1 text-sm leading-6 text-muted">Capture what felt difficult in a real interview. This note is private to this session and does not change your score.</p>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-primary" htmlFor="reflection-focus">Focus area</label>
        <select id="reflection-focus" className="w-full rounded-md border border-theme bg-theme-surface px-3 py-2 text-sm text-primary" value={focusArea} onChange={(event) => setFocusArea(event.target.value)}>
          {FOCUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="block text-sm font-medium text-primary" htmlFor="candidate-reflection">Your reflection</label>
        <textarea id="candidate-reflection" className="min-h-24 w-full rounded-md border border-theme bg-theme-surface px-3 py-2 text-sm text-primary" value={text} maxLength={800} onChange={(event) => setText(event.target.value)} placeholder="For example: I could explain the tool, but I did not explain how I verified the result." />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{text.length}/800</p>
          <button className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!text.trim()}>Save reflection</button>
        </div>
      </form>
      {status ? <p className="mt-3 text-sm text-muted" role="status">{status}</p> : null}
      {savedReflections.length ? (
        <ul className="mt-4 space-y-2 border-t border-theme pt-3 text-sm leading-6 text-muted">
          {savedReflections.map((item) => <li key={item.reflectionId}>{item.text}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
