import { spawn } from 'node:child_process';
import { callDeepSeek } from '../deepseekService.js';
import { ensureArray, normalizeText, normalizeKey, tokenize } from '../../utils/commonHelpers.js';

const DEFAULT_TIMEOUT_MS = 180;
const MAX_ADAPTER_PAYLOAD_CHARS = 12000;

const TECHNOLOGY_ALIASES = new Map([
  ['postgresql', ['postgresql', 'postgres', 'postgre sql']],
  ['websocket', ['websocket', 'web socket', 'websockets']],
  ['react', ['react', 'react.js', 'reactjs']],
  ['node.js', ['node.js', 'nodejs', 'node']],
  ['express', ['express']],
  ['mongodb', ['mongodb', 'mongo']],
  ['sql', ['sql']],
  ['python', ['python']],
  ['javascript', ['javascript', 'js']],
  ['typescript', ['typescript', 'ts']],
  ['azure', ['azure']],
  ['aws', ['aws', 'amazon web services']],
  ['docker', ['docker']],
  ['kubernetes', ['kubernetes', 'k8s']],
  ['redis', ['redis']],
  ['graphql', ['graphql']],
  ['rest api', ['rest api', 'restful api', 'api']],
  ['jwt', ['jwt', 'json web token']],
  ['oauth', ['oauth', 'oauth2']],
  ['ci/cd', ['ci/cd', 'cicd', 'ci cd']],
  ['apple', ['apple', 'ios', 'safari', 'macos']],
]);

export const EQUIVALENT_TECHNOLOGY_CLUSTERS = new Map([
  ['frontend_ui_framework', ['react', 'svelte', 'vue', 'angular', 'next.js', 'nuxt']],
  ['relational_db', ['postgresql', 'mysql', 'sqlite', 'oracle', 'sqlserver', 'mariadb']],
  ['nosql_db', ['mongodb', 'dynamodb', 'cassandra', 'couchdb']],
  ['backend_runtime', ['node.js', 'express', 'fastify', 'python', 'django', 'fastapi', 'go', 'java', 'spring']],
  ['message_broker', ['kafka', 'rabbitmq', 'sqs', 'pubsub', 'redis']],
]);

export const classifyTechnologyMatch = ({
  targetTech = '',
  mentionedTechs = [],
  hasStarStructure = false,
} = {}) => {
  const normTarget = normalizeKey(targetTech);
  const normMentioned = (mentionedTechs || []).map((t) => normalizeKey(t));

  if (!normTarget) {
    return { matchType: 'NO_RELEVANT_EVIDENCE', cluster: null };
  }

  if (normMentioned.includes(normTarget)) {
    return { matchType: 'EXACT_MATCH', cluster: null };
  }

  for (const [clusterName, techList] of EQUIVALENT_TECHNOLOGY_CLUSTERS.entries()) {
    if (techList.includes(normTarget)) {
      const hasEquivalent = normMentioned.some((m) => techList.includes(m));
      if (hasEquivalent) {
        return {
          matchType: hasStarStructure ? 'TRANSFERABLE_EVIDENCE' : 'PARTIAL_TRANSFER',
          cluster: clusterName,
        };
      }
    }
  }

  return { matchType: 'NO_RELEVANT_EVIDENCE', cluster: null };
};

const OWNERSHIP_VERBS = [
  'built', 'build', 'designed', 'implemented', 'implement', 'led', 'lead', 'owned', 'own',
  'debugged', 'debug', 'fixed', 'fix', 'deployed', 'deploy', 'created', 'create',
  'improved', 'improve', 'migrated', 'migrate', 'integrated', 'integrate',
  'used', 'use', 'handled', 'handle', 'checked', 'check', 'analyzed', 'analysed',
];

const EVIDENCE_TERMS = [
  'result', 'outcome', 'impact', 'measured', 'validated', 'verified', 'tested', 'test',
  'reduced', 'improved', 'increased', 'decreased', 'saved', 'faster', 'slower',
  'latency', 'throughput', 'uptime', 'conversion', 'accuracy', 'quality', 'safety',
  'satisfaction', 'retention', 'revenue', 'cost', 'time', 'efficiency',
];

const FRICTION_TERMS = [
  'failed', 'failure', 'bug', 'debug', 'incident', 'bottleneck', 'blocked', 'constraint',
  'tradeoff', 'trade-off', 'deadline', 'limited', 'conflict', 'disagreed', 'risk',
  'regression', 'outage', 'error', 'issue', 'problem', 'complaint', 'escalation',
  'pressure', 'difficult', 'challenging', 'urgent',
];

const DECISION_TERMS = [
  'decided', 'choose', 'chose', 'selected', 'prioritized', 'prioritised', 'compared',
  'evaluated', 'tradeoff', 'trade-off', 'because', 'instead', 'option', 'alternative',
  'reason', 'criteria', 'constraint',
];

