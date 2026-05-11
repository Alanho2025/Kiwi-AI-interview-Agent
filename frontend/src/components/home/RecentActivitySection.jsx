/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: RecentActivitySection should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';

/**
 * Purpose: Execute the main responsibility for RecentActivitySection.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function RecentActivitySection({ historyLoading, recentActivity, completedCount }) {
  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-primary">Recent Activity</h3>
          <p className="text-[11px] text-faint mt-0.5">Latest updates from your sessions</p>
        </div>
        <span className="text-[11px] font-semibold text-accent">{historyLoading ? 'Syncing...' : `${completedCount} completed`}</span>
      </div>
      <div className="flex flex-col gap-3">
        {historyLoading ? (
          <div className="text-sm text-faint">Loading recent activity...</div>
        ) : recentActivity.length === 0 ? (
          <div className="text-sm text-faint">No recent activity yet. Your completed and draft sessions will appear here.</div>
        ) : (
          recentActivity.map((activity) => {
            const ActivityIcon = activity.icon;
            const statusClassName = activity.status === 'Completed'
              ? 'text-accent'
              : activity.status === 'In Progress'
                ? 'text-accent'
                : activity.status === 'Paused'
                  ? 'text-amber-400'
                  : 'text-orange-400';

            return (
              <div key={activity.id} className="flex items-center justify-between gap-3 rounded-xl border border-theme bg-chip px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chip text-accent">
                    <ActivityIcon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-primary">{activity.title} · {activity.date}</div>
                    <div className="truncate text-[11px] text-faint">{activity.duration} — Avg score {activity.avgScore}</div>
                  </div>
                </div>
                <span className={`shrink-0 text-[11px] font-bold ${statusClassName}`}>{activity.status}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
