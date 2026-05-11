/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: QuickTipsCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';

/**
 * Purpose: Execute the main responsibility for QuickTipsCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function QuickTipsCard() {
  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-primary">Quick Tips</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent">NZ Focus</span>
      </div>
      <ul className="mb-5 space-y-3 text-sm leading-relaxed text-muted">
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full [background:var(--accent-bright)]" />
          Speak clearly at a steady pace. Aim for 140–160 wpm for technical answers.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full [background:var(--accent-bright)]" />
          Emphasize keywords in NZ English: 'process', 'schedule', 'route'.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full [background:var(--accent-bright)]" />
          Use timed mode to build concise answers under pressure.
        </li>
      </ul>
      <div className="border-t border-theme pt-4">
        <div className="flex h-16 w-full items-end rounded-xl border [border-color:var(--accent)] bg-chip p-2">
          <TrendingUp className="h-full w-full text-accent opacity-30" />
        </div>
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-faint">Weekly practice trend</div>
      </div>
    </div>
  );
}
