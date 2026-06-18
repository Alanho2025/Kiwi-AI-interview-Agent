/**
 * File responsibility: Convert Kiwi preparation pipeline runs to Google Agents CLI traces.
 * Main responsibilities:
 * - Represent CV parsing, JD parsing, safeguards, and matching as agent/tool events.
 * - Keep evaluator expectations outside the agent trace to avoid judge leakage.
 * - Provide compact, source-grounded summaries for Google managed metrics and LLM judges.
 */

const ORCHESTRATOR_ID = 'kiwi_prep_agent';
const CV_PARSER_ID = 'cv_parser';
const JD_PARSER_ID = 'jd_parser';
const JD_CRITIC_ID = 'jd_parse_critic';
const JD_REPARSE_ID = 'jd_reparse_agent';
const MATCHER_ID = 'cv_jd_matcher';
const MATCH_CRITIC_ID = 'match_critic';

const toTextPart = (text = '') => ({ text: String(text || '') });
const ensureArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const take = (items = [], limit = 8) => ensureArray(items).slice(0, limit);
const truncate = (value = '', limit = 3000) => String(value || '').slice(0, limit);
const labels = (items = []) => take(items).map((item) => item.label || item.name || String(item || ''));

const summarizeIssues = (safeguard = {}) => take(safeguard.issues || [], 6).map((issue) => ({
  field: issue.field,
  severity: issue.severity,
  problem: issue.problem,
  action: issue.action,
}));

const summarizeChecks = (checks = []) => ({
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  failedChecks: checks.filter((check) => !check.passed).map((check) => check.label),
});

const summarizeCvProfile = (profile = {}) => ({
  candidateName: profile.candidateName || '',
  emailPresent: Boolean(profile.contact?.email),
  location: profile.contact?.location || '',
  sections: take((profile.sections || []).map((section) => section.key), 10),
  skills: take((profile.skills || []).map((skill) => skill.label || skill), 16),
  strongestEvidence: take(profile.cvAnalysis?.strongestEvidence || [], 5).map((item) => ({
    label: item.label || '',
    text: item.text || item.evidence || '',
  })),
  weakOrMissingEvidence: take(profile.cvAnalysis?.weakOrMissingEvidence || [], 5),
  warnings: take(profile.warnings || [], 8),
});

const summarizeJdRubric = (rubric = {}) => ({
  title: rubric.jobOverview?.title || rubric.title || rubric.jobTitle || '',
  companyName: rubric.jobOverview?.companyName || rubric.companyName || '',
  employmentType: rubric.jobOverview?.employmentType || '',
  roleFamily: rubric.roleFamily || '',
  roleLevel: rubric.roleLevel || '',
  responsibilities: take(rubric.sections?.responsibilities || [], 8),
  mustHaveRequirements: take(rubric.sections?.mustHaveRequirements || [], 10),
  niceToHaveRequirements: take(rubric.sections?.niceToHaveRequirements || [], 8),
  technicalSkills: Object.fromEntries(Object.entries(rubric.sections?.technicalSkills || {})
    .map(([key, value]) => [key, labels(value).slice(0, 10)])),
  softSkills: take(rubric.sections?.softSkills || [], 8),
  safeguard: summarizeSafeguard(rubric.safeguard || rubric.metadata?.safeguard || {}),
});

const summarizeSafeguard = (safeguard = {}) => ({
  verdict: safeguard.verdict || '',
  confidence: safeguard.confidence ?? null,
  finalStatus: safeguard.finalStatus || '',
  blockOutput: Boolean(safeguard.blockOutput),
  blockMatch: Boolean(safeguard.blockMatch),
  repairApplied: Boolean(safeguard.repairApplied),
  parseAttempts: safeguard.parseAttempts ?? null,
  compareAttempts: safeguard.compareAttempts ?? null,
  issues: summarizeIssues(safeguard),
  reparseInstructions: take(safeguard.reparseInstructions || [], 6),
  reasoning: safeguard.reasoning || safeguard.reason || '',
});

