import { describe, expect, it } from 'vitest';

import {
  buildSessionSetupPayload,
  focusDisplayOptions,
  focusOptions,
  getFocusAreaLabel,
} from '../sessionSettings.js';
import { buildInterviewDisplayModel } from '../buildInterviewDisplayModel.js';

describe('role-specific focus display contract', () => {
  it('shows Role-specific / Technical while preserving the Technical API value', () => {
    expect(focusOptions).toContain('Technical');
    expect(focusDisplayOptions || []).toContainEqual({ value: 'Technical', label: 'Role-specific / Technical' });
    expect(getFocusAreaLabel?.('Technical') || '').toBe('Role-specific / Technical');
    expect(buildSessionSetupPayload({ focusArea: 'Technical' }, 'text').questionType).toBe('Technical');
  });

  it('uses cross-role competency language in the interview promise', () => {
    const model = buildInterviewDisplayModel({
      targetRole: 'Registered Nurse',
      settings: { focusArea: 'Technical', seniorityLevel: 'Intermediate' },
    });

    expect(model.focusLabel).toBe('Role-specific / Technical');
    expect(model.promiseLabel).toMatch(/role|method|judgement|risk|validation|outcome/i);
    expect(model.promiseLabel).not.toMatch(/tools|implementation choices/i);
  });
});