const COMMUNICATION_TERMS = [
  'explained', 'presented', 'communicated', 'clarified', 'documented', 'reported',
  'discussed', 'listened', 'asked', 'confirmed', 'aligned', 'negotiated',
];

const COLLABORATION_TERMS = [
  'team', 'worked with', 'collaborated', 'paired', 'supported', 'helped', 'coordinated',
  'stakeholder', 'manager', 'customer', 'client', 'colleague', 'mentor', 'partner',
];

const LEADERSHIP_TERMS = [
  'led', 'managed', 'mentored', 'guided', 'owned', 'planned', 'organized', 'organised',
  'delegated', 'influenced', 'coached', 'facilitated',
];

const CUSTOMER_OR_STAKEHOLDER_TERMS = [
  'customer', 'client', 'stakeholder', 'patient', 'user', 'supplier', 'vendor', 'complaint',
  'requirement', 'feedback', 'expectation', 'service', 'support',
];

const PROBLEM_SOLVING_TERMS = [
  'solved', 'fixed', 'debugged', 'investigated', 'diagnosed', 'analyzed', 'analysed',
  'root cause', 'workaround', 'improved', 'optimized', 'optimised', 'resolved',
];

const MISUNDERSTANDING_TERMS = [
  'not sure', "don't know", 'do not know', 'could you repeat', 'can you repeat',
  'unclear', 'sorry', 'what do you mean',
];

const GENERIC_LOW_SIGNAL_TERMS = new Set([
  'project', 'team', 'work', 'experience', 'system', 'application', 'app', 'solution',
  'feature', 'role', 'company', 'user', 'users', 'data',
]);

const unique = (items = []) => [...new Set(items.map((item) => normalizeText(item)).filter(Boolean))];

const containsPhrase = (text, phrase) => {
  const normalizedText = normalizeKey(text).replace(/\s+/g, ' ');
  const normalizedPhrase = normalizeKey(phrase).replace(/\s+/g, ' ');
  return normalizedPhrase ? normalizedText.includes(normalizedPhrase) : false;
};

const collectStrings = (value, depth = 0) => {
  if (depth > 4 || value == null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1));
  if (typeof value === 'object') return Object.values(value).flatMap((item) => collectStrings(item, depth + 1));
  return [];
};

