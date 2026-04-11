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
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Quick Tips</h3>
        <span className="text-xs text-gray-400">Bite-sized</span>
      </div>
      <ul className="mb-6 space-y-4 text-sm text-gray-600">
        <li>Speak clearly at a steady pace. Aim for 140-160 wpm for technical answers.</li>
        <li>Emphasize keywords in NZ English pronunciations: 'process', 'schedule', 'route'.</li>
        <li>Use the timed mode to build concise answers under pressure.</li>
      </ul>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex h-24 w-full items-end rounded-lg border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-2">
          <TrendingUp className="h-full w-full text-emerald-300 opacity-50" />
        </div>
        <div className="mt-2 text-[10px] text-gray-400">Weekly practice trend</div>
      </div>
    </div>
  );
}
