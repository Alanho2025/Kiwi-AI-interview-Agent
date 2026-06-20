const dimension = (key, label, patterns) => ({ key, label, patterns });

export const ANSWER_FRAMEWORKS = Object.freeze({
  role_specific_reasoning: {
    label: 'Role-specific Reasoning',
    dimensions: [
      dimension('contextGoal', 'Context / Goal', [/\b(context|goal|objective|problem|task|needed|required|during|when)\b/i]),
      dimension('approach', 'Approach', [/\b(approach|method|used|applied|created|planned|assessed|reviewed|implemented|workflow|responded|coordinated|managed)\b/i]),
      dimension('judgementTradeoffs', 'Judgement / Trade-offs', [/\b(because|chose|compared|trade-?off|instead|option|prioriti[sz]|judgement|reason)\b/i]),
      dimension('riskQualityEthics', 'Risk / Quality / Ethics', [/\b(risk|quality|safety|ethic|compliance|control|privacy|safeguard|inclusion|error|reliab|security|audit)\w*/i]),
      dimension('validationVerification', 'Validation / Verification', [/\b(validat|verif|test|check|review|reconcil|inspect|assess|measur|feedback|document|audit)\w*/i]),
      dimension('outcomeValue', 'Outcome / Value', [/\b(outcome|result|impact|improv|reduc|increas|saved|faster|resolved|completed|reliable|value)\w*/i]),
    ],
  },
  scenario_case_reasoning: {
    label: 'Scenario / Case Reasoning',
    dimensions: [
      dimension('requirements', 'Requirements', [/\b(requirement|need|clarif|constraint|goal|objective)\w*/i]),
      dimension('options', 'Options', [/\b(option|compare|alternative|versus|instead|whole-class|small-group)\w*/i]),
      dimension('reasoning', 'Reasoning', [/\b(because|choose|chose|reason|therefore|so that|supports?)\b/i]),
      dimension('riskQualityEthics', 'Risk / Quality / Ethics', [/\b(risk|quality|safety|ethic|compliance|safeguard|inclusion|privacy|control)\w*/i]),
      dimension('validationVerification', 'Validation / Verification', [/\b(validat|verif|test|check|review|assess|measur|feedback|inspect|reconcil)\w*/i]),
      dimension('expectedOutcome', 'Expected Outcome', [/\b(outcome|result|impact|improv|support|adjust|resolve|complete)\w*/i]),
    ],
  },
  knowledge_explanation: {
    label: 'Knowledge Explanation',
    dimensions: [
      dimension('principle', 'Principle', [/\b(principle|standard|framework|method|model|rule)\w*/i]),
      dimension('application', 'Application', [/\b(apply|use|practice|context|case|example)\w*/i]),
      dimension('assumptionsLimits', 'Assumptions / Limits', [/\b(assumption|limit|condition|scope|depend|constraint)\w*/i]),
      dimension('riskQualityEthics', 'Risk / Quality / Ethics', [/\b(risk|quality|safety|ethic|compliance|privacy|control)\w*/i]),
      dimension('verification', 'Verification', [/\b(verif|validat|check|review|assess|test|audit|evidence)\w*/i]),
    ],
  },
  credential_verification: {
    label: 'Credential & Registration Evidence',
    dimensions: [
      dimension('evidence', 'Evidence', [/\b(hold|registration|certificate|licen[cs]e|qualification|evidence|document)\w*/i]),
      dimension('validity', 'Validity', [/\b(current|valid|expiry|expires|until|renew)\w*/i]),
      dimension('scope', 'Scope', [/\b(scope|cover|authori[sz]|practice|permitted)\w*/i]),
      dimension('conditions', 'Conditions', [/\b(condition|supervis|restriction|required|provisional)\w*/i]),
      dimension('verification', 'Verification', [/\b(verif|board|register|document|check|reference)\w*/i]),
    ],
  },
  safety_quality_ethics: {
    label: 'Safety, Quality & Ethics',
    dimensions: [
      dimension('contextRequirement', 'Context / Requirement', [/\b(context|requirement|standard|policy|case|task|responsib)\w*/i]),
      dimension('riskIdentification', 'Risk Identification', [/\b(risk|hazard|harm|error|failure|unsafe|consequence)\w*/i]),
      dimension('controls', 'Controls / Action', [/\b(control|prevent|protect|safeguard|procedure|checklist|access|contain)\w*/i]),
      dimension('ethicsEscalation', 'Ethics / Escalation', [/\b(ethic|consent|privacy|escalat|supervis|report|disclos)\w*/i]),
      dimension('verification', 'Validation / Verification', [/\b(verif|validat|check|review|inspect|audit|document|monitor)\w*/i]),
      dimension('outcome', 'Outcome / Value', [/\b(outcome|result|resolved|safe|quality|compliant|completed|protected)\w*/i]),
    ],
  },
  service_stakeholder_reasoning: {
    label: 'Service & Stakeholder Reasoning',
    dimensions: [
      dimension('need', 'Need / Context', [/\b(need|context|customer|client|patient|student|learner|stakeholder|service user)\w*/i]),
      dimension('approachCommunication', 'Approach / Communication', [/\b(approach|communicat|explain|listen|respond|support|adapt|coordinate)\w*/i]),
      dimension('judgementAdaptation', 'Judgement / Adaptation', [/\b(because|chose|judgement|adapt|prioriti[sz]|balance|option)\w*/i]),
      dimension('qualityRisk', 'Risk / Quality / Ethics', [/\b(risk|quality|safety|ethic|privacy|safeguard|expectation|inclusion)\w*/i]),
      dimension('feedbackValidation', 'Validation / Verification', [/\b(feedback|check|confirm|review|assess|measure|follow-up|document)\w*/i]),
      dimension('outcome', 'Outcome / Value', [/\b(outcome|result|resolved|satisfied|retained|learn|improv|completed)\w*/i]),
    ],
  },
  planning_delivery: {
    label: 'Planning & Delivery',
    dimensions: [
      dimension('objectivePriorities', 'Objective / Priorities', [/\b(objective|goal|priority|deadline|requirement|deliverable)\w*/i]),
      dimension('execution', 'Approach / Execution', [/\b(plan|execut|organis|organiz|schedule|coordinate|deliver|implement)\w*/i]),
      dimension('constraintsTradeoffs', 'Constraints / Trade-offs', [/\b(constraint|trade-?off|limited|competing|option|balance|because)\w*/i]),
      dimension('controls', 'Risk / Quality / Controls', [/\b(control|risk|quality|check|track|monitor|contingency|review)\w*/i]),
      dimension('measurement', 'Validation / Measurement', [/\b(measur|metric|kpi|review|check|feedback|track|reconcil)\w*/i]),
      dimension('outcome', 'Outcome / Value', [/\b(outcome|result|impact|delivered|completed|saved|improv|reduc)\w*/i]),
    ],
  },
  learning_design: {
    label: 'Learning & Design',
    dimensions: [
      dimension('needGoal', 'Need / Goal', [/\b(need|goal|problem|brief|learner|user|objective)\w*/i]),
      dimension('exploration', 'Exploration / Approach', [/\b(explor|research|trial|prototype|experiment|learn|design|approach)\w*/i]),
      dimension('rationale', 'Rationale / Judgement', [/\b(because|reason|chose|option|trade-?off|hypothesis)\w*/i]),
      dimension('feedbackIteration', 'Feedback / Iteration', [/\b(feedback|iterat|adjust|refin|changed|adapt)\w*/i]),
      dimension('validation', 'Validation / Verification', [/\b(validat|test|check|review|assess|measure)\w*/i]),
      dimension('outcomeLearning', 'Outcome / Learning', [/\b(outcome|result|learn|improv|impact|takeaway)\w*/i]),
    ],
  },
});

