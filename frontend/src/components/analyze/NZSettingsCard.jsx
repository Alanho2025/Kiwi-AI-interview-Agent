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
          <CardTitle>Session setup</CardTitle>
          <p className="text-sm text-faint mt-1">Choose how this practice session should run before generating the match.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-primary mb-2">Practice mode</h4>
            <Select
              options={sessionModeOptions}
              value={sessionMode}
              onChange={(event) => setSessionMode(event.target.value)}
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-primary mb-2">Seniority level</h4>
            <Select
              options={toSelectOptions(seniorityOptions)}
              value={settings.seniorityLevel}
              onChange={(event) => updateSetting('seniorityLevel', event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-primary mb-2">Session limit</h4>
            <Select
              options={controlModeOptions}
              value={settings.controlMode}
              onChange={(event) => updateSetting('controlMode', event.target.value)}
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-primary mb-2">
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
          <h4 className="text-sm font-medium text-primary mb-3">Question focus</h4>
          <div className="flex flex-wrap gap-3">
            {focusOptions.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => updateSetting('focusArea', area)}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
                  settings.focusArea === area
                    ? '[border-color:var(--accent)] text-accent [background:var(--accent-glow)]'
                    : 'border-theme text-muted hover:border-theme'
                )}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <Checkbox
          label="Include NZ workplace fit prompts"
          checked={settings.enableNZCultureFit}
          onChange={(event) => updateSetting('enableNZCultureFit', event.target.checked)}
        />

        {sessionMode === 'voice' ? (
          <VoiceDeviceCheckPanel value={voiceDeviceCheck} onChange={setVoiceDeviceCheck} />
        ) : (
          <div className="rounded-xl border border-theme bg-transparent px-4 py-3 text-sm leading-6 text-muted">
            Text practice is ready. Switch to voice mode if you want to test your microphone and speaker first.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
