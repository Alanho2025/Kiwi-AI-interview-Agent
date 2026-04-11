/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: SessionHistorySection should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React, { useState } from 'react';

const STATUS_STYLES = {
  Completed: 'bg-emerald-50 text-emerald-600',
  'In Progress': 'bg-sky-50 text-sky-600',
  Paused: 'bg-amber-50 text-amber-700',
  Draft: 'bg-orange-50 text-orange-600',
};

/**
 * Purpose: Execute the main responsibility for SessionHistorySection.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function SessionHistorySection({ historyLoading, sessionHistoryRows, onOpenSession, onDeleteSession }) {
  const [deletingId, setDeletingId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);

  const handleDeleteClick = (sessionId) => {
    setShowConfirm(sessionId);
  };

  const handleConfirmDelete = async (sessionId) => {
    setDeletingId(sessionId);
    try {
      await onDeleteSession(sessionId);
      setShowConfirm(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(null);
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-xl font-bold">Session History</h2>
        <span className="text-sm text-gray-400">Your recent interview sessions</span>
      </div>

      <div className="mb-4 grid grid-cols-12 border-b border-gray-100 pb-3 text-xs font-semibold text-gray-400">
        <div className="col-span-2">Date</div>
        <div className="col-span-5">Job Title</div>
        <div className="col-span-2 text-center">Overall Score</div>
        <div className="col-span-3 text-right">Actions</div>
      </div>

      <div className="flex flex-col gap-2">
        {historyLoading ? (
          <div className="py-10 text-sm text-gray-400">Loading session history...</div>
        ) : sessionHistoryRows.length === 0 ? (
          <div className="py-10 text-sm text-gray-400">No interview sessions yet. Start a new session to build your history.</div>
        ) : (
          sessionHistoryRows.map((item) => {
            const ItemIcon = item.icon;
            const statusClassName = STATUS_STYLES[item.displayStatus] || STATUS_STYLES.Draft;
            const isDeleting = deletingId === item.id;
            const isConfirming = showConfirm === item.id;

            return (
              <div key={item.id} className="-mx-2 grid grid-cols-12 items-center rounded-xl border-b border-gray-50 px-2 py-3 transition last:border-0 hover:bg-gray-50">
                <div className="col-span-2 text-sm font-medium">{item.formattedDate}</div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <ItemIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-gray-900">{item.displayTitle || item.targetRole || 'Interview Session'}</div>
                    <div className="truncate text-xs text-gray-400">{item.summary}</div>
                  </div>
                </div>
                <div className="col-span-2 text-center text-sm font-bold">{item.scoreLabel}</div>
                <div className="col-span-3 flex items-center justify-end gap-2">
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClassName}`}>{item.displayStatus}</span>
                  <button
                    className="whitespace-nowrap rounded-full border border-emerald-200 px-4 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                    onClick={() => onOpenSession(item)}
                    disabled={isDeleting || isConfirming}
                  >
                    {item.hasReport && item.displayStatus === 'Completed' ? 'View Report' : 'Open Session'}
                  </button>
                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                        onClick={() => handleConfirmDelete(item.id)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                        onClick={handleCancelDelete}
                        disabled={isDeleting}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                      onClick={() => handleDeleteClick(item.id)}
                      disabled={isDeleting || isConfirming}
                      title="Delete session"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
