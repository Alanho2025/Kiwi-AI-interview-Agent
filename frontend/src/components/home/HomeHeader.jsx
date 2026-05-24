/**
 * File responsibility: Reusable UI component.
 * HomeHeader renders the top navigation bar with logo, theme toggle, user info, and sign-out.
 */

import React from 'react';
import { Bird, HelpCircle, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';

export function HomeHeader({ user, isAvatarBroken, userInitials, onAvatarError, onSignOut, onStartTour }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-8 sm:py-4"
      style={{
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--accent-glow)' }}>
          <Bird size={18} style={{ color: 'var(--accent)' }} />
        </div>
        <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Kiwi <span style={{ color: 'var(--accent)' }}>Coach</span>
        </span>
      </div>

      {/* Centre label */}
      <div className="hidden text-[10px] font-bold uppercase tracking-widest lg:block" style={{ color: 'var(--text-faint)' }}>
        Practice workspace
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Tour */}
        <button
          onClick={onStartTour}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-glow)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          title="Replay tour"
        >
          <HelpCircle size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Tour</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-full transition"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-chip)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          title={isDark ? 'Switch to light mode' : 'Switch to night mode'}
        >
          {isDark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
        </button>

        {/* Avatar + name */}
        <div className="flex items-center gap-2.5">
          {user.picture && !isAvatarBroken ? (
            <img
              src={user.picture}
              alt={user.name}
              className="h-8 w-8 rounded-full object-cover"
              style={{ border: '2px solid var(--border-strong)' }}
              referrerPolicy="no-referrer"
              onError={onAvatarError}
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
              style={{ border: '2px solid var(--border-strong)', background: 'var(--bg-chip)', color: 'var(--accent)' }}
            >
              {userInitials || 'KV'}
            </div>
          )}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user.name || user.email}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{user.email}</div>
          </div>
        </div>

        {/* Sign out */}
        <button
          className="rounded-full px-4 py-1.5 text-xs font-semibold transition"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-chip)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
