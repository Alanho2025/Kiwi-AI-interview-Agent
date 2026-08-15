export const QUESTION_CATALOG_VERSION = '2026.1';

const ALL_LEVELS = ['junior', 'intermediate', 'senior'];
const REVIEWED_AT = '2026-07-29';
const STRUCTURED_INTERVIEW_SOURCES = [
  'https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/',
];
const AI_INTERVIEW_SOURCES = [
  'https://www.tieroneprep.com/blog/ai-engineer-interview-questions/',
  'https://www.tryexponent.com/blog/ai-engineer-interview-questions',
];
const ML_INTERVIEW_SOURCES = [
  'https://www.datacamp.com/blog/data-scientist-interview-questions',
  'https://arxiv.org/abs/2209.09125',
];
const CODING_AGENT_SOURCES = [
  'https://docs.github.com/en/copilot/concepts/agents/about-third-party-coding-agents',
  'https://developers.google.com/gemini-code-assist/docs/agent-mode',
  'https://docs.anthropic.com/en/docs/claude-code/cli-usage',
];

const buildResearchBasis = (questionType = '') => {
  const sources = questionType.startsWith('ml_')
    ? ML_INTERVIEW_SOURCES
    : questionType.startsWith('ai_')
      ? AI_INTERVIEW_SOURCES
      : STRUCTURED_INTERVIEW_SOURCES;
  return {
    frequencyBand: questionType.startsWith('ai_') || questionType.startsWith('ml_') ? 'role_specific' : 'curated',
    sources,
    reviewedAt: REVIEWED_AT,
  };
};

const buildLevelPromptVariants = ({ prompt = '', category = 'behavioural' } = {}) => {
  const technical = category === 'technical';
  return [
    {
      id: 'junior',
      targetLevels: ['junior'],
      text: technical
        ? `${prompt} Use one concrete example and explain what you personally did.`
        : `${prompt} Start with the final outcome, then explain what you personally did.`,
    },
    {
      id: 'intermediate',
      targetLevels: ['intermediate'],
      text: technical
        ? `${prompt} Explain the key decision, how you validated it, and the outcome.`
        : `${prompt} Start by sharing the final outcome, then explain the decision you made and your personal contribution.`,
    },
    {
      id: 'senior',
      targetLevels: ['senior'],
      text: technical
        ? `${prompt} Explain the scope, trade-offs, risks, stakeholder impact, and how you knew the result was safe to operate.`
        : `${prompt} Start by sharing the final outcome, then explain the scope, trade-offs, stakeholder impact, and what you would carry into a similar situation.`,
    },
  ];
};

const defaultNotEligibleExample = ({ questionType = '', roleFamilies = [], requiredCandidateSignals = [] } = {}) => {
  if (requiredCandidateSignals.length) return `Do not select when the candidate has not explicitly provided the required signal: ${requiredCandidateSignals.join(', ')}.`;
  if (questionType.startsWith('ml_')) return 'Do not select from an AI tool name alone when the role and JD contain no machine-learning responsibility.';
  if (questionType.startsWith('ai_')) return `Do not select when the role falls outside ${roleFamilies.join(', ') || 'the configured role families'} or its AI eligibility gate is not satisfied.`;
  return '';
};

const taxonomyEntry = ({ aliases = [], sources = CODING_AGENT_SOURCES, ...entry } = {}) => ({
  ...entry,
  catalogVersion: QUESTION_CATALOG_VERSION,
  lifecycle: 'active',
  lastReviewedAt: REVIEWED_AT,
  sources,
  aliases,
  aliasGovernance: Object.fromEntries(aliases.map((alias) => [
    alias,
    {
      lifecycle: 'active',
      lastReviewedAt: REVIEWED_AT,
      sources,
    },
  ])),
});

const RESEARCH_BASIS = {
  frequencyBand: 'curated',
  sources: STRUCTURED_INTERVIEW_SOURCES,
  reviewedAt: REVIEWED_AT,
};

