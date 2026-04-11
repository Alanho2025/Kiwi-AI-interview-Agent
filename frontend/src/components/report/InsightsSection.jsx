/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: InsightsSection should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

/**
 * Purpose: Execute the main responsibility for InsightsSection.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function InsightsSection({ dataInsights, strengthHighlights }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>What The Data Says</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dataInsights.map((insight) => (
              <div key={insight.title || insight.label || insight.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{insight.title || insight.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-700">{insight.description || insight.interpretation}</p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
                    {insight.metric || insight.value || '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What You Did Well</CardTitle>
        </CardHeader>
        <CardContent>
          {strengthHighlights.length ? (
            <div className="space-y-3">
              {strengthHighlights.map((item) => (
                <div key={item.title || item.label} className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-900">{item.title || item.label || item}</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">{item.explanation || 'This showed up as one of your clearer match signals for the role. Keep backing it up with specific examples.'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-gray-700">No standout strengths were captured yet. Generating a fresh report after a fuller interview may produce more useful highlights.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