const SERVICE_GROUPS = new Set(['communication', 'stakeholder_collaboration', 'customer_or_client_focus', 'service_delivery']);
const DELIVERY_GROUPS = new Set(['planning_and_organisation', 'leadership_and_ownership', 'commercial_or_business_awareness', 'process_improvement']);
const LEARNING_GROUPS = new Set(['research_and_learning', 'creativity_and_design']);

export const resolveRoleSpecificFrameworkKey = ({ evidenceMode = '', capabilityGroup = '' } = {}) => {
  if (evidenceMode === 'scenario_reasoning') return 'scenario_case_reasoning';
  if (evidenceMode === 'knowledge_explanation') return 'knowledge_explanation';
  if (evidenceMode === 'credential_verification' || capabilityGroup === 'professional_credential') return 'credential_verification';
  if (capabilityGroup === 'compliance_ethics_safety') return 'safety_quality_ethics';
  if (SERVICE_GROUPS.has(capabilityGroup)) return 'service_stakeholder_reasoning';
  if (DELIVERY_GROUPS.has(capabilityGroup)) return 'planning_delivery';
  if (LEARNING_GROUPS.has(capabilityGroup)) return 'learning_design';
  return 'role_specific_reasoning';
};

export const buildRoleSpecificRubric = ({ evidenceMode = 'past_example', capabilityGroup = '', roleDomain = 'general' } = {}) => {
  const frameworkKey = resolveRoleSpecificFrameworkKey({ evidenceMode, capabilityGroup });
  const framework = ANSWER_FRAMEWORKS[frameworkKey];
  return {
    rubricType: 'role_specific',
    frameworkKey,
    frameworkLabel: framework.label,
    structureLabel: framework.label,
    questionFamily: 'role_specific',
    evidenceMode,
    capabilityGroup,
    roleDomain,
    starApplicable: false,
    dimensions: framework.dimensions,
  };
};