const summarizeMatchResult = (result = {}) => ({
  decision: result.decision?.label || '',
  reasonCodes: result.decision?.reasonCodes || [],
  overallScore: result.overallScore ?? result.matchScore ?? null,
  confidence: result.confidence ?? null,
  requirementChecks: take(result.requirementChecks || [], 12).map((item) => ({
    label: item.label,
    status: item.status,
    type: item.type,
    importance: item.importance,
    evidence: take(item.evidence || [], 4),
  })),
  strengths: take(result.explanation?.strengths || result.strengths || [], 6).map((item) => ({
    label: item.label,
    evidence: take(item.evidence || [], 4),
    detail: item.detail || '',
  })),
  gaps: take(result.explanation?.gaps || result.gaps || [], 6).map((item) => ({
    label: item.label,
    detail: item.detail || '',
  })),
  risks: take(result.explanation?.risks || [], 6).map((item) => ({
    label: item.label,
    detail: item.detail || '',
  })),
  summary: result.explanation?.summary || '',
  priorityTopics: take(result.matchingDetails?.questionPlanHints?.priorityTopics || [], 10),
  followUpTargets: take(result.matchingDetails?.questionPlanHints?.followUpTargets || [], 10),
  interviewFocus: take(result.interviewFocus || [], 10),
  safeguard: summarizeSafeguard(result.safeguard || result.matchingDetails?.safeguard || {}),
});

const buildAgents = () => ({
  [ORCHESTRATOR_ID]: {
    agent_id: ORCHESTRATOR_ID,
    agent_type: 'PreparationPipelineAgent',
    instruction: 'Coordinate CV parsing, JD parsing, safeguard review, CV-JD matching, and preparation advice while preserving evidence-grounding.',
  },
  [CV_PARSER_ID]: {
    agent_id: CV_PARSER_ID,
    agent_type: 'DeterministicCvParser',
    instruction: 'Extract candidate identity, sections, skills, evidence, warnings, and interview hooks from the CV text.',
  },
  [JD_PARSER_ID]: {
    agent_id: JD_PARSER_ID,
    agent_type: 'JobDescriptionParser',
    instruction: 'Extract role overview, responsibilities, requirements, skills, benefits, and interview targets from the JD text.',
  },
  [JD_CRITIC_ID]: {
    agent_id: JD_CRITIC_ID,
    agent_type: 'JdParseCriticAgent',
    instruction: 'Review parsed JD fields against the source JD and request repair when extraction is unsupported or misclassified.',
  },
  [JD_REPARSE_ID]: {
    agent_id: JD_REPARSE_ID,
    agent_type: 'JdReparseAgent',
    instruction: 'Apply critic-guided section overrides when the JD parse needs repair.',
  },
  [MATCHER_ID]: {
    agent_id: MATCHER_ID,
    agent_type: 'CvJdMatchAgent',
    instruction: 'Compare CV evidence against JD requirements and produce a score, decision, strengths, gaps, risks, and question planning hints.',
  },
  [MATCH_CRITIC_ID]: {
    agent_id: MATCH_CRITIC_ID,
    agent_type: 'MatchCriticAgent',
    instruction: 'Detect overconfidence, unsupported strengths, and hard requirement drift in the match output.',
  },
});

const toolCallEvent = ({ author, name, args = {} }) => ({
  author,
  content: {
    role: 'model',
    parts: [{ function_call: { name, args } }],
  },
});

const toolResponseEvent = ({ name, response = {} }) => ({
  author: 'tool',
  content: {
    role: 'function',
    parts: [{ function_response: { name, response } }],
  },
});

const textEvent = ({ author, text }) => ({
  author,
  content: {
    role: author === 'user' ? 'user' : 'model',
    parts: [toTextPart(text)],
  },
});

const buildPromptText = (run = {}) => [
  `Evaluate Kiwi preparation pipeline case: ${run.id}.`,
  `CV fixture: ${run.cvFixture}.`,
  `JD fixture: ${run.jdFixture}.`,
  'Assess whether the preparation agent parses the CV/JD faithfully, applies safeguards, and produces an evidence-grounded CV-JD match.',
].join('\n');