const question = ({
  catalogQuestionId,
  questionFamily = catalogQuestionId,
  questionType,
  competency,
  category = 'behavioural',
  roleFamilies = ['general'],
  targetLevels = ALL_LEVELS,
  prompt,
  promptVariants = [],
  expectedSignals,
  requiredCandidateSignals = [],
  requiresExplicitAiDelivery = false,
  requiresAiOrDigitalSignal = false,
  requiresMlSignal = false,
  selectionPolicy = {},
  notEligibleExamples = [],
  researchBasis = null,
}) => ({
  catalogQuestionId,
  catalogVersion: QUESTION_CATALOG_VERSION,
  lifecycle: 'draft',
  questionFamily,
  questionType,
  competency,
  category,
  targetLevels,
  roleEligibility: {
    roleFamilies,
    requiredCandidateSignals,
    requiresExplicitAiDelivery,
    requiresAiOrDigitalSignal,
    requiresMlSignal,
  },
  promptVariants: promptVariants.length ? promptVariants : buildLevelPromptVariants({ prompt, category }),
  expectedSignals,
  followUpPolicy: [],
  ambiguityPolicy: { mode: 'none' },
  selectionPolicy: { minAsked: 0, maxAsked: 1, reservationPriority: 0, ...selectionPolicy },
  reportDimensions: ['evidence', 'ownership', 'reflection'],
  notEligibleExamples: notEligibleExamples.length
    ? notEligibleExamples
    : [defaultNotEligibleExample({ questionType, roleFamilies, requiredCandidateSignals })].filter(Boolean),
  researchBasis: researchBasis || buildResearchBasis(questionType) || RESEARCH_BASIS,
  humanReview: { reviewer: null, approvedAt: null, decision: 'pending' },
});

export const AI_DELIVERY_SIGNAL_TAXONOMY = [
  taxonomyEntry({
    canonicalKey: 'direct_ai_delivery_role',
    signalFamily: 'ai_delivery_role',
    strength: 'strong',
    aliases: ['ai solution engineer', 'ai engineer', 'llm engineer', 'generative ai engineer', 'applied ai engineer', 'ai product engineer', 'ai automation engineer', 'prompt engineer', 'forward deployed ai', 'agent delivery'],
  }),
  taxonomyEntry({
    canonicalKey: 'foundation_model_provider_or_api',
    signalFamily: 'model_provider',
    strength: 'medium',
    aliases: ['openai', 'chatgpt', 'gpt', 'azure openai', 'anthropic', 'claude', 'google gemini', 'vertex ai', 'gemini api', 'aws bedrock', 'amazon nova', 'mistral', 'cohere', 'model api', 'llm api'],
  }),
  taxonomyEntry({
    canonicalKey: 'coding_assistant_or_agent',
    signalFamily: 'coding_agent',
    strength: 'strong',
    aliases: ['codex', 'chatgpt codex', 'claude code', 'github copilot', 'copilot coding agent', 'cursor', 'windsurf', 'gemini code assist', 'gemini cli', 'amazon q developer', 'jetbrains ai assistant', 'junie', 'replit agent', 'devin', 'augment code', 'sourcegraph cody', 'tabnine', 'cline', 'roo code', 'aider', 'continue', 'opencode'],
  }),
  taxonomyEntry({
    canonicalKey: 'agent_orchestration_framework',
    signalFamily: 'agent_orchestration',
    strength: 'strong',
    aliases: ['openai agents sdk', 'anthropic agent sdk', 'google adk', 'langchain', 'langgraph', 'llamaindex', 'semantic kernel', 'autogen', 'crewai', 'haystack', 'vercel ai sdk', 'agent workflow', 'multi-agent', 'orchestration'],
  }),
  taxonomyEntry({
    canonicalKey: 'tool_interoperability_pattern',
    signalFamily: 'tool_interoperability',
    strength: 'strong',
    aliases: ['mcp', 'model context protocol', 'a2a', 'agent2agent', 'tool calling', 'function calling', 'api tools', 'computer use', 'workflow automation', 'human-in-the-loop', 'approval gate'],
  }),
  taxonomyEntry({
    canonicalKey: 'rag_or_knowledge_grounding',
    signalFamily: 'retrieval',
    strength: 'strong',
    aliases: ['rag', 'retrieval-augmented generation', 'embeddings', 'vector search', 'vector database', 'semantic search', 'hybrid search', 'reranking', 'chunking', 'knowledge base', 'grounded answer', 'citation'],
  }),
  taxonomyEntry({
    canonicalKey: 'prompt_or_context_design',
    signalFamily: 'prompt_context',
    strength: 'medium',
    aliases: ['prompt engineering', 'system prompt', 'prompt template', 'few-shot', 'structured output', 'json schema', 'context window', 'context engineering', 'instruction hierarchy', 'prompt injection'],
  }),
  taxonomyEntry({
    canonicalKey: 'evaluation_observability_safety',
    signalFamily: 'evaluation_safety',
    strength: 'strong',
    aliases: ['evals', 'evaluate', 'evaluation harness', 'golden set', 'llm-as-judge', 'human review', 'prompt versioning', 'trace', 'tracing', 'observability', 'langsmith', 'langfuse', 'phoenix', 'arize', 'weave', 'promptfoo', 'ragas', 'guardrail', 'hallucination', 'red teaming', 'safety evaluation'],
  }),
  taxonomyEntry({
    canonicalKey: 'model_serving_or_ai_infrastructure',
    signalFamily: 'model_infrastructure',
    strength: 'strong',
    aliases: ['inference', 'serving', 'batching', 'gpu', 'vllm', 'tensorrt-llm', 'quantization', 'fine-tuning', 'lora', 'latency', 'token cost', 'model gateway', 'model cache'],
  }),
  taxonomyEntry({
    canonicalKey: 'generic_ai_wording',
    signalFamily: 'generic_ai',
    strength: 'weak',
    aliases: ['ai-powered', 'ai-enabled', 'familiar with ai', 'interest in ai', 'automation', 'copilot'],
  }),
];

