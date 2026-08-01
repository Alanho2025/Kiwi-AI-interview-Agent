import crypto from 'node:crypto';
import { isJobDescriptionSectionHeading } from './jobDescriptionSectionHeadingGuard.js';

const UNTRUSTED_INSTRUCTION_PATTERN = /\b(ignore (?:all |any |the )?(?:previous|prior|system) instructions?|system prompt|developer message|mark every candidate|override (?:the )?(?:score|match|rules?))\b/i;
const BOILERPLATE_INTENT_PATTERN = /^(?:why\s+you\s+should\s+care|why\s+work\s+for\s+us|why\s+join\s+us|what\s+we\s+offer|how\s+to\s+apply|about\s+the\s+company|about\s+us|apply\s+now|recruiter|save\s+job|share\s+this\s+job|work\s+type|posted\s+date|salary|location):?$/i;
const WORKFLOW_PATTERN = /\b(automation|workflow|manual|process|operations?|pipeline|data|reporting|dashboard|internal teams?)\b/i;

const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const stableId = (prefix, ...parts) => {
  const digest = crypto.createHash('sha256').update(parts.map(normalizeText).join('\n')).digest('hex').slice(0, 18);
  return `${prefix}:${digest}`;
};

const intentCandidates = (rubric = {}) => {
  const sections = rubric.sections || {};
  return [
    ...(sections.mustHaveRequirements || []).map((statement) => ({ statement, priority: 'high', sourceLabel: 'JD must-have requirement', section: 'mustHaveRequirements', category: 'requirement' })),
    ...(sections.responsibilities || rubric.roleSummary || []).map((statement) => ({ statement, priority: 'high', sourceLabel: 'JD responsibility', section: 'responsibilities', category: 'responsibility' })),
    ...(sections.softSkills || rubric.softSkillRequirements || []).map((statement) => ({ statement, priority: 'medium', sourceLabel: 'JD soft skill', section: 'softSkills', category: 'behavioural' })),
    ...(sections.niceToHaveRequirements || rubric.niceToHaveExperience || []).map((statement) => ({ statement, priority: 'low', sourceLabel: 'JD nice-to-have requirement', section: 'niceToHaveRequirements', category: 'preferred_requirement' })),
    ...(rubric.requirements || []).map((item) => ({
      statement: item.label || item.text,
      priority: item.importance || (item.type === 'hard' ? 'high' : 'medium'),
      sourceLabel: item.type === 'hard' ? 'JD must-have requirement' : 'JD parsed requirement',
      section: 'requirements',
      category: item.category || 'requirement',
    })),
  ];
};

