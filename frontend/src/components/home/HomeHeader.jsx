/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: HomeHeader should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { Bird } from 'lucide-react';

/**
 * Purpose: Execute the main responsibility for HomeHeader.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function HomeHeader({ user, isAvatarBroken, userInitials, onAvatarError, onSignOut }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-8 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-xl font-bold text-emerald-500">
        <Bird size={28} />
        <span className="text-gray-900">Kiwi Voice Coach</span>
      </div>

      <div className="hidden text-sm font-medium text-gray-600 md:block">
        Ready to start? Click the big Start button or select a mode.
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          {user.picture && !isAvatarBroken ? (
            <img
              src={user.picture}
              alt={user.name}
              className="h-10 w-10 rounded-full border border-gray-200 object-cover"
              referrerPolicy="no-referrer"
              onError={onAvatarError}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-emerald-50 text-sm font-bold text-emerald-700">
              {userInitials || 'KV'}
            </div>
          )}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-bold text-gray-900 underline decoration-gray-300 underline-offset-2">
              {user.name || user.email}
            </div>
            <div className="text-xs text-gray-400">
              {user.email}
              {user.loginProvider ? ` · Connected via ${user.loginProvider}` : ''}
            </div>
          </div>
        </div>
        <button
          className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold transition hover:bg-gray-50"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