export const ML_SIGNAL_ALIASES = [
  'machine learning', 'ml engineer', 'data scientist', 'supervised learning', 'model training',
  'feature engineering', 'classification', 'regression', 'forecasting', 'model monitoring', 'drift',
];

export const QUESTION_CATALOG_SEED = [
  question({
    catalogQuestionId: 'company_role_internship_motivation', questionType: 'motivation', competency: 'role_motivation', category: 'motivation',
    prompt: 'Why do you want to join this company, why this particular role, and what are you hoping to get from this internship or role?',
    expectedSignals: ['specific_motivation', 'role_understanding', 'growth_goal'],
  }),
  question({
    catalogQuestionId: 'group_failure_learning', questionType: 'behavioural_failure', competency: 'learning_from_failure',
    prompt: 'Tell me about a time a group project did not go as planned. What was your part in it, and what did you learn?',
    expectedSignals: ['ownership', 'repair_action', 'reflection'],
  }),
  question({
    catalogQuestionId: 'learning_agility_self_teach', questionType: 'behavioural_learning', competency: 'learning_agility',
    prompt: 'Tell me about a time you had to teach yourself something difficult or unfamiliar. How did you get started and check that you understood it?',
    expectedSignals: ['learning_plan', 'verification', 'reflection'],
  }),
  question({
    catalogQuestionId: 'initiative_value_creation', questionType: 'behavioural_initiative', competency: 'initiative',
    prompt: 'Tell me about a time you took initiative to make something better, easier, or more valuable for someone else.',
    expectedSignals: ['initiative', 'beneficiary', 'impact'],
  }),
  question({
    catalogQuestionId: 'support_struggling_teammate', questionType: 'behavioural_teamwork', competency: 'team_support',
    prompt: 'Have you been in a team where someone was struggling or falling behind? What did you do to help, while still keeping the work moving?',
    expectedSignals: ['empathy', 'practical_support', 'boundary', 'outcome'],
  }),
  question({
    catalogQuestionId: 'career_transition_hardware_to_ai_solution', questionType: 'career_transition', competency: 'transferable_engineering_judgement', category: 'motivation', roleFamilies: ['ai_solution'], requiredCandidateSignals: ['hardware_to_ai_solution'],
    prompt: 'What is motivating your move from hardware engineering to AI Solution Engineering, and which engineering strengths do you expect to transfer?',
    expectedSignals: ['transition_motivation', 'transferable_skill', 'gap_honesty'],
  }),
  question({
    catalogQuestionId: 'role_motivation_ai_solution', questionType: 'role_motivation', competency: 'ai_solution_motivation', category: 'motivation', roleFamilies: ['ai_solution'],
    prompt: 'What attracts you to AI Solution Engineering, and what kind of customer or business problem would you be excited to help solve?',
    expectedSignals: ['business_problem', 'delivery_interest', 'stakeholder_fit'],
  }),
  question({
    catalogQuestionId: 'proud_project', questionType: 'project_reflection', competency: 'project_ownership',
    prompt: 'What project are you most proud of? Please explain the problem, what you personally owned, a key decision, and the outcome.',
    expectedSignals: ['ownership', 'decision', 'impact'],
  }),
  question({
    catalogQuestionId: 'underperforming_project_reflection', questionType: 'project_reflection', competency: 'failure_reflection',
    prompt: 'Tell me about a project where the result was not as good as you hoped. What happened, what did you do next, and what would you change?',
    expectedSignals: ['ownership', 'repair_action', 'reflection'],
  }),
  question({
    catalogQuestionId: 'conflict_resolution', questionType: 'behavioural_conflict', competency: 'conflict_resolution',
    prompt: 'Tell me about a conflict or disagreement with another person on a project. How did you work through it?',
    expectedSignals: ['other_perspective', 'communication', 'resolution'],
  }),
  question({
    catalogQuestionId: 'nz_study_work_motivation', questionType: 'career_motivation', competency: 'career_direction', category: 'motivation', requiredCandidateSignals: ['nz_study_or_work'],
    prompt: 'What led you to choose New Zealand for study or work, and how does it connect to the direction you want to take next?',
    expectedSignals: ['personal_motivation', 'career_direction', 'reflection'],
  }),
  question({
    catalogQuestionId: 'coding_ownership_and_verification', questionType: 'technical_ownership', competency: 'coding_ownership', category: 'technical', roleFamilies: ['software', 'data', 'ai_solution'],
    prompt: 'When you build a feature, what parts do you personally decide and implement, and how do you verify that the result is correct?',
    expectedSignals: ['ownership', 'implementation_judgement', 'verification'],
  }),
  question({
    catalogQuestionId: 'ai_literacy_responsible_use', questionType: 'ai_judgement', competency: 'responsible_ai_judgement', category: 'technical',
    requiresAiOrDigitalSignal: true,
    prompt: 'Where do you think AI could help this kind of work, and where would you keep a person involved to check risk or quality?',
    expectedSignals: ['appropriate_use', 'risk_awareness', 'human_judgement'],
    notEligibleExamples: ['Do not select for a non-technical role when neither the JD, role context, nor an explicit user focus indicates AI-enabled or digital work.'],
  }),
  question({
    catalogQuestionId: 'ai_assisted_delivery', questionType: 'ai_workflow', competency: 'reliable_ai_delivery', category: 'technical', roleFamilies: ['software', 'data', 'ai_solution'],
    prompt: 'How do you use AI when planning, building, debugging, testing, or documenting a project while keeping ownership of the final result?',
    promptVariants: [
      { id: 'junior', targetLevels: ['junior'], text: 'Where in a project have you used AI, what did you use it for, and how did you check the result was useful and correct?' },
      { id: 'intermediate', targetLevels: ['intermediate'], text: 'Walk me through how you use AI across planning, building, debugging, testing, or documentation while keeping ownership of the final result.' },
      { id: 'senior', targetLevels: ['senior'], text: 'When you use AI-assisted development, how do you make trade-offs, risks, and release checks explicit while keeping ownership of the final result?' },
    ],
    expectedSignals: ['workflow', 'ownership', 'verification', 'result'],
    selectionPolicy: { minAsked: 1, maxAsked: 1, coverageSlot: 'software_ai_workflow', reservationPriority: 90 },
  }),
  question({
    catalogQuestionId: 'prompt_and_context_design', questionType: 'ai_prompt_context', competency: 'prompt_context_design', category: 'technical', roleFamilies: ['ai_solution'], requiresExplicitAiDelivery: true,
    prompt: 'When you use an AI model to build a feature, how do you decide what context, constraints, examples, and acceptance criteria to provide?',
    expectedSignals: ['context_design', 'constraints', 'iteration', 'verification'],
  }),
  question({
    catalogQuestionId: 'rag_retrieval_design', questionType: 'ai_retrieval', competency: 'grounded_retrieval_design', category: 'technical', roleFamilies: ['ai_solution'], requiresExplicitAiDelivery: true,
    prompt: 'How would you design a retrieval-augmented feature so that answers are grounded, permission-aware, and still useful when knowledge changes?',
    expectedSignals: ['retrieval_quality', 'permission', 'freshness', 'grounding'],
  }),
  question({
    catalogQuestionId: 'agent_reliability_and_safety', questionType: 'ai_agent_reliability', competency: 'agent_reliability', category: 'technical', roleFamilies: ['ai_solution'], requiresExplicitAiDelivery: true,
    prompt: 'If an AI agent can call tools or automate work, how would you set its limits, handle failures, and decide when a human should review the result?',
    expectedSignals: ['autonomy_boundary', 'failure_handling', 'human_review', 'observability'],
  }),
  question({
    catalogQuestionId: 'ai_evaluation_and_cost', questionType: 'ai_evaluation', competency: 'ai_evaluation', category: 'technical', roleFamilies: ['ai_solution'], requiresExplicitAiDelivery: true,
    prompt: 'How would you evaluate whether an AI feature is useful and safe enough to release, while keeping latency and cost visible?',
    expectedSignals: ['evaluation_set', 'quality_safety', 'latency_cost', 'release_judgement'],
  }),
  question({
    catalogQuestionId: 'ml_problem_framing', questionType: 'ml_foundation', competency: 'ml_problem_framing', category: 'technical', roleFamilies: ['ml', 'data'], requiresMlSignal: true,
    prompt: 'How would you decide whether a problem needs machine learning rather than a simpler rule or baseline, and what outcome would you measure?',
    expectedSignals: ['problem_framing', 'baseline', 'target_metric'],
    selectionPolicy: { minAsked: 1, maxAsked: 1, coverageSlot: 'ml_foundation', reservationPriority: 85 },
  }),
  question({
    catalogQuestionId: 'ml_data_and_evaluation', questionType: 'ml_evaluation', competency: 'ml_evaluation', category: 'technical', roleFamilies: ['ml', 'data'], requiresMlSignal: true,
    prompt: 'How would you prepare data and evaluate a machine learning model while checking for leakage, an appropriate split, and uneven performance?',
    expectedSignals: ['data_split', 'leakage', 'metric', 'subgroup_check'],
  }),
  question({
    catalogQuestionId: 'ml_delivery_and_monitoring', questionType: 'ml_operations', competency: 'ml_delivery_monitoring', category: 'technical', roleFamilies: ['ml'], targetLevels: ['senior'], requiresMlSignal: true,
    prompt: 'How would you release and monitor a machine learning system so that drift, rollback, and ownership are clear?',
    expectedSignals: ['versioning', 'monitoring', 'drift', 'rollback'],
    selectionPolicy: { minAsked: 0, maxAsked: 1, coverageSlot: 'ml_operations', reservationPriority: 55 },
  }),
];
