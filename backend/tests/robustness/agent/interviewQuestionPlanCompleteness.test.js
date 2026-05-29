import { describe, expect, it } from 'vitest';
import {
  buildInterviewPlanPayload,
  buildQuestionPoolFromAnalysis,
} from '../../../src/services/session/sessionShared.js';

const buildRequirement = ({
  id,
  text,
  normalizedCapability = text,
  category = 'technical_skill',
  capabilityGroup = category,
  mustHave = true,
  importance = 'high',
} = {}) => ({
  id,
  text,
  normalizedCapability,
  category,
  capabilityGroup,
  mustHave,
  importance,
  evidenceNeeded: `The CV should show direct evidence for ${text}.`,
});

const buildAnalysis = ({
  roleTitle = 'Backend Developer',
  companyName = 'Halter',
  roleFamily = 'software_engineering',
  requirements = [
    buildRequirement({ id: 'req_api', text: 'API security with JWT and rate limiting', normalizedCapability: 'API security', category: 'technical_skill', capabilityGroup: 'technical_skill' }),
    buildRequirement({ id: 'req_python', text: 'Python model validation', normalizedCapability: 'Python model validation', category: 'technical_skill', capabilityGroup: 'technical_skill' }),
  ],
  mustProbeSkills = ['API security with JWT and rate limiting', 'Python model validation'],
  mustProbeBehavioural = ['teamwork', 'communication'],
  gaps = ['Need stronger validation evidence'],
} = {}) => ({
  schemaVersion: 'v3',
  jobTitle: roleTitle,
  companyName,
  matchScore: 72,
  decision: 'partial_match',
  confidence: 0.82,
  requirementChecks: [],
  explanation: { strengths: ['Relevant projects'], gaps },
  strengths: ['Backend development'],
  gaps,
  interviewFocus: ['API security', 'communication'],
  planPreview: 'Focus on technical validation and behavioural evidence.',
  parsedJdProfile: {
    title: roleTitle,
    roleFamily,
    companyName,
    jobOverview: { companyName },
    requiredSkills: requirements.map((item) => item.normalizedCapability),
    universalRoleProfile: {
      roleTitle,
      industry: roleFamily,
      requirements,
    },
  },
  parsedCvProfile: {
    skills: ['Node.js', 'JWT', 'Python', 'SQL'],
    projects: ['Interview Agent', 'Data Mining Model'],
  },
  matchingDetails: {
    questionPlanHints: {
      mustProbeSkills,
      mustProbeBehavioural,
      priorityTopics: [...mustProbeSkills, ...mustProbeBehavioural],
    },
    validationTargets: mustProbeSkills,
    missingRequiredSkills: gaps,
  },
});

const assertQuestionMetadata = (question) => {
  expect(question).toEqual(expect.objectContaining({
    type: expect.any(String),
    category: expect.any(String),
    stage: expect.any(String),
    topic: expect.any(String),
    text: expect.any(String),
    sourceType: expect.any(String),
    matchedRequirementId: expect.any(String),
    matchedSkill: expect.any(String),
    priority: expect.any(Number),
    planPriority: expect.any(Number),
    confidence: expect.any(Number),
  }));
  expect(question.text.trim().length).toBeGreaterThan(12);
};

const categories = (pool) => new Set(pool.map((item) => item.category));
const stages = (pool) => new Set(pool.map((item) => item.stage));
const byTopic = (pool, topic) => pool.filter((item) => item.topic === topic);
const evidenceQuestions = (pool) => pool.filter((item) => !['opening', 'motivation', 'wrap_up', 'closing'].includes(item.category));
const isTechnicalEvidenceQuestion = (item) => ['technical', 'role_competency'].includes(item.category) || ['technical_core', 'technical_follow_up', 'role_competency_core', 'role_competency_follow_up'].includes(item.type);
const isBehaviouralEvidenceQuestion = (item) => item.category === 'behavioural' || ['behavioural', 'behavioural_follow_up'].includes(item.type);

