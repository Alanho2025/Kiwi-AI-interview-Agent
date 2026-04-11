/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: NZSettingsCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Select } from '../common/Select.jsx';
import { Checkbox } from '../common/Checkbox.jsx';
import { cn } from '../../utils/formatters.js';

/**
 * Purpose: Execute the main responsibility for NZSettingsCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function NZSettingsCard({ settings, setSettings }) {
  const focusAreas = ['Technical', 'Behavioral', 'Combined'];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>NZ Context Settings</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Adjust the analysis to NZ expectations and your experience level.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Seniority Level</h4>
          <Select 
            options={[
              { value: 'Junior/Grad', label: 'Junior/Grad' },
              { value: 'Intermediate', label: 'Intermediate' },
              { value: 'Advanced', label: 'Advanced' }
            ]}
            value={settings.seniorityLevel}
            onChange={(e) => setSettings({ ...settings, seniorityLevel: e.target.value })}
          />
        </div>

        <Checkbox 
          label="Enable NZ Culture Fit Analysis" 
          checked={settings.enableNZCultureFit}
          onChange={(e) => setSettings({ ...settings, enableNZCultureFit: e.target.checked })}
        />

        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Focus Area</h4>
          <div className="flex gap-3">
            {focusAreas.map(area => (
              <button
                key={area}
                onClick={() => setSettings({ ...settings, focusArea: area })}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                  settings.focusArea === area 
                    ? "border-[#2eb886] text-[#2eb886] bg-[#e6f7f0]" 
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                )}
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
