const TECHNICAL_GROUPS = new Set(['technical_or_tool_skill']);

export const isTechnicalCapabilityGroup = (group = '', category = '') => (
  TECHNICAL_GROUPS.has(group)
  || ['technical_skill', 'tool_or_platform', 'domain_knowledge', 'basic_integration'].includes(category)
);

export const buildCapabilityPrompt = ({
  capabilityGroup = '',
  _category = '',
  capability = '',
  roleLabel = 'the role',
  followUpDepth = 0,
} = {}) => {
  const label = capability || 'this capability';
  const isFollowUp = Number(followUpDepth || 0) > 0;

  if (!capabilityGroup) return null;

  if (capabilityGroup === 'professional_credential') {
    return isFollowUp
      ? `What specific evidence can you provide for ${label}, and are there any conditions, registrations, or documents the employer should verify?`
      : `Can you walk me through your evidence for ${label} and how it qualifies you for this ${roleLabel} role?`;
  }

  if (capabilityGroup === 'domain_knowledge') {
    return isFollowUp
      ? `What framework, standard, or specialist method did you use, and how did you know your judgement was sound?`
      : `Tell me about a real example where you applied ${label}. What context were you working in, and what judgement did you make?`;
  }

  if (capabilityGroup === 'technical_or_tool_skill') {
    return isFollowUp
      ? `What exact steps did you take with ${label}, and how did you check whether the result worked?`
      : `Tell me about a practical example where you used ${label}. What did you use it for, and what was the outcome?`;
  }

  if (capabilityGroup === 'analysis_and_problem_solving') {
    return isFollowUp
      ? `What information did you compare, what options did you reject, and why did you choose your final approach?`
      : `Tell me about a time you had to understand a messy problem before proposing a solution. What information did you look at?`;
  }

  if (capabilityGroup === 'communication') {
    return isFollowUp
      ? `How did you adapt the message for the audience, and how did you know it was clear enough?`
      : `Tell me about a time you had to explain something clearly in writing or verbally. Who was the audience, and what result did your communication achieve?`;
  }

  if (capabilityGroup === 'stakeholder_collaboration') {
    return isFollowUp
      ? `What did each stakeholder need from you, and how did you keep the work moving without losing trust?`
      : `Tell me about a time you worked with different people or teams to solve a problem. What did you do to understand their needs?`;
  }

  if (capabilityGroup === 'planning_and_organisation') {
    return isFollowUp
      ? `How did you prioritise the work, what could have slipped, and what controls did you use to stay on track?`
      : `Tell me about a time you managed deadlines, scheduling, or competing priorities. How did you keep control of the work?`;
  }

  if (capabilityGroup === 'research_and_learning') {
    return isFollowUp
      ? `What did you try first, what did you learn, and how did that change your next step?`
      : `Tell me about a new tool, method, or topic you learned by yourself. What made you curious, and how did you test your understanding?`;
  }

  if (capabilityGroup === 'compliance_ethics_safety') {
    return isFollowUp
      ? `What checks did you make, what risk were you trying to control, and what would have happened if it was wrong?`
      : `Tell me about a time you had to follow a rule, standard, policy, or safety requirement carefully. What was at stake?`;
  }

  if (capabilityGroup === 'creativity_and_design') {
    return isFollowUp
      ? `How did you test whether the idea was useful, and what feedback changed your thinking?`
      : `Tell me about a time you brought a new idea or design choice to improve something. Why was it useful?`;
  }

  if (capabilityGroup === 'data_and_reporting') {
    return isFollowUp
      ? `What data or evidence did you include, what did you leave out, and what decision did the report support?`
      : `Tell me about a report, dashboard, analysis, or data view you created or used. What decision or workflow did it support?`;
  }

  if (capabilityGroup === 'process_improvement') {
    return isFollowUp
      ? `What process step did you change or automate, and how would you measure whether it improved the work?`
      : `Tell me about a time you noticed an inefficient process and suggested a smarter way to do it. What problem did you see?`;
  }

  if (capabilityGroup === 'customer_or_client_focus') {
    return isFollowUp
      ? `What did the person need from you, how did you respond, and what changed because of your support?`
      : `Tell me about a time you supported a client, customer, user, student, or service user. How did you understand what they needed?`;
  }

  if (capabilityGroup === 'leadership_and_ownership') {
    return isFollowUp
      ? `What did you personally own, what decision did you make, and what changed afterwards?`
      : `Tell me about a time you took ownership or showed initiative. What did you do without waiting to be told?`;
  }

  if (capabilityGroup === 'field_or_practical_work') {
    return isFollowUp
      ? `What practical constraint did you face, what checks did you make, and what did you learn from the work?`
      : `Tell me about a hands-on, field, placement, project, or practical work example related to ${label}. What did you do?`;
  }

  if (capabilityGroup === 'commercial_or_business_awareness') {
    return isFollowUp
      ? `How did your decision affect cost, quality, time, users, or the wider organisation?`
      : `Tell me about a time you considered the business or organisational impact of your work. What did you take into account?`;
  }

  if (capabilityGroup === 'service_delivery') {
    return isFollowUp
      ? `How did you maintain quality, timeliness, and consistency while delivering the service or output?`
      : `Tell me about a service, assessment, case, project, or deliverable you were responsible for. How did you make sure it was completed well?`;
  }

  return null;
};
