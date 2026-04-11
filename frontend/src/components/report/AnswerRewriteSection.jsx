/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: AnswerRewriteSection should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

/**
 * Purpose: Execute the main responsibility for AnswerRewriteSection.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function AnswerRewriteSection({ answerRewriteTips }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How To Answer Better</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {answerRewriteTips.map((item, index) => (
            <div key={`${item.weak}-${index}`} className="rounded-2xl border border-gray-100 p-4">
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Weaker version</p>
                <p className="mt-2 text-sm leading-6 text-rose-900">{item.weak}</p>
              </div>
              <div className="mt-3 rounded-xl bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Stronger version</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">{item.better}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
