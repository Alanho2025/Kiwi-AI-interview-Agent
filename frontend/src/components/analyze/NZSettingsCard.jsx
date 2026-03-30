import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Select } from '../common/Select.jsx';
import { Checkbox } from '../common/Checkbox.jsx';
import { cn } from '../../utils/formatters.js';

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
