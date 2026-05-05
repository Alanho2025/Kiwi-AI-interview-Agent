/**
 * File responsibility: Reusable session setup card.
 * Main responsibilities:
 * - Render the same interview settings used on the Home page.
 * - Let users choose Text Session or Voice Session before generating the plan.
 * - Render the Voice readiness check directly on Analyze when Voice Session is selected.
 */

import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Select } from '../common/Select.jsx';
import { Checkbox } from '../common/Checkbox.jsx';
import { VoiceDeviceCheckPanel } from './VoiceDeviceCheckPanel.jsx';
import { cn } from '../../utils/formatters.js';
import {
  controlModeOptions,
  focusOptions,
  questionLimitOptions,
  seniorityOptions,
  sessionModeOptions,
  timeLimitOptions,
} from '../../utils/sessionSettings.js';

const toSelectOptions = (values, labelBuilder = (value) => value) => values.map((value) => ({
  value,
  label: labelBuilder(value),
}));

export function NZSettingsCard({ settings, setSettings, sessionMode, setSessionMode, voiceDeviceCheck, setVoiceDeviceCheck }) {
  const updateSetting = (field, value) => setSettings({ ...settings, [field]: value });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Session Setup</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Use the same setup as the Home page, then choose text or voice before starting.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Delivery mode</h4>
            <Select
              options={sessionModeOptions}
              value={sessionMode}
              onChange={(event) => setSessionMode(event.target.value)}
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Seniority level</h4>
            <Select
              options={toSelectOptions(seniorityOptions)}
              value={settings.seniorityLevel}
              onChange={(event) => updateSetting('seniorityLevel', event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Interview mode</h4>
            <Select
              options={controlModeOptions}
              value={settings.controlMode}
              onChange={(event) => updateSetting('controlMode', event.target.value)}
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              {settings.controlMode === 'time_limited' ? 'Time limit' : 'Question limit'}
            </h4>
            {settings.controlMode === 'time_limited' ? (
              <Select
                options={toSelectOptions(timeLimitOptions, (value) => `${value} minutes total`)}
                value={settings.timeLimitMinutes}
                onChange={(event) => updateSetting('timeLimitMinutes', Number(event.target.value))}
              />
            ) : (
              <Select
                options={toSelectOptions(questionLimitOptions, (value) => `${value} questions`)}
                value={settings.questionLimit}
                onChange={(event) => updateSetting('questionLimit', Number(event.target.value))}
              />
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Question type</h4>
          <div className="flex flex-wrap gap-3">
            {focusOptions.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => updateSetting('focusArea', area)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                  settings.focusArea === area
                    ? 'border-[#2eb886] text-[#2eb886] bg-[#e6f7f0]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <Checkbox
          label="Enable NZ culture fit prompts"
          checked={settings.enableNZCultureFit}
          onChange={(event) => updateSetting('enableNZCultureFit', event.target.checked)}
        />

        {sessionMode === 'voice' ? (
          <VoiceDeviceCheckPanel value={voiceDeviceCheck} onChange={setVoiceDeviceCheck} />
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Text Session does not require microphone or speaker checks. Switch to Voice Session if you want to test your devices before starting.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
