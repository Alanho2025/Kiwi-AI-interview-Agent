import { describe, expect, it } from 'vitest';
import { resolveDraftWorkflowStep, WORKFLOW_STEP_IDS } from '../analyzePageBuilder.js';

const verifiedCv = {
  id: 'cv-reviewed',
  name: 'Reviewed CV.pdf',
};

const verifiedJdRubric = {
  title: 'Frontend Developer',
  jobOverview: { title: 'Frontend Developer' },
  sections: { mustHaveRequirements: ['React'] },
};

const buildReadyDraft = (overrides = {}) => ({
  selectedCV: verifiedCv,
  cvReviewStatus: 'verified',
  cvHumanReviewedFileId: verifiedCv.id,
  rawJD: 'Frontend Developer role requiring React and testing.',
  structuredJD: '# Frontend Developer',
  structuredJDRubric: verifiedJdRubric,
  summarizedRawJD: 'Frontend Developer role requiring React and testing.',
  jdReviewStatus: 'verified',
  ...overrides,
});

describe('analyze draft workflow state', () => {
  it('keeps a fully reviewed current draft in session setup', () => {
    expect(resolveDraftWorkflowStep(buildReadyDraft())).toBe(WORKFLOW_STEP_IDS.SESSION_SETUP);
  });

  it('sends stale CV review state back to CV review when the selected CV changes', () => {
    const draft = buildReadyDraft({
      selectedCV: { id: 'cv-new', name: 'New CV.pdf' },
      cvHumanReviewedFileId: verifiedCv.id,
    });

    expect(resolveDraftWorkflowStep(draft)).toBe(WORKFLOW_STEP_IDS.CV_REVIEW);
  });

  it('sends stale JD summary state back to JD input when raw JD text changes', () => {
    const draft = buildReadyDraft({
      rawJD: 'Different role requiring PostgreSQL and stakeholder reporting.',
    });

    expect(resolveDraftWorkflowStep(draft)).toBe(WORKFLOW_STEP_IDS.JD_INPUT);
  });
});