const buildFinalResponseText = (run = {}) => {
  const match = run.matchResult || {};
  const failedChecks = run.evaluation?.failedChecks || [];
  return [
    `Decision: ${match.decision?.label || 'unknown'} (${match.overallScore ?? 'n/a'}).`,
    `Summary: ${match.explanation?.summary || 'No summary available.'}`,
    `Priority interview topics: ${take(match.matchingDetails?.questionPlanHints?.priorityTopics || [], 5).join('; ') || 'none'}.`,
    failedChecks.length
      ? `Internal deterministic checks flagged: ${failedChecks.join(', ')}.`
      : 'Internal deterministic checks did not flag failures.',
  ].join('\n');
};

const buildRubricGroup = () => ({
  rubrics: [
    {
      rubric_id: 'source_grounding',
      content: { property: { description: 'Claims about candidate fit must be grounded in parsed CV evidence and JD requirements.' } },
    },
    {
      rubric_id: 'safeguard_use',
      content: { property: { description: 'The pipeline should expose critic verdicts and repairs when parse or match output is risky.' } },
    },
    {
      rubric_id: 'match_fairness',
      content: { property: { description: 'The match decision should not overstate fit when hard requirements lack evidence.' } },
    },
    {
      rubric_id: 'actionable_advice',
      content: { property: { description: 'The final output should identify concrete preparation topics and evidence gaps.' } },
    },
  ],
});

const buildEvents = (run = {}) => {
  const prompt = buildPromptText(run);
  const jdSafeguard = run.jdRubric?.safeguard || run.jdRubric?.metadata?.safeguard || {};
  const matchSafeguard = run.matchResult?.safeguard || run.matchResult?.matchingDetails?.safeguard || {};
  const events = [
    textEvent({ author: 'user', text: prompt }),
    toolCallEvent({ author: ORCHESTRATOR_ID, name: 'load_eval_fixtures', args: { cvFixture: run.cvFixture, jdFixture: run.jdFixture } }),
    toolResponseEvent({
      name: 'load_eval_fixtures',
      response: {
        cvFixture: run.cvFixture,
        jdFixture: run.jdFixture,
        rawCvExcerpt: truncate(run.rawCv, 2200),
        rawJdExcerpt: truncate(run.rawJD, 2200),
      },
    }),
    toolCallEvent({ author: CV_PARSER_ID, name: 'build_cv_profile', args: { cvFixture: run.cvFixture } }),
    toolResponseEvent({ name: 'build_cv_profile', response: summarizeCvProfile(run.cvProfile) }),
    toolCallEvent({ author: JD_PARSER_ID, name: 'build_guarded_jd_rubric', args: { jdFixture: run.jdFixture } }),
    toolResponseEvent({ name: 'build_guarded_jd_rubric', response: summarizeJdRubric(run.jdRubric) }),
    toolCallEvent({ author: JD_CRITIC_ID, name: 'review_jd_parse', args: { jdFixture: run.jdFixture } }),
    toolResponseEvent({ name: 'review_jd_parse', response: summarizeSafeguard(jdSafeguard) }),
  ];

  if (jdSafeguard.repairApplied || Number(jdSafeguard.parseAttempts || 1) > 1) {
    events.push(
      toolCallEvent({ author: JD_REPARSE_ID, name: 'build_jd_reparse_overrides', args: { jdFixture: run.jdFixture, previousVerdict: jdSafeguard.firstReview?.verdict || '' } }),
      toolResponseEvent({
        name: 'build_jd_reparse_overrides',
        response: {
          sectionOverrides: jdSafeguard.sectionOverrides || {},
          finalSafeguard: summarizeSafeguard(jdSafeguard),
        },
      }),
    );
  }

  events.push(
    toolCallEvent({ author: MATCHER_ID, name: 'compare_cv_to_job_description', args: { cvFixture: run.cvFixture, jdFixture: run.jdFixture } }),
    toolResponseEvent({ name: 'compare_cv_to_job_description', response: summarizeMatchResult(run.matchResult) }),
    toolCallEvent({ author: MATCH_CRITIC_ID, name: 'review_match_result', args: { decision: run.matchResult?.decision?.label || '', score: run.matchResult?.overallScore ?? null } }),
    toolResponseEvent({ name: 'review_match_result', response: summarizeSafeguard(matchSafeguard) }),
  );

  if (matchSafeguard.firstReview || Number(matchSafeguard.compareAttempts || 1) > 1) {
    events.push(
      toolCallEvent({ author: MATCHER_ID, name: 'recompare_cv_to_job_description', args: { previousVerdict: matchSafeguard.firstReview?.verdict || '' } }),
      toolResponseEvent({
        name: 'recompare_cv_to_job_description',
        response: {
          finalMatch: summarizeMatchResult(run.matchResult),
          finalSafeguard: summarizeSafeguard(matchSafeguard),
        },
      }),
    );
  }

  events.push(textEvent({ author: ORCHESTRATOR_ID, text: buildFinalResponseText(run) }));
  return events;
};

