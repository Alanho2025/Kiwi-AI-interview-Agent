/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: StartSessionCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { Settings } from 'lucide-react';
import { controlModeOptions, focusOptions, questionLimitOptions, seniorityOptions, timeLimitOptions } from '../../utils/sessionSettings.js';

/**
 * Purpose: Execute the main responsibility for StartSessionCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function StartSessionCard({ summary, showSessionSettings, sessionDefaults, settingsSaved, voiceStartWarning, onOpenTextInterview, onOpenVoiceInterview, onToggleSettings, onChangeDefaults, onSaveDefaults, onResetDefaults }) {
  return (
    <div className="relative overflow-hidden rounded-2xl glass p-6 sm:p-8">
      <div className="relative z-10 flex flex-col items-stretch justify-between gap-8 xl:flex-row xl:items-start">
        <div className="max-w-lg">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Interview practice</p>
          <h1 className="mb-4 text-3xl sm:text-4xl font-bold leading-tight text-primary tracking-tight">Start a practice session</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted font-medium">
            Choose text or voice practice, then review your CV and target job before the interview starts.
          </p>
          <div className="mb-6 border-l-2 [border-color:var(--accent)/50] pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-faint mb-2">Current setup</p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-theme bg-chip px-3 py-1 text-primary">Level: {summary.level}</span>
              <span className="rounded-full border border-theme bg-chip px-3 py-1 text-primary">Focus: {summary.focus}</span>
              <span className="rounded-full border border-theme bg-chip px-3 py-1 text-primary">Limit: {summary.limit}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:flex xl:flex-wrap">
            <button
              className="rounded-xl [background:var(--accent-bright)] px-6 py-3 text-sm font-bold text-primary shadow-[0_0_20px_rgba(163,230,53,0.3)] transition hover:[background:#bef264] hover:shadow-[0_0_30px_rgba(163,230,53,0.5)] active:scale-95"
              onClick={onOpenTextInterview}
            >
              Text interview
            </button>
            <button
              className="rounded-xl border [border-color:var(--accent)] [background:var(--accent-glow)] px-6 py-3 text-sm font-bold text-accent transition hover:[background:var(--accent-glow)] active:scale-95"
              onClick={onOpenVoiceInterview}
            >
              Voice interview
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-theme bg-chip px-5 py-3 text-sm font-semibold text-primary/70 transition hover:bg-chip"
              onClick={onToggleSettings}
            >
              <Settings size={15} /> Settings
            </button>
          </div>
          {voiceStartWarning ? (
            <p className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-xs font-semibold text-yellow-300">
              {voiceStartWarning}
            </p>
          ) : null}
        </div>

        <div className="relative z-10 w-full rounded-2xl glass-darker p-6 sm:p-7 xl:max-w-xs">
          <div className="mb-5 flex items-start justify-between border-b border-theme pb-4">
            <div>
              <div className="text-base font-bold text-primary">Saved setup</div>
              <div className="text-[10px] uppercase tracking-widest text-faint mt-1">Used for new sessions</div>
            </div>
            <div className="rounded-full border [border-color:var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">Ready</div>
          </div>
          <div className="space-y-3 text-xs font-medium text-muted uppercase tracking-wider">
            <div className="flex justify-between border-b border-theme pb-2"><span>Practice</span><span className="font-bold text-primary">Choose now</span></div>
            <div className="flex justify-between border-b border-theme pb-2"><span>Limit</span><span className="font-bold text-primary">{summary.controlMode}</span></div>
            <div className="flex justify-between border-b border-theme pb-2"><span>Focus</span><span className="font-bold text-primary">{summary.focus}</span></div>
            <div className="flex justify-between pb-2"><span>Length</span><span className="font-bold text-primary">{summary.limit}</span></div>
          </div>
          <div className="mt-6 rounded-xl border border-theme bg-chip p-4 text-xs text-muted">
            <div className="mb-2 text-sm font-semibold text-primary">Practice scope</div>
            <div className="space-y-1.5 leading-relaxed">
              <div>• {summary.level} role simulation</div>
              <div>• {summary.focus} question mix</div>
              <div>• {summary.controlMode}: {summary.limit}</div>
              <div>• NZ workplace fit: {summary.nzContext}</div>
            </div>
          </div>
        </div>
      </div>

      {showSessionSettings && (
        <div className="relative z-10 mt-6 rounded-2xl border border-theme bg-chip p-5 sm:p-7 animate-fade-in-up">
          <h3 className="mb-5 text-base font-bold text-primary">Session settings</h3>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Seniority level
              <select
                className="mt-2 w-full rounded-xl border border-theme bg-chip px-4 py-3 text-sm text-primary outline-none focus:[border-color:var(--accent)]"
                value={sessionDefaults.seniorityLevel}
                onChange={(event) => onChangeDefaults('seniorityLevel', event.target.value)}
              >
                {seniorityOptions.map((option) => (
                  <option key={option} value={option} className="[background:var(--text-primary)]">{option}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Question focus
              <select
                className="mt-2 w-full rounded-xl border border-theme bg-chip px-4 py-3 text-sm text-primary outline-none focus:[border-color:var(--accent)]"
                value={sessionDefaults.focusArea}
                onChange={(event) => onChangeDefaults('focusArea', event.target.value)}
              >
                {focusOptions.map((option) => (
                  <option key={option} value={option} className="[background:var(--text-primary)]">{option}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Session limit
              <select
                className="mt-2 w-full rounded-xl border border-theme bg-chip px-4 py-3 text-sm text-primary outline-none focus:[border-color:var(--accent)]"
                value={sessionDefaults.controlMode}
                onChange={(event) => onChangeDefaults('controlMode', event.target.value)}
              >
                {controlModeOptions.map((option) => (
                  <option key={option.value} value={option.value} className="[background:var(--text-primary)]">{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {sessionDefaults.controlMode === 'time_limited' ? (
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Time limit
                <select
                  className="mt-2 w-full rounded-xl border border-theme bg-chip px-4 py-3 text-sm text-primary outline-none focus:[border-color:var(--accent)]"
                  value={sessionDefaults.timeLimitMinutes}
                  onChange={(event) => onChangeDefaults('timeLimitMinutes', Number(event.target.value))}
                >
                  {timeLimitOptions.map((option) => (
                    <option key={option} value={option} className="[background:var(--text-primary)]">{option} minutes</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Question limit
                <select
                  className="mt-2 w-full rounded-xl border border-theme bg-chip px-4 py-3 text-sm text-primary outline-none focus:[border-color:var(--accent)]"
                  value={sessionDefaults.questionLimit}
                  onChange={(event) => onChangeDefaults('questionLimit', Number(event.target.value))}
                >
                  {questionLimitOptions.map((option) => (
                    <option key={option} value={option} className="[background:var(--text-primary)]">{option} questions</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-theme bg-chip px-4 py-3 text-xs font-semibold text-primary/70">
              <input
                type="checkbox"
                className="accent-[#a3e635]"
                checked={sessionDefaults.enableNZCultureFit}
                onChange={(event) => onChangeDefaults('enableNZCultureFit', event.target.checked)}
              />
              Include NZ workplace fit
            </label>
          </div>
          <div className="mt-4 rounded-xl border border-theme bg-chip px-4 py-3 text-xs text-muted">
            Choose voice mode when you want to check your microphone and speaker before starting.
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="rounded-xl [background:var(--accent-bright)] px-5 py-2 text-xs font-bold text-primary transition hover:[background:#bef264]" onClick={onSaveDefaults}>
              Save defaults
            </button>
            <button className="rounded-xl border border-theme bg-chip px-5 py-2 text-xs font-semibold text-primary/70 transition hover:bg-chip" onClick={onResetDefaults}>
              Reset defaults
            </button>
            {settingsSaved ? <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{settingsSaved}</span> : null}
          </div>
        </div>
      )}

      {/* Decorative glow accent */}
      <div className="pointer-events-none absolute -right-16 -bottom-16 z-0 h-56 w-56 rounded-full bg-chip blur-[60px]" />
    </div>
  );
}
