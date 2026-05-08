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
import { controlModeOptions, focusOptions, questionLimitOptions, seniorityOptions, timeLimitOptions } from '../../utils/sessionSettings.js';

/**
 * Purpose: Execute the main responsibility for StartSessionCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function StartSessionCard({ summary, showSessionSettings, sessionDefaults, settingsSaved, voiceStartWarning, onOpenTextInterview, onOpenVoiceInterview, onToggleSettings, onChangeDefaults, onSaveDefaults, onResetDefaults }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 xl:p-8">
      <div className="relative z-10 flex flex-col items-stretch justify-between gap-6 xl:flex-row xl:items-center">
        <div className="max-w-md">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Interview practice</p>
          <h1 className="mb-3 text-3xl font-extrabold">Start a new session</h1>
          <p className="mb-6 text-sm leading-6 text-gray-600">
            Fast, NZ-focused interview practice for pronunciation, timing and clarity.
            Securely recorded to your Google account with NZ privacy compliance.
          </p>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Current setup</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-semibold text-gray-700">Level: {summary.level}</span>
              <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-semibold text-gray-700">Focus: {summary.focus}</span>
              <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-semibold text-gray-700">Limit: {summary.limit}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:flex xl:flex-wrap">
            <button
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              onClick={onOpenTextInterview}
            >
              Start text interview
            </button>
            <button
              className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
              onClick={onOpenVoiceInterview}
            >
              Start voice interview
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              onClick={onToggleSettings}
            >
              <Settings size={16} /> Session Settings
            </button>
          </div>
          {voiceStartWarning ? (
            <p className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
              {voiceStartWarning}
            </p>
          ) : null}
        </div>

        <div className="relative z-10 w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:p-6 xl:max-w-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">Practice Snapshot</div>
              <div className="text-xs text-gray-400">Preview of the default session mode</div>
            </div>
            <div className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">Ready</div>
          </div>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between"><span>Delivery</span><span className="font-semibold text-gray-900">Choose at start</span></div>
            <div className="flex justify-between"><span>Interview mode</span><span className="font-semibold text-gray-900">{summary.controlMode}</span></div>
            <div className="flex justify-between"><span>Question type</span><span className="font-semibold text-gray-900">{summary.focus}</span></div>
            <div className="flex justify-between"><span>Limit</span><span className="font-semibold text-gray-900">{summary.limit}</span></div>
          </div>
          <div className="mt-5 rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm">
            <div className="mb-2 font-semibold text-gray-900">Coaching setup</div>
            <div className="space-y-2">
              <div>{summary.level} role simulation</div>
              <div>{summary.focus} question mix</div>
              <div>{summary.controlMode}: {summary.limit}</div>
              <div>NZ culture fit: {summary.nzContext}</div>
            </div>
          </div>
        </div>
      </div>

      {showSessionSettings && (
        <div className="relative z-10 mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="text-sm font-medium text-gray-700">
              Seniority level
              <select
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm outline-none"
                value={sessionDefaults.seniorityLevel}
                onChange={(event) => onChangeDefaults('seniorityLevel', event.target.value)}
              >
                {seniorityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Question type
              <select
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm outline-none"
                value={sessionDefaults.focusArea}
                onChange={(event) => onChangeDefaults('focusArea', event.target.value)}
              >
                {focusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Interview mode
              <select
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm outline-none"
                value={sessionDefaults.controlMode}
                onChange={(event) => onChangeDefaults('controlMode', event.target.value)}
              >
                {controlModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {sessionDefaults.controlMode === 'time_limited' ? (
              <label className="text-sm font-medium text-gray-700">
                Time limit
                <select
                  className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm outline-none"
                  value={sessionDefaults.timeLimitMinutes}
                  onChange={(event) => onChangeDefaults('timeLimitMinutes', Number(event.target.value))}
                >
                  {timeLimitOptions.map((option) => (
                    <option key={option} value={option}>{option} minutes total</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-sm font-medium text-gray-700">
                Question limit
                <select
                  className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm outline-none"
                  value={sessionDefaults.questionLimit}
                  onChange={(event) => onChangeDefaults('questionLimit', Number(event.target.value))}
                >
                  {questionLimitOptions.map((option) => (
                    <option key={option} value={option}>{option} questions</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm">
              <input
                type="checkbox"
                checked={sessionDefaults.enableNZCultureFit}
                onChange={(event) => onChangeDefaults('enableNZCultureFit', event.target.checked)}
              />
              Enable NZ culture fit prompts
            </label>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
            Voice readiness check now runs inside the Voice Session screen. Text Session can use the same setup without microphone checks.
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600" onClick={onSaveDefaults}>
              Save defaults
            </button>
            <button className="rounded-xl border border-emerald-200 px-5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-white" onClick={onResetDefaults}>
              Reset defaults
            </button>
            {settingsSaved ? <span className="text-sm font-medium text-emerald-700">{settingsSaved}</span> : null}
          </div>
        </div>
      )}

      <div className="absolute right-[-20px] top-[-20px] z-0 flex h-64 w-64 items-center justify-center rounded-full bg-gray-50 opacity-40">
        <Mic size={100} className="text-gray-200" />
      </div>
    </div>
  );
}
