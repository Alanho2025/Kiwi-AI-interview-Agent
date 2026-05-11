/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: StatsSection should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { Briefcase, Clock, Star } from 'lucide-react';

/**
 * Purpose: Execute the main responsibility for StatCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
function StatCard({ icon, title, value }) {
  return (
    <div className="glass flex items-center gap-4 rounded-2xl px-5 py-5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-chip text-accent">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-faint">{title}</div>
        <div className="mt-0.5 text-2xl font-bold tracking-tight text-primary">{value}</div>
      </div>
    </div>
  );
}

/**
 * Purpose: Execute the main responsibility for StatsSection.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function StatsSection({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard icon={<Clock size={18} />} title="Total Sessions" value={stats.totalSessionsLabel} />
      <StatCard icon={<Star size={18} />} title="Avg. Score" value={stats.averageScoreLabel} />
      <StatCard icon={<Briefcase size={18} />} title="Latest Role" value={stats.latestRoleLabel} />
    </div>
  );
}

