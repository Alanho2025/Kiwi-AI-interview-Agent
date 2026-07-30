import { useState } from 'react';
import { getReportDiagnostics } from '../../api/reportApi.js';

export function DeveloperReportDiagnostics({ sessionId }) {
  const [open, setOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (import.meta.env.PROD) return null;

  const toggleDiagnostics = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || diagnostics || loading) return;
    setLoading(true);
    setError('');
    try {
      setDiagnostics(await getReportDiagnostics(sessionId));
    } catch (requestError) {
      setError(requestError.message || 'Could not load developer diagnostics.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="developer-report-diagnostics"
        onClick={toggleDiagnostics}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
      >
        {open ? 'Hide developer diagnostics' : 'Show developer diagnostics'}
      </button>
      {open ? (
        <div id="developer-report-diagnostics" className="mt-3">
          {loading ? <p className="text-sm text-slate-600">Loading diagnostics…</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {diagnostics ? (
            <pre className="max-h-[32rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
