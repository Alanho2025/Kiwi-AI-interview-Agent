/**
 * File responsibility: Reusable UI component.
 * Shows DeepSeek API token usage summary and recent session breakdown.
 * Placed below QuickTips on the home page.
 */

import React, { useEffect, useState } from 'react';
import { getUsageSummary, getRecentSessionUsage } from '../../api/usageApi.js';

const formatTokens = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const formatCost = (cost) => {
  if (cost == null || cost === 0) return '$0';
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  return `$${cost.toFixed(4)}`;
};

const SessionRow = ({ session, index }) => {
  // Look for session title in existing data — we pass what the API gives
  const label = session.sessionId?.slice(-6) || `Session #${index + 1}`;
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 truncate">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full [background:var(--accent-bright)]" />
        <span className="truncate text-muted" title={session.sessionId}>
          {label}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-faint">
        <span>{formatTokens(session.totalTokens)} tok</span>
        <span className="font-mono">{formatCost(session.estimatedCost)}</span>
      </div>
    </div>
  );
};

export function TokenUsageSummary() {
  const [summary, setSummary] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const [summaryData, sessionsData] = await Promise.all([
          getUsageSummary(),
          getRecentSessionUsage(5),
        ]);
        if (!isActive) return;
        setSummary(summaryData);
        setRecentSessions(Array.isArray(sessionsData) ? sessionsData : []);
      } catch (err) {
        if (!isActive) return;
        setError(err.message);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    load();
    return () => { isActive = false; };
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 sm:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 rounded-lg bg-chip" />
          <div className="h-3 w-full rounded-lg bg-chip" />
          <div className="h-3 w-3/4 rounded-lg bg-chip" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-5 sm:p-6">
        <p className="text-xs text-faint">Token usage data unavailable</p>
      </div>
    );
  }

  if (!summary || summary.totalTokens === 0) {
    return (
      <div className="glass rounded-2xl p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-bold text-primary">AI Token Usage</h3>
        <p className="text-xs text-faint">No DeepSeek API calls recorded yet. Start an interview to see usage.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-primary">AI Token Usage</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent">DeepSeek</span>
      </div>

      {/* Summary row */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-theme bg-chip p-2 text-center">
          <div className="text-xs font-bold text-primary">{formatTokens(summary.totalTokens)}</div>
          <div className="text-[10px] text-faint">Tokens</div>
        </div>
        <div className="rounded-xl border border-theme bg-chip p-2 text-center">
          <div className="text-xs font-bold text-primary">{formatCost(summary.totalCost)}</div>
          <div className="text-[10px] text-faint">Est. cost</div>
        </div>
        <div className="rounded-xl border border-theme bg-chip p-2 text-center">
          <div className="text-xs font-bold text-primary">{summary.callCount}</div>
          <div className="text-[10px] text-faint">API calls</div>
        </div>
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="space-y-2">
          <div className="mb-1 flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-faint">Recent sessions</span>
            <span className="mt-px flex-1 border-t border-theme" />
          </div>
          {recentSessions.map((session, index) => (
            <SessionRow key={session.sessionId || index} session={session} index={index} />
          ))}
        </div>
      )}

      {/* Pricing footnote */}
      <div className="mt-3 border-t border-theme pt-2 text-[9px] text-primary/20">
        pricing: input $0.14/1M tok · output $0.28/1M tok
      </div>
    </div>
  );
}
