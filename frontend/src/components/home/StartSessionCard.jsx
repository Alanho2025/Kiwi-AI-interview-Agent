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
import { Mic, Settings } from 'lucide-react';
import { focusOptions, seniorityOptions } from '../../utils/sessionDisplay.js';

/**
 * Purpose: Execute the main responsibility for StartSessionCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function StartSessionCard({ summary, showSessionSettings, sessionDefaults, settingsSaved, onOpenInterview, onToggleSettings, onChangeDefaults, onSaveDefaults, onResetDefaults }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
      <div className="relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row">
        <div className="max-w-md">
          <h1 className="mb-3 text-3xl font-extrabold">Start New Session</h1>
          <p className="mb-8 text-sm leading-relaxed text-gray-500">
            Fast, NZ-focused interview practice for pronunciation, timing and clarity.
            Securely recorded to your Google account with NZ privacy compliance.
          </p>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Session settings</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">Level: {summary.level}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">Focus: {summary.focus}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700">NZ context: {summary.nzContext}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              onClick={onOpenInterview}
            >
              Start Interview
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              onClick={onToggleSettings}
            >
              <Settings size={16} /> Session Settings
            </button>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-sm rounded-3xl border border-gray-100 bg-gray-50 p-6 shadow-inner">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">Practice Snapshot</div>
              <div className="text-xs text-gray-400">Preview of the default session mode</div>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-600">Ready</div>
          </div>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between"><span>Mode</span><span className="font-semibold text-gray-900">Voice + Text</span></div>
            <div className="flex justify-between"><span>Flow</span><span className="font-semibold text-gray-900">Guided Interview</span></div>
            <div className="flex justify-between"><span>Checks</span><span className="font-semibold text-gray-900">Clarity + Role Fit</span></div>
            <div className="flex justify-between"><span>Estimate</span><span className="font-semibold text-gray-900">8 mins</span></div>
          </div>
          <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm">
            <div className="mb-2 font-semibold text-gray-900">Default coaching setup</div>
            <div className="space-y-2">
              <div>{summary.level} role simulation</div>
              <div>{summary.focus} question mix</div>
              <div>NZ culture fit: {summary.nzContext}</div>
            </div>
          </div>
        </div>
      </div>

      {showSessionSettings && (
        <div className="relative z-10 mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-gray-700">
              Seniority level
              <select
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm outline-none"
                value={sessionDefaults.seniorityLevel}
                onChange={(event) => onChangeDefaults('seniorityLevel', event.target.value)}
              >
                {seniorityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Focus area
              <select
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm outline-none"
                value={sessionDefaults.focusArea}
                onChange={(event) => onChangeDefaults('focusArea', event.target.value)}
              >
                {focusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm">
              <input
                type="checkbox"
                checked={sessionDefaults.enableNZCultureFit}
                onChange={(event) => onChangeDefaults('enableNZCultureFit', event.target.checked)}
              />
              Enable NZ culture fit prompts
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600" onClick={onSaveDefaults}>
              Save defaults
            </button>
            <button className="rounded-full border border-emerald-200 px-5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-white" onClick={onResetDefaults}>
              Reset defaults
            </button>
            {settingsSaved ? <span className="text-sm font-medium text-emerald-700">{settingsSaved}</span> : null}
          </div>
        </div>
      )}

      <div className="absolute right-[-20px] top-[-20px] z-0 flex h-64 w-64 items-center justify-center rounded-full bg-gray-50 opacity-50">
        <Mic size={100} className="text-gray-200" />
      </div>
    </div>
  );
}
