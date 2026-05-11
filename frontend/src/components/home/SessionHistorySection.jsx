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
  Completed: '[border-color:var(--accent)] bg-chip text-accent',
  'In Progress': '[border-color:var(--accent-soft)] [background:var(--accent-glow)] text-accent',
  Paused: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  Draft: 'border-orange-400/30 bg-orange-400/10 text-orange-400',
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

  const renderSessionActions = (item, isDeleting, isConfirming, isMobile = false) => (
    <>
      <button
        className={`${isMobile ? 'px-3 py-2' : 'px-4 py-1'} whitespace-nowrap rounded-full border [border-color:var(--accent)] bg-chip text-xs font-semibold text-accent transition hover:bg-chip disabled:opacity-50`}
        onClick={() => onOpenSession(item)}
        disabled={isDeleting || isConfirming}
      >
        {item.hasReport && item.displayStatus === 'Completed' ? 'View Report' : 'Open Session'}
      </button>
      {isConfirming ? (
        <>
          <button
            className={`${isMobile ? 'px-3 py-2' : 'px-3 py-1'} rounded-full border border-red-400/30 bg-red-400/10 text-xs font-semibold text-red-400 transition hover:bg-red-400/20`}
            onClick={() => handleConfirmDelete(item.id)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Confirm'}
          </button>
          <button
            className={`${isMobile ? 'col-span-2 px-3 py-2' : 'px-3 py-1'} rounded-full border border-theme bg-chip text-xs font-semibold text-muted transition hover:bg-chip`}
            onClick={handleCancelDelete}
            disabled={isDeleting}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          className={`${isMobile ? 'px-3 py-2' : 'px-3 py-1'} rounded-full border border-theme bg-chip text-xs font-semibold text-muted transition hover:bg-chip disabled:opacity-50`}
          onClick={() => handleDeleteClick(item.id)}
          disabled={isDeleting || isConfirming}
          title="Delete session"
        >
          Delete
        </button>
      )}
    </>
  );

  return (
    <div className="glass rounded-2xl p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-bold text-primary">Session History</h2>
        <span className="text-sm text-faint">Your recent interview sessions</span>
      </div>

      {historyLoading ? (
        <div className="py-10 text-sm text-faint">Loading session history...</div>
      ) : sessionHistoryRows.length === 0 ? (
        <div className="py-10 text-sm text-faint">No interview sessions yet. Start a new session to build your history.</div>
      ) : (
        <>
          <div className="space-y-2 sm:hidden">
            {sessionHistoryRows.map((item) => {
              const ItemIcon = item.icon;
              const statusClassName = STATUS_STYLES[item.displayStatus] || STATUS_STYLES.Draft;
              const isDeleting = deletingId === item.id;
              const isConfirming = showConfirm === item.id;

              return (
                <div key={item.id} className="rounded-xl border border-theme bg-chip p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chip text-accent">
                      <ItemIcon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-bold text-primary">{item.displayTitle || item.targetRole || 'Interview Session'}</div>
                      <div className="mt-1 text-xs text-faint">{item.formattedDate} · {item.summary}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-primary">{item.scoreLabel}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassName}`}>{item.displayStatus}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {renderSessionActions(item, isDeleting, isConfirming, true)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <div className="min-w-[600px]">
              <div className="mb-4 grid grid-cols-12 border-b border-theme pb-3 text-[10px] font-bold uppercase tracking-widest text-faint">
                <div className="col-span-2">Date</div>
                <div className="col-span-5">Job Title</div>
                <div className="col-span-2 text-center">Score</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>

              <div className="flex flex-col gap-1">
                {sessionHistoryRows.map((item) => {
                  const ItemIcon = item.icon;
                  const statusClassName = STATUS_STYLES[item.displayStatus] || STATUS_STYLES.Draft;
                  const isDeleting = deletingId === item.id;
                  const isConfirming = showConfirm === item.id;

                  return (
                    <div key={item.id} className="-mx-2 grid grid-cols-12 items-center rounded-xl border-b border-theme px-2 py-3 transition last:border-0 hover:bg-chip">
                      <div className="col-span-2 text-sm font-medium text-muted">{item.formattedDate}</div>
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-chip text-accent">
                          <ItemIcon size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-primary">{item.displayTitle || item.targetRole || 'Interview Session'}</div>
                          <div className="truncate text-xs text-faint">{item.summary}</div>
                        </div>
                      </div>
                      <div className="col-span-2 text-center text-sm font-bold text-primary">{item.scoreLabel}</div>
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassName}`}>{item.displayStatus}</span>
                        {renderSessionActions(item, isDeleting, isConfirming)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
