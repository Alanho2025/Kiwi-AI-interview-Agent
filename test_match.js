import { compareCvToJobDescriptionWithSafeguard } from './backend/src/services/match/guardedMatchService.js';

const cvText = `Ava Chen
Data Engineer

Built Python and SQL data pipelines for customer analytics projects.
Used PostgreSQL, Linux, Git, and dashboard validation to clean data and check output quality.
Documented data workflows and explained pipeline trade-offs to stakeholders.`;

const blockedJdRubric = {
  schemaVersion: 'v3',
  title: 'Data Engineer',
  jobTitle: 'Data Engineer',
  jobOverview: { title: 'Data Engineer' },
  sections: {
    responsibilities: ['Build Python and SQL data pipelines for analytics use cases.'],
    mustHaveRequirements: ['Python', 'SQL'],
    technicalSkills: {
      data: [{ label: 'Python' }, { label: 'SQL' }, { label: 'PostgreSQL' }],
    },
  },
  mustHaveRequirements: ['Python', 'SQL'],
  technicalSkillRequirements: ['Python', 'SQL', 'PostgreSQL'],
  weights: {
    overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
    macro: { technical_expertise: 1 },
    micro: { python: 0.5, sql: 0.5 },
  },
  macroCriteria: [{ label: 'Technical expertise', weight: 1 }],
  microCriteria: [
    { label: 'Python', weight: 0.5 },
    { label: 'SQL', weight: 0.5 },
  ],
  requirements: [
    { label: 'Python', type: 'hard', importance: 'high' },
    { label: 'SQL', type: 'hard', importance: 'high' },
  ],
  safeguard: {
    verdict: 'reject',
    confidence: 0.42,
    blockMatch: true,
    finalStatus: 'needs_manual_jd_review',
    issues: [{ field: 'requirements', severity: 'high', problem: 'JD parse needs review.', action: 'Confirm extracted fields.' }],
  },
  metadata: {
    safeguard: {
      verdict: 'reject',
      confidence: 0.42,
      blockMatch: true,
      finalStatus: 'needs_manual_jd_review',
    },
  },
};

const reviewedRubric = {
  ...blockedJdRubric,
  metadata: {
    ...blockedJdRubric.metadata,
    humanReviewStatus: 'verified',
    inputTrustLevel: 'human_reviewed',
  },
};

compareCvToJobDescriptionWithSafeguard(cvText, 'Data Engineer JD', reviewedRubric)
  .then(res => console.log('Decision:', res.decision, 'Confidence:', res.confidence))
  .catch(console.error);

