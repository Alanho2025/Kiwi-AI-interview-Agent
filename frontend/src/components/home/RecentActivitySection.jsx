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
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold">Recent Activity</h3>
          <p className="text-xs text-gray-400">Latest updates from your sessions</p>
        </div>
        <span className="text-xs text-gray-400">{historyLoading ? 'Syncing...' : `${completedCount} completed`}</span>
      </div>
      <div className="flex flex-col gap-4">
        {historyLoading ? (
          <div className="text-sm text-gray-400">Loading recent activity...</div>
        ) : recentActivity.length === 0 ? (
          <div className="text-sm text-gray-400">No recent activity yet. Your completed and draft sessions will appear here.</div>
        ) : (
          recentActivity.map((activity) => {
            const ActivityIcon = activity.icon;
            const statusClassName = activity.status === 'Completed'
              ? 'text-emerald-500'
              : activity.status === 'In Progress'
                ? 'text-sky-500'
                : activity.status === 'Paused'
                  ? 'text-amber-600'
                  : 'text-orange-500';

            return (
              <div key={activity.id} className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <ActivityIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{activity.title} • {activity.date}</div>
                    <div className="truncate text-xs text-gray-400">{activity.duration} - Avg score {activity.avgScore}</div>
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-medium ${statusClassName}`}>{activity.status}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
