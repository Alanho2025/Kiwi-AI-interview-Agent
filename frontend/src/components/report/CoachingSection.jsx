/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: CoachingSection should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

/**
 * Purpose: Execute the main responsibility for CoachingSection.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function CoachingSection({ improvementPriorities, coachingAdvice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Priority Improvements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {improvementPriorities.map((item) => (
              <div key={item.title} className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <h3 className="text-base font-semibold text-sky-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-sky-900">{item.whyItMatters || item.detail}</p>
                <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm leading-6 text-sky-900">
                  <span className="font-semibold">What to do next:</span> {item.action || item.example}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Coaching</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {coachingAdvice.map((item, index) => (
              <div key={`${item.theme || item.weak}-${index}`} className="rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{item.theme || 'Coaching point'}</p>
                <p className="mt-2 text-sm leading-6 text-gray-800">{item.advice}</p>
                <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm leading-6 text-sky-900">
                  <span className="font-semibold">Try this next time:</span> {item.example}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