const extractCapitalizedPhrases = (answerText = '') => {
  const matches = answerText.match(/\b[A-Z][A-Za-z0-9+#.]{1,}(?:\s+[A-Z][A-Za-z0-9+#.]{1,}){0,3}\b/g) || [];
  const blocked = new Set(['I', 'The', 'And', 'When', 'Then', 'We', 'Our', 'My', 'A', 'An', 'To', 'In']);
  return unique(matches.filter((item) => !blocked.has(item)));
};

const splitSentences = (text = '') => normalizeText(text)
  .split(/(?<=[.!?。！？])\s+|\n+/)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, 12);

const sentenceMatchesAny = (sentence = '', terms = []) => terms.some((term) => containsPhrase(sentence, term));

const collectEvidenceSnippets = (answerText = '', terms = [], limit = 3) => splitSentences(answerText)
  .filter((sentence) => sentenceMatchesAny(sentence, terms))
  .map((sentence) => sentence.length > 220 ? `${sentence.slice(0, 217).trim()}...` : sentence)
  .slice(0, limit);

const extractSignalBucket = (answerText = '', terms = [], limit = 8) => unique([
  ...extractSignals(answerText, terms),
  ...collectEvidenceSnippets(answerText, terms, 3),
]).slice(0, limit);

export const buildAnswerUnderstandingLexicon = (session = {}) => {
  const analysis = session.analysisResult || {};
  const profile = analysis.parsedCvProfile || session.cvProfile || {};
  const jdProfile = analysis.parsedJdProfile || {};
  const questionHints = analysis.matchingDetails?.questionPlanHints || {};
  const matchingDetails = analysis.matchingDetails || {};
  const interviewPlan = session.interviewPlan || {};

  const requiredTerms = unique([
    ...collectStrings(jdProfile.requiredSkills),
    ...collectStrings(jdProfile.technicalSkillRequirements),
    ...collectStrings(jdProfile.mustHaveRequirements),
    ...collectStrings(jdProfile.requiredCapabilities),
    ...collectStrings(jdProfile.responsibilities),
    ...collectStrings(jdProfile.behaviouralSignals),
    ...collectStrings(jdProfile.softSkills),
    ...collectStrings(jdProfile.sections?.mustHaveRequirements),
    ...collectStrings(jdProfile.sections?.technicalSkills),
    ...collectStrings(jdProfile.sections?.responsibilities),
    ...collectStrings(jdProfile.sections?.behaviouralSignals),
  ]);

  const candidateEvidenceTerms = unique([
    ...collectStrings(profile.skills),
    ...collectStrings(profile.projects),
    ...collectStrings(profile.experience),
    ...collectStrings(profile.strongestEvidence),
    ...collectStrings(profile.jdRelevantEvidence),
    ...collectStrings(profile.suggestedInterviewHooks),
  ]);

  const gapTerms = unique([
    ...collectStrings(matchingDetails.validationTargets),
    ...collectStrings(matchingDetails.missingRequiredSkills),
    ...collectStrings(matchingDetails.missingPreferredSkills),
    ...collectStrings(matchingDetails.capabilityGaps),
    ...collectStrings(profile.weakOrMissingEvidence),
  ]);

  const priorityTopics = unique([
    ...collectStrings(questionHints.priorityTopics),
    ...collectStrings(matchingDetails.validationTargets),
  ]).slice(0, 20);

  const rawTerms = [
    session.targetRole,
    ...candidateEvidenceTerms,
    ...requiredTerms,
    ...gapTerms,
    ...priorityTopics,
    ...collectStrings(interviewPlan.questionPool?.map((question) => [question.topic, question.stage, question.text])),
  ];

  const terms = unique(rawTerms)
    .flatMap((item) => String(item).split(/[,/|]/).map((part) => part.trim()))
    .filter((item) => item.length >= 2)
    .slice(0, 160);

  return {
    terms,
    requiredTerms: requiredTerms.slice(0, 80),
    candidateEvidenceTerms: candidateEvidenceTerms.slice(0, 80),
    gapTerms: gapTerms.slice(0, 80),
    technologies: unique([
      ...terms.filter((term) => {
        const lower = normalizeKey(term);
        return [...TECHNOLOGY_ALIASES.values()].some((aliases) => aliases.some((alias) => lower.includes(alias)));
      }),
      ...[...TECHNOLOGY_ALIASES.keys()],
    ]),
    priorityTopics,
  };
};

const extractTechnologies = (answerText, lexicon) => {
  const found = [];
  for (const [canonical, aliases] of TECHNOLOGY_ALIASES.entries()) {
    if (aliases.some((alias) => containsPhrase(answerText, alias))) {
      found.push(canonical);
    }
  }

  for (const term of ensureArray(lexicon.terms)) {
    const clean = normalizeText(term);
    if (clean.length < 3 || GENERIC_LOW_SIGNAL_TERMS.has(normalizeKey(clean))) continue;
    if (containsPhrase(answerText, clean)) {
      found.push(clean);
    }
  }

  return unique(found).slice(0, 12);
};

const extractSignals = (answerText, terms) => {
  const normalized = normalizeKey(answerText);
  const answerTokens = new Set(tokenize(answerText));
  return terms.filter((term) => normalized.includes(term) || answerTokens.has(term));
};

const extractMetrics = (answerText) => unique(answerText.match(/\b\d+(?:\.\d+)?\s*(?:%|percent|ms|seconds?|minutes?|hours?|x|times|users?|requests?|queries?|customers?|clients?|patients?|tickets?|dollars?|\$)?\b/gi) || []);

const extractRoleHits = (answerText = '', terms = [], limit = 10) => unique(ensureArray(terms)
  .filter((term) => {
    const clean = normalizeText(term);
    return clean.length >= 3 && !GENERIC_LOW_SIGNAL_TERMS.has(normalizeKey(clean)) && containsPhrase(answerText, clean);
  }))
  .slice(0, limit);

const buildStarSignals = ({ answerText = '', ownershipSignals = [], evidenceSignals = [], frictionSignals = [], metrics = [] } = {}) => ({
  situation: collectEvidenceSnippets(answerText, ['when', 'while', 'during', 'at the time', 'in my', 'in our', 'there was', 'we had'], 3),
  task: collectEvidenceSnippets(answerText, ['needed to', 'had to', 'goal', 'required', 'responsible', 'task', 'asked to', 'expected'], 3),
  action: unique([
    ...ownershipSignals,
    ...collectEvidenceSnippets(answerText, OWNERSHIP_VERBS, 3),
  ]).slice(0, 6),
  result: unique([
    ...metrics,
    ...evidenceSignals.filter((item) => ['result', 'outcome', 'impact', 'reduced', 'improved', 'increased', 'saved', 'faster'].includes(normalizeKey(item))),
    ...collectEvidenceSnippets(answerText, EVIDENCE_TERMS, 3),
  ]).slice(0, 6),
  friction: unique([
    ...frictionSignals,
    ...collectEvidenceSnippets(answerText, FRICTION_TERMS, 3),
  ]).slice(0, 6),
});

const buildEvidenceSignalBuckets = (answerText = '') => ({
  ownership: extractSignalBucket(answerText, OWNERSHIP_VERBS),
  decisionMaking: extractSignalBucket(answerText, DECISION_TERMS),
  problemSolving: extractSignalBucket(answerText, PROBLEM_SOLVING_TERMS),
  communication: extractSignalBucket(answerText, COMMUNICATION_TERMS),
  collaboration: extractSignalBucket(answerText, COLLABORATION_TERMS),
  leadership: extractSignalBucket(answerText, LEADERSHIP_TERMS),
  customerOrStakeholder: extractSignalBucket(answerText, CUSTOMER_OR_STAKEHOLDER_TERMS),
});

const inferIntent = ({ technologies = [], roleVocabularyHits = [], ownershipSignals = [], frictionSignals = [], latestQuestionStage = '', answerText = '' } = {}) => {
  const lowerStage = normalizeKey(latestQuestionStage);
  if (MISUNDERSTANDING_TERMS.some((term) => containsPhrase(answerText, term))) return 'clarification_needed';
  if (technologies.length || lowerStage.includes('technical')) return 'technical_or_domain_example';
  if (roleVocabularyHits.length && lowerStage.includes('technical')) return 'technical_or_domain_example';
  if (frictionSignals.length || lowerStage.includes('behaviour')) return 'behavioural_example';
  if (ownershipSignals.length) return 'experience_example';
  return 'general_answer';
};

const inferMissingEvidence = ({ ownershipSignals = [], metrics = [], evidenceSignals = [], frictionSignals = [], tokenCount = 0 } = {}) => {
  const missing = [];
  if (!ownershipSignals.length) missing.push('personal_ownership');
  if (!metrics.length && !evidenceSignals.some((item) => ['result', 'outcome', 'impact', 'reduced', 'improved', 'increased', 'saved'].includes(normalizeKey(item)))) {
    missing.push('result_or_impact');
  }
  if (!evidenceSignals.some((item) => ['validated', 'verified', 'tested', 'test', 'measured', 'checked'].includes(normalizeKey(item)))) {
    missing.push('validation_method');
  }
  if (!frictionSignals.length && tokenCount >= 18) missing.push('tradeoff_or_failure_detail');
  return missing;
};

const buildRoleAlignment = ({ answerText = '', lexicon = {} } = {}) => {
  const roleVocabularyHits = extractRoleHits(answerText, lexicon.terms, 12);
  const matchedRequirements = extractRoleHits(answerText, lexicon.requiredTerms, 8);
  const matchedCvEvidence = extractRoleHits(answerText, lexicon.candidateEvidenceTerms, 8);
  const matchedGaps = extractRoleHits(answerText, lexicon.gapTerms, 8);
  const unresolvedGaps = unique(ensureArray(lexicon.gapTerms)
    .filter((term) => normalizeText(term).length >= 3 && !matchedGaps.some((hit) => normalizeKey(hit) === normalizeKey(term))))
    .slice(0, 6);

  return {
    roleVocabularyHits,
    matchedRequirements,
    matchedCvEvidence,
    matchedGaps,
    unresolvedGaps,
    roleMatchConfidence: Math.max(0.2, Math.min(0.95, Number((
      0.35
      + Math.min(0.25, roleVocabularyHits.length * 0.04)
      + Math.min(0.2, matchedRequirements.length * 0.05)
      + Math.min(0.15, matchedCvEvidence.length * 0.04)
    ).toFixed(2)))),
  };
};

const buildSuggestedFollowUp = ({ intent, technologies, roleAlignment, frictionSignals, missingEvidence, latestQuestionTopic, priorityTopics, tokenCount, misunderstanding }) => {
  if (misunderstanding) {
    return {
      mode: 'rephrase',
      topic: latestQuestionTopic || priorityTopics[0] || 'current_topic',
      questionGoal: 'restate the current question in simpler terms and ask for one concrete example',
      sourceType: 'clarification',
    };
  }

  const topicParts = unique([
    ...technologies.slice(0, 2),
    ...ensureArray(roleAlignment?.matchedRequirements).slice(0, 2),
    ...ensureArray(roleAlignment?.matchedGaps).slice(0, 2),
    ...(frictionSignals.length ? ['failure analysis'] : []),
    latestQuestionTopic,
    priorityTopics[0],
  ]);
  const topic = topicParts.slice(0, 3).join(' / ') || 'current example';

  if (tokenCount < 10) {
    return {
      mode: 'probe',
      topic,
      questionGoal: 'ask for one specific example with the candidate personal action and outcome',
      sourceType: 'common_template',
    };
  }

  if (missingEvidence.length) {
    return {
      mode: 'deepen',
      topic,
      questionGoal: `ask for ${missingEvidence.slice(0, 2).join(' and ')} while staying on the same answer facts`,
      sourceType: roleAlignment?.matchedGaps?.length ? 'match_gap' : roleAlignment?.matchedRequirements?.length ? 'jd_requirement' : 'common_template',
    };
  }

  return {
    mode: intent === 'technical_or_domain_example' ? 'deepen' : 'advance',
    topic,
    questionGoal: intent === 'technical_or_domain_example'
      ? 'test the trade-off, failure mode, or validation behind the role-specific example'
      : 'advance only after briefly acknowledging the concrete evidence',
    sourceType: roleAlignment?.matchedRequirements?.length ? 'jd_requirement' : 'common_template',
  };
};

export const extractFastAnswerUnderstanding = ({ session = {}, environment = {}, answerText = '' } = {}) => {
  const cleanAnswer = normalizeText(answerText || environment?.latestAnswer?.text);
  const latestQuestionTopic = environment?.questionContext?.latestQuestionTopic || '';
  const latestQuestionStage = environment?.questionContext?.latestQuestionStage || '';
  const lexicon = buildAnswerUnderstandingLexicon(session);
  const tokens = tokenize(cleanAnswer);
  const tokenCount = tokens.length;
  const sentenceCount = splitSentences(cleanAnswer).length;
  const technologies = extractTechnologies(cleanAnswer, lexicon);
  const ownershipSignals = extractSignals(cleanAnswer, OWNERSHIP_VERBS);
  const evidenceSignals = extractSignals(cleanAnswer, EVIDENCE_TERMS);
  const frictionSignals = extractSignals(cleanAnswer, FRICTION_TERMS);
  const decisionSignals = extractSignals(cleanAnswer, DECISION_TERMS);
  const metrics = extractMetrics(cleanAnswer);
  const roleAlignment = buildRoleAlignment({ answerText: cleanAnswer, lexicon });
  const mentionedEntities = unique([
    ...extractCapitalizedPhrases(cleanAnswer),
    ...technologies,
    ...roleAlignment.roleVocabularyHits,
  ]).slice(0, 14);
  const misunderstanding = MISUNDERSTANDING_TERMS.some((term) => containsPhrase(cleanAnswer, term));
  const intent = inferIntent({
    technologies,
    roleVocabularyHits: roleAlignment.roleVocabularyHits,
    ownershipSignals,
    frictionSignals,
    latestQuestionStage,
    answerText: cleanAnswer,
  });
  const missingEvidence = inferMissingEvidence({ ownershipSignals, metrics, evidenceSignals, frictionSignals, tokenCount });
  const starSignals = buildStarSignals({ answerText: cleanAnswer, ownershipSignals, evidenceSignals, frictionSignals, metrics });
  const evidenceSignalBuckets = buildEvidenceSignalBuckets(cleanAnswer);
  const suggestedFollowUp = buildSuggestedFollowUp({
    intent,
    technologies,
    roleAlignment,
    frictionSignals,
    missingEvidence,
    latestQuestionTopic,
    priorityTopics: lexicon.priorityTopics,
    tokenCount,
    misunderstanding,
  });
  const structureConfidence = Math.max(0.25, Math.min(0.95, Number((
    0.32
    + Math.min(0.18, ownershipSignals.length * 0.04)
    + Math.min(0.14, evidenceSignals.length * 0.03)
    + Math.min(0.12, decisionSignals.length * 0.03)
    + (metrics.length ? 0.06 : 0)
    + (starSignals.result.length ? 0.05 : 0)
    - (tokenCount < 6 ? 0.12 : 0)
  ).toFixed(2))));
  const confidence = Math.max(0.35, Math.min(0.94, Number((
    0.38
    + Math.min(0.14, technologies.length * 0.035)
    + Math.min(0.14, roleAlignment.roleVocabularyHits.length * 0.03)
    + Math.min(0.12, ownershipSignals.length * 0.03)
    + Math.min(0.1, evidenceSignals.length * 0.02)
    + (frictionSignals.length ? 0.05 : 0)
    + (metrics.length ? 0.04 : 0)
    - (tokenCount < 6 ? 0.12 : 0)
  ).toFixed(2))));
  const answerCompleteness = missingEvidence.length >= 3 || tokenCount < 10
    ? 'thin'
    : missingEvidence.length ? 'partial' : 'strong';

  return {
    source: 'local_js',
    parserVersion: 'role_agnostic_v2',
    intent,
    answerCompleteness,
    answerStats: {
      tokenCount,
      sentenceCount,
      hasNumbers: metrics.length > 0,
      hasOutcomeLanguage: evidenceSignals.some((item) => ['result', 'outcome', 'impact', 'reduced', 'improved', 'increased', 'saved'].includes(normalizeKey(item))),
      hasRoleVocabulary: roleAlignment.roleVocabularyHits.length > 0,
      hasDecisionLanguage: decisionSignals.length > 0,
    },
    coreEvidence: {
      starSignals,
      missing: missingEvidence,
      evidenceStrength: answerCompleteness,
      evidenceSignals: evidenceSignalBuckets,
      decisionSignals,
    },
    roleAlignment,
    followUpRecommendation: {
      ...suggestedFollowUp,
      reason: missingEvidence.length
        ? `Missing evidence: ${missingEvidence.slice(0, 2).join(', ')}`
        : roleAlignment.matchedRequirements.length
          ? 'Answer mentions role requirement evidence.'
          : 'Use generic interview evidence structure.',
    },
    keyFacts: unique([
      ...technologies.map((item) => `mentioned ${item}`),
      ...roleAlignment.roleVocabularyHits.slice(0, 4).map((item) => `role vocabulary: ${item}`),
      ...ownershipSignals.slice(0, 3).map((item) => `ownership signal: ${item}`),
      ...frictionSignals.slice(0, 3).map((item) => `friction signal: ${item}`),
      ...metrics.slice(0, 3).map((item) => `metric: ${item}`),
    ]).slice(0, 12),
    technologies,
    metrics,
    ownershipSignals,
    evidenceSignals,
    frictionSignals,
    decisionSignals,
    mentionedEntities,
    missingEvidence,
    suggestedFollowUp,
    confidence,
    structureConfidence,
    roleMatchConfidence: roleAlignment.roleMatchConfidence,
  };
};

const clipString = (value = '', maxLength = 1800) => {
  const text = normalizeText(value);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const buildAdapterPayload = (payload = {}) => {
  const raw = {
    answerText: clipString(payload.answerText, 3000),
    questionContext: payload.questionContext || {},
    roleContext: payload.roleContext || {},
    candidateContext: payload.candidateContext || {},
  };
  const serialized = JSON.stringify(raw);
  if (serialized.length <= MAX_ADAPTER_PAYLOAD_CHARS) return raw;
  return {
    answerText: raw.answerText,
    questionContext: raw.questionContext,
    roleContext: {
      targetRole: raw.roleContext?.targetRole || null,
      priorityTopics: ensureArray(raw.roleContext?.priorityTopics).slice(0, 8),
      validationTargets: ensureArray(raw.roleContext?.validationTargets).slice(0, 8),
      requiredSkills: ensureArray(raw.roleContext?.requiredSkills).slice(0, 12),
    },
    candidateContext: {
      skills: ensureArray(raw.candidateContext?.skills).slice(0, 12),
      projects: ensureArray(raw.candidateContext?.projects).slice(0, 5),
      suggestedInterviewHooks: ensureArray(raw.candidateContext?.suggestedInterviewHooks).slice(0, 8),
    },
  };
};

const runAdapterCommand = ({ command, payload, timeoutMs }) => new Promise((resolve, reject) => {
  const child = spawn(command, {
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill('SIGTERM');
    reject(new Error(`Answer understanding adapter timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  child.on('error', (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    reject(error);
  });
  child.on('close', (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (code !== 0) {
      reject(new Error(stderr || `Answer understanding adapter exited with code ${code}`));
      return;
    }
    try {
      resolve(JSON.parse(stdout));
    } catch (error) {
      reject(new Error(`Answer understanding adapter returned invalid JSON: ${error.message}`));
    }
  });

  child.stdin.end(`${JSON.stringify(buildAdapterPayload(payload))}\n`);
});

const normalizeAdapterResult = (result = {}, fallback = {}) => ({
  ...fallback,
  ...result,
  source: result.source || 'adapter',
  suggestedFollowUp: {
    ...(fallback.suggestedFollowUp || {}),
    ...(result.suggestedFollowUp || {}),
  },
  followUpRecommendation: {
    ...(fallback.followUpRecommendation || {}),
    ...(result.followUpRecommendation || {}),
  },
  technologies: unique(result.technologies || fallback.technologies || []),
  keyFacts: unique(result.keyFacts || fallback.keyFacts || []),
  mentionedEntities: unique(result.mentionedEntities || fallback.mentionedEntities || []),
  missingEvidence: unique(result.missingEvidence || fallback.missingEvidence || []),
  confidence: Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : fallback.confidence,
});

const estimateEvidenceGainScore = (understanding = {}, tokenCount = 0) => {
  const hasOwnership = ensureArray(understanding.ownershipSignals).length > 0;
  const hasEvidence = ensureArray(understanding.evidenceSignals).length > 0 || ensureArray(understanding.metrics).length > 0;
  const hasRoleAlignment = ensureArray(understanding.roleAlignment?.roleVocabularyHits).length > 0;
  const base = understanding.answerCompleteness === 'strong' ? 0.72 : understanding.answerCompleteness === 'partial' ? 0.54 : 0.34;
  return Math.max(0, Math.min(1, Number((
    base
    + (hasOwnership ? 0.06 : 0)
    + (hasEvidence ? 0.08 : 0)
    + (hasRoleAlignment ? 0.05 : 0)
    + (tokenCount > 35 ? 0.04 : 0)
  ).toFixed(2))));
};

const hasConflictingRuleSignals = (understanding = {}) => {
  const missingCount = ensureArray(understanding.missingEvidence).length;
  const ownershipCount = ensureArray(understanding.ownershipSignals).length;
  const evidenceCount = ensureArray(understanding.evidenceSignals).length + ensureArray(understanding.metrics).length;
  return (
    understanding.answerCompleteness === 'strong' && missingCount >= 3
  ) || (
      understanding.intent === 'general_answer' && (ownershipCount > 0 || evidenceCount > 0)
    );
};

const shouldUseSemanticUnderstanding = ({ localUnderstanding = {}, answerText = '', environment = {} } = {}) => {
  if (process.env.DISABLE_MODEL_ANSWER_UNDERSTANDING === 'true') return false;
  const tokenCount = tokenize(answerText).length;
  const evidenceGainScore = estimateEvidenceGainScore(localUnderstanding, tokenCount);
  const missingEvidence = ensureArray(localUnderstanding.missingEvidence);
  const nearFinalTurn = Boolean(environment?.interviewStructure?.isFinalPlannedTurn || environment?.questionContext?.isFinalPlannedTurn);
  const complexStorySignals = tokenCount > 35
    && (ensureArray(localUnderstanding.frictionSignals).length || ensureArray(localUnderstanding.ownershipSignals).length);
  const lowStructureConfidence = Number(localUnderstanding.structureConfidence || localUnderstanding.confidence || 0) < 0.52;
  const lowRoleMatchButRoleQuestion = Number(localUnderstanding.roleMatchConfidence || 0) < 0.35
    && normalizeText(environment?.questionContext?.latestQuestionTopic).length > 0
    && tokenCount > 20;

  return (
    Number(localUnderstanding.confidence || 0) < 0.58
    || lowStructureConfidence
    || lowRoleMatchButRoleQuestion
    || (tokenCount > 25 && evidenceGainScore < 0.45)
    || (missingEvidence.length >= 3 && tokenCount > 35)
    || hasConflictingRuleSignals(localUnderstanding)
    || complexStorySignals
    || nearFinalTurn
  );
};

const extractJsonObject = (text = '') => {
  const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = String(text || '').indexOf('{');
  const end = String(text || '').lastIndexOf('}');
  if (start >= 0 && end > start) return String(text).slice(start, end + 1);
  return String(text || '').trim();
};

const normalizeSemanticResult = (result = {}) => ({
  source: 'model_assisted',
  intent: normalizeText(result.intent),
  answerCompleteness: ['thin', 'partial', 'strong'].includes(result.answerCompleteness) ? result.answerCompleteness : '',
  keyFacts: unique(result.keyFacts || []),
  technologies: unique(result.technologies || []),
  metrics: unique(result.metrics || []),
  ownershipSignals: unique(result.ownershipSignals || []),
  evidenceSignals: unique(result.evidenceSignals || []),
  frictionSignals: unique(result.frictionSignals || []),
  decisionSignals: unique(result.decisionSignals || []),
  missingEvidence: unique(result.missingEvidence || []),
  semanticOpportunity: normalizeText(result.semanticOpportunity),
  followUpValue: ['low', 'medium', 'high'].includes(result.followUpValue) ? result.followUpValue : '',
  confidence: Number.isFinite(Number(result.confidence)) ? Math.max(0, Math.min(1, Number(result.confidence))) : 0,
});

const buildSemanticPrompt = ({ answerText = '', environment = {}, localUnderstanding = {} } = {}) => `Analyze the candidate answer for interview follow-up planning.

Return valid JSON only with this exact shape:
{
  "source": "model_assisted",
  "intent": "technical_or_domain_example | behavioural_example | clarification_needed | experience_example | general_answer",
  "answerCompleteness": "thin | partial | strong",
  "keyFacts": ["string"],
  "technologies": ["string"],
  "metrics": ["string"],
  "ownershipSignals": ["string"],
  "evidenceSignals": ["string"],
  "frictionSignals": ["string"],
  "decisionSignals": ["string"],
  "missingEvidence": ["personal_ownership", "result_or_impact", "validation_method", "tradeoff_or_failure_detail"],
  "semanticOpportunity": "string",
  "followUpValue": "low | medium | high",
  "confidence": 0.0
}

Rules:
- Stay grounded in the answer. Do not invent facts.
- Missing evidence should describe what the answer did not prove.
- semanticOpportunity should identify the best safe follow-up opportunity in one sentence.
- Prefer concrete candidate-owned actions, measurable results, validation method, and trade-offs.
- Treat role-specific evidence broadly. It may be technical, clinical, customer, operational, project, leadership, or domain evidence depending on the role.

Context:
${JSON.stringify({
  answerText: clipString(answerText, 3000),
  latestQuestion: environment?.questionContext?.latestQuestionText,
  latestQuestionTopic: environment?.questionContext?.latestQuestionTopic,
  latestQuestionStage: environment?.questionContext?.latestQuestionStage,
  roleContext: {
    targetRole: environment?.roleContext?.targetRole,
    requiredSkills: ensureArray(environment?.roleContext?.requiredSkills).slice(0, 12),
  },
  localUnderstanding,
}, null, 2)}`;

const mergeSemanticUnderstanding = ({ localUnderstanding = {}, semanticUnderstanding = {} } = {}) => ({
  ...localUnderstanding,
  source: 'local_js+model_assisted',
  intent: semanticUnderstanding.intent || localUnderstanding.intent,
  answerCompleteness: semanticUnderstanding.answerCompleteness || localUnderstanding.answerCompleteness,
  keyFacts: unique([...(localUnderstanding.keyFacts || []), ...(semanticUnderstanding.keyFacts || [])]).slice(0, 12),
  technologies: unique([...(localUnderstanding.technologies || []), ...(semanticUnderstanding.technologies || [])]).slice(0, 10),
  metrics: unique([...(localUnderstanding.metrics || []), ...(semanticUnderstanding.metrics || [])]).slice(0, 8),
  ownershipSignals: unique([...(localUnderstanding.ownershipSignals || []), ...(semanticUnderstanding.ownershipSignals || [])]).slice(0, 8),
  evidenceSignals: unique([...(localUnderstanding.evidenceSignals || []), ...(semanticUnderstanding.evidenceSignals || [])]).slice(0, 8),
  frictionSignals: unique([...(localUnderstanding.frictionSignals || []), ...(semanticUnderstanding.frictionSignals || [])]).slice(0, 8),
  decisionSignals: unique([...(localUnderstanding.decisionSignals || []), ...(semanticUnderstanding.decisionSignals || [])]).slice(0, 8),
  missingEvidence: unique(semanticUnderstanding.missingEvidence || localUnderstanding.missingEvidence || []).slice(0, 6),
  semanticOpportunity: semanticUnderstanding.semanticOpportunity || localUnderstanding.semanticOpportunity || '',
  followUpValue: semanticUnderstanding.followUpValue || localUnderstanding.followUpValue || '',
  confidence: Math.max(Number(localUnderstanding.confidence || 0), Number(semanticUnderstanding.confidence || 0)),
  suggestedFollowUp: {
    ...(localUnderstanding.suggestedFollowUp || {}),
    questionGoal: semanticUnderstanding.semanticOpportunity || localUnderstanding.suggestedFollowUp?.questionGoal,
  },
  followUpRecommendation: {
    ...(localUnderstanding.followUpRecommendation || localUnderstanding.suggestedFollowUp || {}),
    questionGoal: semanticUnderstanding.semanticOpportunity || localUnderstanding.followUpRecommendation?.questionGoal || localUnderstanding.suggestedFollowUp?.questionGoal,
  },
});

export const resolveFastAnswerUnderstanding = async ({ session = {}, environment = {}, answerText = '' } = {}) => {
  const cleanAnswer = normalizeText(answerText || environment?.latestAnswer?.text);
  const fallback = extractFastAnswerUnderstanding({ session, environment, answerText: cleanAnswer });
  const command = normalizeText(process.env.ANSWER_UNDERSTANDING_ADAPTER_COMMAND);
  if (!command) {
    if (!shouldUseSemanticUnderstanding({ localUnderstanding: fallback, answerText: cleanAnswer, environment })) {
      return fallback;
    }
    try {
      const { content } = await callDeepSeek(
        buildSemanticPrompt({ answerText: cleanAnswer, environment, localUnderstanding: fallback }),
        'You are a strict semantic answer-understanding service. Return JSON only.',
        {
          usageMetadata: { stage: 'interview', operation: 'llm_json', feature: 'answer_understanding' },
        },
      );
      const semanticUnderstanding = normalizeSemanticResult(JSON.parse(extractJsonObject(content)));
      return mergeSemanticUnderstanding({ localUnderstanding: fallback, semanticUnderstanding });
    } catch (error) {
      return {
        ...fallback,
        modelUnderstandingError: error?.message || String(error),
      };
    }
  }

  const timeoutMs = Number(process.env.ANSWER_UNDERSTANDING_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  try {
    const adapterResult = await runAdapterCommand({
      command,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
      payload: {
        answerText: normalizeText(answerText || environment?.latestAnswer?.text),
        questionContext: environment?.questionContext || {},
        roleContext: environment?.roleContext || {},
        candidateContext: environment?.candidateContext || {},
      },
    });
    return normalizeAdapterResult(adapterResult, fallback);
  } catch (error) {
    return {
      ...fallback,
      adapterError: error?.message || String(error),
    };
  }
};