describe('interview question plan completeness', () => {
  it('builds a complete combined question pool with opening, motivation, technical, behavioural, follow-up, and wrap-up questions', () => {
    const pool = buildQuestionPoolFromAnalysis(buildAnalysis(), {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'combined',
      questionLimit: 8,
    });

    expect(pool.length).toBeGreaterThanOrEqual(8);
    expect(pool[0]).toMatchObject({ type: 'self_intro', category: 'opening', stage: 'opening', topic: 'self_intro' });
    expect(pool[1]).toMatchObject({ type: 'company_motivation', category: 'motivation', topic: 'company_and_role_motivation' });
    expect([...categories(pool)]).toEqual(expect.arrayContaining(['opening', 'motivation', 'technical', 'behavioural']));
    expect([...stages(pool)]).toEqual(expect.arrayContaining(['opening', 'motivation', 'technical', 'behavioural']));
    expect(pool.at(-1).type).toMatch(/wrap/i);
    pool.forEach(assertQuestionMetadata);
  });

  it('keeps technical-only evidence slots free from behavioural probing questions', () => {
    const pool = buildQuestionPoolFromAnalysis(buildAnalysis(), {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'technical',
      questionLimit: 8,
    });

    const probingQuestions = evidenceQuestions(pool);
    expect(probingQuestions.length).toBeGreaterThan(0);
    expect(probingQuestions.every(isTechnicalEvidenceQuestion)).toBe(true);
    expect(probingQuestions.some(isBehaviouralEvidenceQuestion)).toBe(false);
  });

  it('keeps behavioural-only evidence slots free from technical probing questions', () => {
    const pool = buildQuestionPoolFromAnalysis(buildAnalysis(), {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'behavioural',
      questionLimit: 8,
    });

    const probingQuestions = evidenceQuestions(pool);
    expect(probingQuestions.length).toBeGreaterThan(0);
    expect(probingQuestions.every(isBehaviouralEvidenceQuestion)).toBe(true);
    expect(probingQuestions.some(isTechnicalEvidenceQuestion)).toBe(false);
  });

  it('creates main and follow-up questions for each generated technical requirement topic', () => {
    const topic = 'API security with JWT and rate limiting';
    const pool = buildQuestionPoolFromAnalysis(buildAnalysis({ mustProbeSkills: [topic] }), {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'technical',
      questionLimit: 8,
    });
    const topicQuestions = byTopic(pool, topic);

    expect(topicQuestions.some((item) => item.followUpDepth === 0)).toBe(true);
    expect(topicQuestions.some((item) => item.followUpDepth === 1)).toBe(true);
    expect(topicQuestions.find((item) => item.followUpDepth === 0)?.type).toBe('technical_core');
    expect(topicQuestions.find((item) => item.followUpDepth === 1)?.type).toBe('technical_follow_up');
  });

  it('creates main and follow-up questions for each behavioural topic', () => {
    const pool = buildQuestionPoolFromAnalysis(buildAnalysis({ mustProbeBehavioural: ['teamwork'] }), {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'behavioural',
      questionLimit: 8,
    });
    const topicQuestions = byTopic(pool, 'teamwork');

    expect(topicQuestions.some((item) => item.type === 'behavioural' && item.followUpDepth === 0)).toBe(true);
    expect(topicQuestions.some((item) => item.type === 'behavioural_follow_up' && item.followUpDepth === 1)).toBe(true);
    expect(topicQuestions.every((item) => item.text.toLowerCase().includes('teamwork') || item.text.length > 20)).toBe(true);
  });

  it('uses non-IT role competency wording for customer/stakeholder requirements', () => {
    const requirementText = 'Ability to handle customer complaints in a fast-paced environment';
    const pool = buildQuestionPoolFromAnalysis(buildAnalysis({
      roleTitle: 'Customer Service Representative',
      roleFamily: 'customer_service',
      requirements: [buildRequirement({
        id: 'req_customer',
        text: requirementText,
        normalizedCapability: 'customer complaint handling',
        category: 'customer_or_stakeholder',
        capabilityGroup: 'customer_or_stakeholder',
      })],
      mustProbeSkills: [requirementText],
    }), {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'technical',
      questionLimit: 6,
    });
    const question = pool.find((item) => item.category === 'role_competency' && item.followUpDepth === 0);

    expect(question).toMatchObject({ type: 'role_competency_core', sourceType: 'universal_requirement_competency' });
    expect(question.text).toMatch(/client|customer|stakeholder/i);
    expect(question.text).not.toMatch(/implementation|debugging|code|API endpoint/i);
  });

  it('keeps technical wording for IT tool requirements', () => {
    const topic = 'React frontend development';
    const pool = buildQuestionPoolFromAnalysis(buildAnalysis({
      roleTitle: 'Frontend Developer',
      requirements: [buildRequirement({ id: 'req_react', text: topic, normalizedCapability: topic, category: 'technical_skill', capabilityGroup: 'technical_skill' })],
      mustProbeSkills: [topic],
    }), {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'technical',
      questionLimit: 6,
    });
    const question = pool.find((item) => item.category === 'technical' && item.followUpDepth === 0);

    expect(question).toMatchObject({ type: 'technical_core' });
    expect(question.text).toMatch(/project|used|technical|approach/i);
    expect(question.text).not.toMatch(/client, customer, referrer, or stakeholder/i);
  });

  it('falls back safely when JD hints are missing', () => {
    const analysis = buildAnalysis({ mustProbeSkills: [], mustProbeBehavioural: [] });
    analysis.matchingDetails.questionPlanHints = {};
    const pool = buildQuestionPoolFromAnalysis(analysis, {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'combined',
      questionLimit: 8,
    });

    expect(pool.length).toBeGreaterThanOrEqual(6);
    expect(pool[0].type).toBe('self_intro');
    expect(pool.some((item) => item.topic === 'a relevant role capability')).toBe(true);
    expect(pool.some((item) => item.category === 'behavioural')).toBe(true);
    pool.forEach(assertQuestionMetadata);
  });

  it('keeps priority metadata numeric and preserves stable opening/motivation ordering', () => {
    const pool = buildQuestionPoolFromAnalysis(buildAnalysis(), {
      seniorityLevel: 'Junior/Grad',
      focusArea: 'combined',
      questionLimit: 8,
    });

    pool.forEach((item) => {
      expect(Number.isFinite(item.priority)).toBe(true);
      expect(Number.isFinite(item.planPriority)).toBe(true);
    });
    expect(pool[0]).toMatchObject({ type: 'self_intro', planPriority: 1 });
    expect(pool[1]).toMatchObject({ type: 'company_motivation', planPriority: 2 });
    expect(pool.at(-1).category).toMatch(/wrap|closing/);
  });

  it('builds a complete interview plan payload with schema, strategy, settings snapshot, and question pool', () => {
    const normalizedAnalysis = buildAnalysis();
    const payload = buildInterviewPlanPayload({
      normalizedAnalysis,
      settings: {
        seniorityLevel: 'Junior/Grad',
        focusArea: 'combined',
        questionLimit: 8,
        controlMode: 'question_limited',
      },
      resolvedCandidateName: 'Alan',
      resolvedTargetRole: 'Backend Developer',
    });

    expect(payload).toMatchObject({
      schemaVersion: 'v3',
      candidateName: 'Alan',
      jobTitle: 'Backend Developer',
      matchScore: 72,
      strategy: expect.any(Object),
      fallbackRules: { short_answer: 'ask_probe', time_low: 'end_early' },
      settingsSnapshot: expect.objectContaining({ focusArea: 'combined' }),
    });
    expect(payload.interviewModeKey || payload.strategy?.interviewModeKey || payload.settingsSnapshot?.focusArea).toBeTruthy();
    expect(Array.isArray(payload.questionPool)).toBe(true);
    expect(payload.questionPool.length).toBeGreaterThanOrEqual(8);
    payload.questionPool.forEach(assertQuestionMetadata);
  });
});
