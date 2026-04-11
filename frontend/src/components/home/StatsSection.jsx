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
function StatCard({ icon, title, value, iconBg = 'bg-emerald-50 text-emerald-600' }) {
  return (
    <div className="flex items-start gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        {icon}
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-gray-400">{title}</div>
        <div className="mb-2 text-2xl font-extrabold leading-none text-gray-900">{value}</div>
        <div className="mt-3 h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-2/3 rounded-full bg-gray-300" />
        </div>
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <StatCard icon={<Clock size={20} />} title="Total Sessions" value={stats.totalSessionsLabel} />
      <StatCard icon={<Star size={20} />} title="Avg. Score" value={stats.averageScoreLabel} iconBg="bg-[#20B2AA] text-white" />
      <StatCard icon={<Briefcase size={20} />} title="Latest Role" value={stats.latestRoleLabel} />
    </div>
  );
}