const buildLegacyItems = (rubric = {}) => {
  const seen = new Set();
  const items = intentCandidates(rubric).flatMap((candidate) => {
    const statement = normalizeText(candidate.statement);
    const cleanStatement = statement.replace(/^[*#_]+|[*#_]+$/g, '').trim();
    const key = statement.toLowerCase();
    if (
      !statement
      || seen.has(key)
      || UNTRUSTED_INSTRUCTION_PATTERN.test(statement)
      || BOILERPLATE_INTENT_PATTERN.test(statement)
      || BOILERPLATE_INTENT_PATTERN.test(cleanStatement)
      || isJobDescriptionSectionHeading(statement)
      || isJobDescriptionSectionHeading(cleanStatement)
      || /[*#_]*additional information[*#_]*/i.test(statement)
      || /apply now.*make an impact/i.test(statement)
      || /intentional about (?:finding|placing) the right/i.test(statement)
      || /be part of our journey to make sustainable living/i.test(statement)
    ) return [];
    seen.add(key);
    return [{
      id: stableId('intent', candidate.section, statement),
      statement,
      priority: candidate.priority,
      category: candidate.category,
      sourceLabel: candidate.sourceLabel,
      confidence: candidate.section === 'requirements' ? 0.78 : 0.9,
      sourceConfidence: candidate.section === 'requirements' ? 'medium' : 'high',
      reviewConfidence: 'unreviewed',
      claimStatus: 'grounded',
      uncertainty: candidate.section === 'responsibilities'
        ? 'Responsibility wording may describe team scope rather than individual ownership.'
        : 'Confirm the priority and interpretation during human review.',
      sourceTrace: {
        sourceType: 'job_description',
        section: candidate.section,
        rawSnippet: statement,
      },
    }];
  });

  return items;
};

const toEvidenceRef = (source = {}) => ({
  sourceType: source.sourceType || source.sourceTrace?.sourceType || 'job_description',
  sourceLabel: source.sourceLabel || '',
  excerpt: source.statement || source.sourceTrace?.rawSnippet || '',
  section: source.sourceTrace?.section || source.section || null,
  url: source.sourceTrace?.url || null,
  sourceConfidence: source.sourceConfidence || 'medium',
  reviewConfidence: source.reviewConfidence || 'unreviewed',
});

const getCompanySignals = (companyUnderstanding = {}) => (
  (companyUnderstanding.facts || [])
    .filter((fact) => fact.statement && fact.sourceType !== 'supplied_url_only')
    .slice(0, 3)
);

const pickWorkflowIntent = (items = []) => (
  items.find((item) => WORKFLOW_PATTERN.test(item.statement))
  || items.find((item) => item.category === 'responsibility')
  || items[0]
  || null
);

const buildRolePurpose = ({ companyName = '', workflowIntent = null, companySignals = [] } = {}) => {
  const roleSignal = workflowIntent?.statement || 'the core role responsibilities';
  const companySignal = companySignals[0]?.statement || '';
  const shortStatement = WORKFLOW_PATTERN.test(`${roleSignal} ${companySignal}`)
    ? `Help ${companyName || 'the employer'} reduce manual workflow friction through ${roleSignal}.`
    : `Help ${companyName || 'the employer'} deliver the most important role outcomes described in the JD.`;

  return {
    shortStatement,
    evidenceRefs: [workflowIntent, ...companySignals].filter(Boolean).map(toEvidenceRef),
    sourceConfidence: companySignals.length ? 'medium' : 'low',
    reviewConfidence: 'unreviewed',
    claimStatus: 'needs_confirmation',
    uncertainty: 'This is a preparation hypothesis derived from reviewed sources, not a verified hiring-manager statement.',
  };
};

const buildBusinessProblemHypotheses = ({ companyName = '', workflowIntent = null, companySignals = [] } = {}) => {
  if (!workflowIntent) return [];
  const companySignal = companySignals[0]?.statement || 'the available company context';
  const statement = WORKFLOW_PATTERN.test(`${workflowIntent.statement} ${companySignal}`)
    ? `${companyName || 'The employer'} may need this role to reduce manual workflow or operations friction and turn messy needs into reliable delivery.`
    : `${companyName || 'The employer'} may need this role to execute the high-priority responsibilities in the JD with credible evidence.`;

  return [{
    id: stableId('business-problem', workflowIntent.statement, companySignal),
    statement,
    evidenceRefs: [workflowIntent, ...companySignals].filter(Boolean).map(toEvidenceRef),
    sourceConfidence: companySignals.length ? 'medium' : 'low',
    reviewConfidence: 'unreviewed',
    claimStatus: 'needs_confirmation',
    hiringRiskIfWeak: 'The candidate may know tools but fail to discover workflow pain, work with stakeholders, or prove measurable impact.',
  }];
};

const buildWorkflowPainPoints = ({ workflowIntent = null, companySignals = [] } = {}) => {
  if (!workflowIntent) return [];
  return [{
    id: stableId('workflow-pain', workflowIntent.statement, companySignals[0]?.statement || ''),
    statement: WORKFLOW_PATTERN.test(workflowIntent.statement)
      ? `Manual or fragile workflow execution may need automation, clearer data flow, and stakeholder adoption.`
      : `The role may carry delivery risk if the candidate cannot translate responsibilities into evidence-backed action.`,
    evidenceRefs: [workflowIntent, ...companySignals].filter(Boolean).map(toEvidenceRef),
    sourceConfidence: companySignals.length ? 'medium' : 'low',
    reviewConfidence: 'unreviewed',
    uncertainty: 'Review whether this pain point matches the actual employer context.',
  }];
};

const buildIdealCandidateSignals = (items = []) => (
  items
    .filter((item) => ['high', 'medium'].includes(item.priority))
    .slice(0, 5)
    .map((item) => ({
      id: stableId('candidate-signal', item.id, item.statement),
      signal: item.statement,
      roleIntentId: item.id,
      evidenceRefs: [toEvidenceRef(item)],
      sourceConfidence: item.sourceConfidence || 'medium',
      reviewConfidence: 'unreviewed',
      riskIfMissing: `The answer may not prove ${item.statement} strongly enough for this role.`,
    }))
);

const buildInterviewProbeMap = (items = []) => (
  items
    .filter((item) => item.priority === 'high')
    .slice(0, 4)
    .map((item) => ({
      probeId: stableId('probe', item.id, item.statement),
      testedIntentIds: [item.id],
      expectedSignals: ['specific evidence', 'measurable impact', 'stakeholder context'],
      riskReduced: `Checks whether the candidate can prove ${item.statement} with concrete evidence rather than general familiarity.`,
    }))
);

const buildRoleIntentDiagnostics = ({ companySignals = [], companyUnderstanding = {}, workflowIntent = null } = {}) => [
  ...(!companySignals.length ? [{
    code: 'role_intent_company_source_missing',
    severity: 'warning',
    message: 'Role intent hiring logic has no grounded company source and should be treated as a low-confidence preparation hypothesis.',
    sourceIds: [],
    degradedReason: 'low_confidence_hiring_logic',
  }] : []),
  ...((companyUnderstanding.sourceConflicts || []).length ? [{
    code: 'role_intent_company_context_conflict',
    severity: 'warning',
    message: 'Role intent hiring logic is based on company context that requires conflict review.',
    sourceIds: (companyUnderstanding.sourceConflicts || []).map((item) => item.code).filter(Boolean),
    degradedReason: 'company_context_source_conflict',
  }] : []),
  ...(!workflowIntent ? [{
    code: 'role_intent_workflow_signal_missing',
    severity: 'warning',
    message: 'No role workflow signal was available for hiring-logic decoding.',
    sourceIds: [],
    degradedReason: 'missing_role_intent_signal',
  }] : []),
];

export const buildRoleIntent = (rubric = {}, { companyUnderstanding = {} } = {}) => {
  const items = buildLegacyItems(rubric);
  const companyName = normalizeText(rubric.jobOverview?.companyName || rubric.companyName || '');
  const companySignals = getCompanySignals(companyUnderstanding);
  const workflowIntent = pickWorkflowIntent(items);

  return {
    schemaVersion: 'role_intent_decoder_v2',
    items,
    highPriorityCount: items.filter((item) => item.priority === 'high').length,
    rolePurpose: buildRolePurpose({ companyName, workflowIntent, companySignals }),
    businessProblemHypotheses: buildBusinessProblemHypotheses({ companyName, workflowIntent, companySignals }),
    workflowPainPoints: buildWorkflowPainPoints({ workflowIntent, companySignals }),
    idealCandidateSignals: buildIdealCandidateSignals(items),
    interviewProbeMap: buildInterviewProbeMap(items),
    diagnostics: buildRoleIntentDiagnostics({ companySignals, companyUnderstanding, workflowIntent }),
    uncertainties: [
      ...(!companySignals.length ? ['No grounded company source was available, so hiring logic remains a low-confidence preparation hypothesis.'] : []),
      'Role intent hypotheses require user review before they drive downstream match, interview, or report claims.',
    ],
  };
};
