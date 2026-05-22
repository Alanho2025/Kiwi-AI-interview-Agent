import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 180;
const MAX_ADAPTER_PAYLOAD_CHARS = 12000;

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').trim();
const normalizeKey = (value = '') => normalizeText(value).toLowerCase();
const tokenize = (value = '') => normalizeKey(value).split(/[^a-z0-9+#.]+/).filter(Boolean);

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

const OWNERSHIP_VERBS = [
  'built', 'build', 'designed', 'implemented', 'implement', 'led', 'lead', 'owned', 'own',
  'debugged', 'debug', 'fixed', 'fix', 'deployed', 'deploy', 'created', 'create',
  'improved', 'improve', 'migrated', 'migrate', 'integrated', 'integrate',
  'used', 'use', 'handled', 'handle', 'checked', 'check', 'analyzed', 'analysed',
];

const EVIDENCE_TERMS = [
  'result', 'outcome', 'impact', 'measured', 'validated', 'verified', 'tested', 'test',
  'reduced', 'improved', 'increased', 'decreased', 'saved', 'faster', 'slower',
  'latency', 'throughput', 'uptime', 'conversion', 'accuracy',
];

const FRICTION_TERMS = [
  'failed', 'failure', 'bug', 'debug', 'incident', 'bottleneck', 'blocked', 'constraint',
  'tradeoff', 'trade-off', 'deadline', 'limited', 'conflict', 'disagreed', 'risk',
  'regression', 'outage', 'error', 'issue', 'problem',
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

export const buildAnswerUnderstandingLexicon = (session = {}) => {
  const analysis = session.analysisResult || {};
  const profile = analysis.parsedCvProfile || session.cvProfile || {};
  const jdProfile = analysis.parsedJdProfile || {};
  const questionHints = analysis.matchingDetails?.questionPlanHints || {};
  const interviewPlan = session.interviewPlan || {};

  const rawTerms = [
    session.targetRole,
    ...collectStrings(profile.skills),
    ...collectStrings(profile.projects),
    ...collectStrings(profile.experience),
    ...collectStrings(jdProfile.requiredSkills),
    ...collectStrings(jdProfile.technicalSkillRequirements),
    ...collectStrings(jdProfile.mustHaveRequirements),
    ...collectStrings(jdProfile.sections?.mustHaveRequirements),
    ...collectStrings(jdProfile.sections?.technicalSkills),
    ...collectStrings(questionHints.priorityTopics),
    ...collectStrings(analysis.matchingDetails?.validationTargets),
    ...collectStrings(interviewPlan.questionPool?.map((question) => [question.topic, question.stage, question.text])),
  ];

  const terms = unique(rawTerms)
    .flatMap((item) => String(item).split(/[,/|]/).map((part) => part.trim()))
    .filter((item) => item.length >= 2)
    .slice(0, 120);

  return {
    terms,
    technologies: unique([
      ...terms.filter((term) => {
        const lower = normalizeKey(term);
        return [...TECHNOLOGY_ALIASES.values()].some((aliases) => aliases.some((alias) => lower.includes(alias)));
      }),
      ...[...TECHNOLOGY_ALIASES.keys()],
    ]),
    priorityTopics: unique([
      ...collectStrings(questionHints.priorityTopics),
      ...collectStrings(analysis.matchingDetails?.validationTargets),
    ]).slice(0, 20),
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

  return unique(found).slice(0, 10);
};

const extractSignals = (answerText, terms) => {
  const normalized = normalizeKey(answerText);
  const answerTokens = new Set(tokenize(answerText));
  return terms.filter((term) => normalized.includes(term) || answerTokens.has(term));
};

const extractMetrics = (answerText) => unique(answerText.match(/\b\d+(?:\.\d+)?\s*(?:%|percent|ms|seconds?|minutes?|hours?|x|times|users?|requests?|queries?)?\b/gi) || []);

const inferIntent = ({ technologies = [], ownershipSignals = [], frictionSignals = [], latestQuestionStage = '', answerText = '' } = {}) => {
  const lowerStage = normalizeKey(latestQuestionStage);
  if (MISUNDERSTANDING_TERMS.some((term) => containsPhrase(answerText, term))) return 'clarification_needed';
  if (technologies.length || lowerStage.includes('technical')) return 'technical_example';
  if (frictionSignals.length || lowerStage.includes('behaviour')) return 'behavioural_example';
  if (ownershipSignals.length) return 'experience_example';
  return 'general_answer';
};

const inferMissingEvidence = ({ ownershipSignals = [], metrics = [], evidenceSignals = [], frictionSignals = [], tokenCount = 0 } = {}) => {
  const missing = [];
  if (!ownershipSignals.length) missing.push('personal_ownership');
  if (!metrics.length && !evidenceSignals.some((item) => ['result', 'outcome', 'impact', 'reduced', 'improved', 'increased'].includes(item))) {
    missing.push('result_or_impact');
  }
  if (!evidenceSignals.some((item) => ['validated', 'verified', 'tested', 'test', 'measured'].includes(item))) {
    missing.push('validation_method');
  }
  if (!frictionSignals.length && tokenCount >= 18) missing.push('tradeoff_or_failure_detail');
  return missing;
};

const buildSuggestedFollowUp = ({ intent, technologies, frictionSignals, missingEvidence, latestQuestionTopic, priorityTopics, tokenCount, misunderstanding }) => {
  if (misunderstanding) {
    return {
      mode: 'rephrase',
      topic: latestQuestionTopic || priorityTopics[0] || 'current_topic',
      questionGoal: 'restate the current question in simpler terms and ask for one concrete example',
    };
  }

  const topicParts = unique([
    ...technologies.slice(0, 3),
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
    };
  }

  if (missingEvidence.length) {
    return {
      mode: 'deepen',
      topic,
      questionGoal: `ask for ${missingEvidence.slice(0, 2).join(' and ')} while staying on the same answer facts`,
    };
  }

  return {
    mode: intent === 'technical_example' ? 'deepen' : 'advance',
    topic,
    questionGoal: intent === 'technical_example'
      ? 'test the trade-off, failure mode, or validation behind the technical example'
      : 'advance only after briefly acknowledging the concrete evidence',
  };
};

export const extractFastAnswerUnderstanding = ({ session = {}, environment = {}, answerText = '' } = {}) => {
  const cleanAnswer = normalizeText(answerText || environment?.latestAnswer?.text);
  const latestQuestionTopic = environment?.questionContext?.latestQuestionTopic || '';
  const latestQuestionStage = environment?.questionContext?.latestQuestionStage || '';
  const lexicon = buildAnswerUnderstandingLexicon(session);
  const tokenCount = tokenize(cleanAnswer).length;
  const technologies = extractTechnologies(cleanAnswer, lexicon);
  const ownershipSignals = extractSignals(cleanAnswer, OWNERSHIP_VERBS);
  const evidenceSignals = extractSignals(cleanAnswer, EVIDENCE_TERMS);
  const frictionSignals = extractSignals(cleanAnswer, FRICTION_TERMS);
  const metrics = extractMetrics(cleanAnswer);
  const mentionedEntities = unique([
    ...extractCapitalizedPhrases(cleanAnswer),
    ...technologies,
  ]).slice(0, 12);
  const misunderstanding = MISUNDERSTANDING_TERMS.some((term) => containsPhrase(cleanAnswer, term));
  const intent = inferIntent({ technologies, ownershipSignals, frictionSignals, latestQuestionStage, answerText: cleanAnswer });
  const missingEvidence = inferMissingEvidence({ ownershipSignals, metrics, evidenceSignals, frictionSignals, tokenCount });
  const suggestedFollowUp = buildSuggestedFollowUp({
    intent,
    technologies,
    frictionSignals,
    missingEvidence,
    latestQuestionTopic,
    priorityTopics: lexicon.priorityTopics,
    tokenCount,
    misunderstanding,
  });
  const confidence = Math.max(0.35, Math.min(0.94, Number((
    0.42
    + Math.min(0.18, technologies.length * 0.04)
    + Math.min(0.14, ownershipSignals.length * 0.035)
    + Math.min(0.12, evidenceSignals.length * 0.025)
    + (frictionSignals.length ? 0.06 : 0)
    + (metrics.length ? 0.04 : 0)
    - (tokenCount < 6 ? 0.12 : 0)
  ).toFixed(2))));

  return {
    source: 'local_js',
    intent,
    answerCompleteness: missingEvidence.length >= 3 || tokenCount < 10 ? 'thin' : missingEvidence.length ? 'partial' : 'strong',
    keyFacts: unique([
      ...technologies.map((item) => `mentioned ${item}`),
      ...ownershipSignals.slice(0, 3).map((item) => `ownership signal: ${item}`),
      ...frictionSignals.slice(0, 3).map((item) => `friction signal: ${item}`),
      ...metrics.slice(0, 3).map((item) => `metric: ${item}`),
    ]).slice(0, 10),
    technologies,
    metrics,
    ownershipSignals,
    evidenceSignals,
    frictionSignals,
    mentionedEntities,
    missingEvidence,
    suggestedFollowUp,
    confidence,
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
  technologies: unique(result.technologies || fallback.technologies || []),
  keyFacts: unique(result.keyFacts || fallback.keyFacts || []),
  mentionedEntities: unique(result.mentionedEntities || fallback.mentionedEntities || []),
  missingEvidence: unique(result.missingEvidence || fallback.missingEvidence || []),
  confidence: Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : fallback.confidence,
});

export const resolveFastAnswerUnderstanding = async ({ session = {}, environment = {}, answerText = '' } = {}) => {
  const fallback = extractFastAnswerUnderstanding({ session, environment, answerText });
  const command = normalizeText(process.env.ANSWER_UNDERSTANDING_ADAPTER_COMMAND);
  if (!command) return fallback;

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