export const buildPrepPipelineEvalCase = (run = {}, index = 0) => ({
  eval_case_id: run.id || `prep_pipeline_${index + 1}`,
  prompt: {
    role: 'user',
    parts: [toTextPart(buildPromptText(run))],
  },
  responses: [
    {
      response: {
        role: 'model',
        parts: [toTextPart(buildFinalResponseText(run))],
      },
    },
  ],
  reference: {
    response: {
      role: 'model',
      parts: [toTextPart(`Expected deterministic score at least ${run.evaluation?.minimumPassingScore ?? 0.75}; acceptable decisions: ${(run.expected?.acceptableDecisions || []).join(', ') || 'not specified'}.`)],
    },
  },
  agent_data: {
    agents: buildAgents(),
    turns: [
      {
        turn_index: 0,
        events: buildEvents(run),
      },
    ],
  },
  rubric_groups: {
    kiwi_prep_pipeline_rubrics: buildRubricGroup(),
  },
  kiwi_evaluation: run.evaluation || {},
});

export const buildPrepPipelineDataset = (runs = []) => ({
  eval_cases: runs.map((run, index) => buildPrepPipelineEvalCase(run, index)),
});

export const summarizeChecksForEvaluation = ({ cvScore = null, jdScore = null, matchScore = null } = {}) => {
  const cvChecks = cvScore ? summarizeChecks(cvScore.checks || []) : { passed: 0, total: 0, failedChecks: [] };
  const jdChecks = jdScore ? summarizeChecks(jdScore.checks || []) : { passed: 0, total: 0, failedChecks: [] };
  const matchChecks = matchScore ? summarizeChecks(matchScore.checks || []) : { passed: 0, total: 0, failedChecks: [] };
  const scores = [cvScore?.score, jdScore?.score, matchScore?.score].filter((score) => Number.isFinite(Number(score))).map(Number);
  const score = scores.length ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2)) : 0;
  const failedChecks = [
    ...cvChecks.failedChecks.map((item) => `cv:${item}`),
    ...jdChecks.failedChecks.map((item) => `jd:${item}`),
    ...matchChecks.failedChecks.map((item) => `match:${item}`),
  ];

  return {
    score,
    minimumPassingScore: 0.75,
    passed: score >= 0.75 && failedChecks.length === 0,
    failedChecks,
    stageScores: {
      cvParse: cvScore ? { score: cvScore.score, earned: cvScore.earned, possible: cvScore.possible, checks: cvChecks } : null,
      jdParse: jdScore ? { score: jdScore.score, earned: jdScore.earned, possible: jdScore.possible, checks: jdChecks } : null,
      cvJdMatch: matchScore ? { score: matchScore.score, earned: matchScore.earned, possible: matchScore.possible, checks: matchChecks } : null,
    },
  };
};

