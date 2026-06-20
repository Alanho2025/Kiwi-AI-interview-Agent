import { describe, expect, it } from 'vitest';

import * as turnRubricService from '../../../src/services/report/turnRubricService.js';

const { analyzeTurnStructure, inferTurnRubric } = turnRubricService;

describe('role-specific report frameworks', () => {
  it('keeps behavioural project questions on STARR', () => {
    const rubric = inferTurnRubric({
      question: 'Tell me about a project where you resolved conflict in your team.',
      metadata: {
        questionFamily: 'behavioural',
        capabilityGroup: 'stakeholder_collaboration',
      },
    });

    expect(rubric).toMatchObject({
      rubricType: 'starr',
      frameworkKey: 'behavioural_starr',
      starApplicable: true,
    });
  });

  it.each([
    ['technical_or_tool_skill', 'past_example', 'role_specific_reasoning', 'Role-specific Reasoning'],
    ['compliance_ethics_safety', 'past_example', 'safety_quality_ethics', 'Safety, Quality & Ethics'],
    ['customer_or_client_focus', 'past_example', 'service_stakeholder_reasoning', 'Service & Stakeholder Reasoning'],
    ['planning_and_organisation', 'past_example', 'planning_delivery', 'Planning & Delivery'],
    ['research_and_learning', 'past_example', 'learning_design', 'Learning & Design'],
    ['field_or_practical_work', 'past_example', 'role_specific_reasoning', 'Role-specific Reasoning'],
    ['professional_credential', 'credential_verification', 'credential_verification', 'Credential & Registration Evidence'],
    ['service_delivery', 'scenario_reasoning', 'scenario_case_reasoning', 'Scenario / Case Reasoning'],
    ['domain_knowledge', 'knowledge_explanation', 'knowledge_explanation', 'Knowledge Explanation'],
  ])('maps %s with %s to %s', (capabilityGroup, evidenceMode, frameworkKey, frameworkLabel) => {
    const rubric = inferTurnRubric({
      question: 'Explain how you would handle this role-specific requirement.',
      metadata: {
        questionFamily: 'role_specific',
        capabilityGroup,
        evidenceMode,
      },
    });

    expect(rubric).toMatchObject({
      rubricType: 'role_specific',
      frameworkKey,
      frameworkLabel,
      starApplicable: false,
    });
  });

  it('analyzes a technical project with the universal role-specific framework instead of STAR', () => {
    const structure = analyzeTurnStructure({
      question: 'Tell me about a practical project where you made an important implementation decision.',
      answer: 'During a reporting project, the goal was to reduce manual work. I compared two approaches and chose a controlled workflow because it was easier to review. The trade-off was speed versus auditability, so I added quality checks and access controls. I verified the output through reconciliation and stakeholder review, and the outcome was a faster, more reliable monthly process.',
      metadata: {
        questionFamily: 'role_specific',
        evidenceMode: 'past_example',
        capabilityGroup: 'technical_or_tool_skill',
      },
    });

    expect(structure).toMatchObject({
      rubricType: 'role_specific',
      frameworkKey: 'role_specific_reasoning',
      starApplicable: false,
      starBreakdown: null,
    });
    const dimensions = structure.frameworkBreakdown?.dimensions || [];
    expect(dimensions.map((item) => item.label)).toEqual([
      'Context / Goal',
      'Approach',
      'Judgement / Trade-offs',
      'Risk / Quality / Ethics',
      'Validation / Verification',
      'Outcome / Value',
    ]);
    expect(structure.frameworkBreakdown?.totalScore).toBeGreaterThanOrEqual(45);
  });

  it('scores a teacher scenario from reasoning without requiring past experience', () => {
    const structure = analyzeTurnStructure({
      question: 'How would you adapt a lesson when learners have different needs?',
      answer: 'I would first clarify the learner requirements, compare whole-class and small-group options, and choose small-group instruction because it supports different needs. I would manage safeguarding and inclusion risks, check understanding through formative assessment, and adjust the approach based on the results.',
      metadata: {
        questionFamily: 'role_specific',
        evidenceMode: 'scenario_reasoning',
        capabilityGroup: 'service_delivery',
        roleDomain: 'education',
      },
    });

    expect(structure.frameworkKey).toBe('scenario_case_reasoning');
    const dimensions = structure.frameworkBreakdown?.dimensions || [];
    expect(dimensions.map((item) => item.label)).toEqual([
      'Requirements',
      'Options',
      'Reasoning',
      'Risk / Quality / Ethics',
      'Validation / Verification',
      'Expected Outcome',
    ]);
    expect(structure.frameworkBreakdown?.totalScore).toBeGreaterThanOrEqual(40);
  });

  it('uses credential evidence without requiring an outcome dimension', () => {
    const structure = analyzeTurnStructure({
      question: 'What evidence can you provide for your professional registration?',
      answer: 'I hold a current registration that is valid until next year. My scope covers supervised practice, and the employer can verify the registration and its conditions with the professional board.',
      metadata: {
        questionFamily: 'role_specific',
        evidenceMode: 'credential_verification',
        capabilityGroup: 'professional_credential',
      },
    });

    const dimensions = structure.frameworkBreakdown?.dimensions || [];
    expect(dimensions.map((item) => item.label)).toEqual([
      'Evidence',
      'Validity',
      'Scope',
      'Conditions',
      'Verification',
    ]);
    expect(dimensions.some((item) => /outcome|value/i.test(item.label))).toBe(false);
  });

  it('does not claim domain correctness for an ungrounded knowledge explanation', () => {
    const structure = analyzeTurnStructure({
      question: 'Explain the professional principle you would apply.',
      answer: 'The principle is to document assumptions, apply it within its limits, consider quality risks, and verify the conclusion through review.',
      metadata: {
        questionFamily: 'role_specific',
        evidenceMode: 'knowledge_explanation',
        capabilityGroup: 'domain_knowledge',
      },
    });

    const dimensions = structure.frameworkBreakdown?.dimensions || [];
    expect(dimensions.some((item) => item.key === 'domainCorrectness')).toBe(false);
    expect(String(structure.frameworkBreakdown?.summary || '')).toContain('structure and evidence');
  });

  it('excludes not-applicable dimensions from framework score calculation', () => {
    const result = turnRubricService.calculateFrameworkScore?.([
      { status: 'clear', score: 10 },
      { status: 'partial', score: 5 },
      { status: 'not_applicable', score: 0 },
    ]);

    expect(result).toEqual({ totalScore: 15, maxScore: 20, normalizedScore: 7.5 });
  });

  it.each([
    [
      'Please introduce yourself and explain your relevance to this role.',
      'I have five years of healthcare experience. In my current role I support patient care and led a documentation review. This is relevant because the position needs careful communication and evidence-based practice.',
      { questionFamily: 'self_intro' },
      'self_intro',
      ['Background', 'Role Relevance', 'Evidence', 'Clarity'],
    ],
    [
      'Why are you interested in this company and role?',
      'I am interested because the organisation focuses on community outcomes. The role matches my experience, and my service improvement work is relevant to the responsibilities.',
      { questionFamily: 'motivation' },
      'company_motivation',
      ['Company Reason', 'Role Reason', 'Candidate Evidence', 'Specificity'],
    ],
  ])('scores dedicated introduction and motivation frameworks', (question, answer, metadata, rubricType, labels) => {
    const structure = analyzeTurnStructure({ question, answer, metadata });

    expect(structure.rubricType).toBe(rubricType);
    expect(structure.starApplicable).toBe(false);
    expect((structure.frameworkBreakdown?.dimensions || []).map((item) => item.label)).toEqual(labels);
    expect(structure.frameworkBreakdown?.normalizedScore).toBeGreaterThan(0);
  });

  it.each([
    ['software', 'technical_or_tool_skill', 'role_specific_reasoning'],
    ['healthcare', 'compliance_ethics_safety', 'safety_quality_ethics'],
    ['finance', 'compliance_ethics_safety', 'safety_quality_ethics'],
    ['sales', 'customer_or_client_focus', 'service_stakeholder_reasoning'],
    ['education', 'service_delivery', 'service_stakeholder_reasoning'],
    ['field_work', 'field_or_practical_work', 'role_specific_reasoning'],
  ])('supports the %s role domain without changing the internal capability taxonomy', (roleDomain, capabilityGroup, frameworkKey) => {
    const rubric = inferTurnRubric({
      question: 'Tell me about a role-specific example.',
      metadata: { questionFamily: 'role_specific', evidenceMode: 'past_example', roleDomain, capabilityGroup },
    });

    expect(rubric).toMatchObject({ roleDomain, capabilityGroup, frameworkKey, starApplicable: false });
  });
});
