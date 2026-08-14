import { callDeepSeek } from '../deepseekService.js';

// --- 1. BARS Definitions (Collision-Safe Mapping) ---

const BARS_DEFINITIONS = {
  // 1. Context & Goal
  contextGoal: {
    name: 'Context & Goal',
    levels: {
      1: 'Completely fails to mention context, requirements, or core principles.',
      2: 'Mentions context but is extremely vague and lacks specific details.',
      3: 'Provides basic context or requirements but misses key constraints or objectives.',
      4: 'Clearly defines the problem context, requirements, or principles with good setup.',
      5: 'Demonstrates deep understanding of underlying constraints, business drivers, or systemic impact.'
    }
  },
  // Mapping other keys to Context & Goal
  requirements: 'contextGoal', principle: 'contextGoal', need: 'contextGoal',
  objectivePriorities: 'contextGoal', needGoal: 'contextGoal', contextRequirement: 'contextGoal',

  // 2. Approach & Execution
  approach: {
    name: 'Approach & Execution',
    levels: {
      1: 'No approach or execution steps provided.',
      2: 'Provides only a dismissive or vague approach (e.g., "I will look it up").',
      3: 'Proposes a basic action step but lacks completeness.',
      4: 'Proposes a clear, actionable, and relevant solution or application.',
      5: 'Proposes a comprehensive and logically rigorous systemic approach covering multiple dimensions.'
    }
  },
  execution: 'approach', exploration: 'approach',

  // 3. Options / Alternatives
  options: {
    name: 'Options / Alternatives',
    levels: {
      1: 'Proposes no options or alternatives.',
      2: 'Briefly mentions other possibilities but does not explore them.',
      3: 'Proposes a single option or highly similar options.',
      4: 'Proposes two or more distinctly different options.',
      5: 'Proposes multiple diverse, effective alternative solutions tailored to different constraints.'
    }
  },

  // 4. Reasoning / Judgement
  reasoning: {
    name: 'Reasoning / Judgement',
    levels: {
      1: 'Provides no reasoning for decisions.',
      2: 'Provides vague reasoning (e.g., "This is the standard way").',
      3: 'Provides basic reasoning but does not consider alternatives.',
      4: 'Clearly explains why the approach was chosen with sound logic.',
      5: 'Explicitly weighs the trade-offs and constraints between different options.'
    }
  },
  judgementTradeoffs: 'reasoning', rationale: 'reasoning', judgementAdaptation: 'reasoning',

  // 5. Risk Identification
  riskIdentification: {
    name: 'Risk Identification',
    levels: {
      1: 'Shows no risk awareness.',
      2: 'Shows vague risk awareness (e.g., "I will be careful").',
      3: 'Identifies surface-level risks.',
      4: 'Clearly identifies specific risks or quality standards.',
      5: 'Proactively anticipates systemic, long-term, or edge-case risks.'
    }
  },
  riskQualityEthics: 'riskIdentification', qualityRisk: 'riskIdentification',

  // 6. Controls / Action
  controls: {
    name: 'Controls / Action',
    levels: {
      1: 'Proposes no control measures.',
      2: 'Mentions attention to the issue but lacks concrete preventative actions.',
      3: 'Proposes basic preventative actions.',
      4: 'Proposes specific preventative or control measures.',
      5: 'Establishes a systemic safety net or proactive risk-mitigation mechanism.'
    }
  },
  constraintsTradeoffs: 'controls', assumptionsLimits: 'controls',

  // 7. Ethics / Escalation
  ethicsEscalation: {
    name: 'Ethics / Escalation',
    levels: {
      1: 'Fails to mention ethics or escalation mechanisms.',
      2: 'Acknowledges a problem but does not specify how to handle it.',
      3: 'Knows to report the problem.',
      4: 'Clearly knows when to escalate or trigger ethical protocols.',
      5: 'Clearly defines escalation boundaries and demonstrates high compliance and ethical judgment.'
    }
  },

  // 8. Validation / Measurement
  validationVerification: {
    name: 'Validation / Measurement',
    levels: {
      1: 'Completely fails to mention post-action validation.',
      2: 'Briefly mentions checking (e.g., "I will test it").',
      3: 'Mentions basic checks without clear metrics.',
      4: 'Proposes specific validation methods or testing plans.',
      5: 'Establishes quantitative metrics (KPIs) or rigorous closed-loop validation plans.'
    }
  },
  verification: 'validationVerification', measurement: 'validationVerification', validation: 'validationVerification', feedbackValidation: 'validationVerification',

  // 9. Feedback / Iteration / Adaptation
  feedbackIteration: {
    name: 'Feedback / Iteration / Adaptation',
    levels: {
      1: 'Refuses to change or fails to mention adjustments.',
      2: 'Passively accepts feedback.',
      3: 'Mentions modifying based on feedback.',
      4: 'Proposes specific steps to collect feedback and iterate.',
      5: 'Demonstrates high agility, systematically translating feedback into iterative design.'
    }
  },

  // 10. Communication / Stakeholder Approach
  approachCommunication: {
    name: 'Communication / Stakeholder Approach',
    levels: {
      1: 'One-way communication or no communication.',
      2: 'Will notify the other party.',
      3: 'Engages in basic two-way information transfer.',
      4: 'Consciously manages stakeholder expectations.',
      5: 'Demonstrates high EQ stakeholder management and two-way expectation alignment.'
    }
  },
  application: 'approachCommunication', // From knowledge_explanation

  // 11. Outcome / Value
  outcomeValue: {
    name: 'Outcome / Value',
    levels: {
      1: 'Completely fails to mention expected outcomes.',
      2: 'Briefly claims the result will be good.',
      3: 'Mentions specific outcomes but lacks value linkage.',
      4: 'Proposes clear, specific, and reasonable expected outcomes, value, or learnings.',
      5: 'Perfectly aligns the outcome with the initial goal and extracts reusable value or learnings.'
    }
  },
  expectedOutcome: 'outcomeValue', outcome: 'outcomeValue', outcomeLearning: 'outcomeValue',

  // 12. Credential Verification
  evidence: {
    name: 'Credential Evidence & Validity',
    levels: {
      1: 'Does not hold the credential or it is expired with no renewal plan.',
      2: 'Holds an expired credential but has a clear renewal application submitted.',
      3: 'Is preparing to obtain it, or holds it but it is expiring very soon.',
      4: 'Holds a valid credential but documentation is pending final clearance.',
      5: 'Confirmed holding a fully valid and active credential.'
    }
  },
  validity: 'evidence',
  scope: {
    name: 'Credential Scope & Conditions',
    levels: {
      1: 'Completely unaware of practice scope or restrictions.',
      2: 'Vaguely aware of scope but cannot name specific boundaries.',
      3: 'Knows basic scope but is unclear on special restrictions (e.g., supervised practice).',
      4: 'Clearly explains practice scope and most restrictions.',
      5: 'Precisely explains exact practice scope and any attached conditions or restrictions.'
    }
  },
  conditions: 'scope',

  // 13. Conversation
  relevance: {
    name: 'Conversation Relevance',
    levels: {
      1: 'Completely irrelevant or off-topic.',
      2: 'Tangentially related but mostly off-topic.',
      3: 'Basically answers the question but includes unnecessary tangential content.',
      4: 'Directly and specifically answers the interviewer\'s question.',
      5: 'Precisely on-topic and smoothly guides the conversation forward.'
    }
  },
  clarity: {
    name: 'Conversation Clarity',
    levels: {
      1: 'Incoherent and impossible to understand.',
      2: 'Extremely fragmented expression or filled with filler words.',
      3: 'Gist is understandable but sentence structure is messy or stuttered.',
      4: 'Fluent sentences and coherent logic.',
      5: 'Extremely organized communication, refined and professional expression.'
    }
  },
  completion: {
    name: 'Conversation Completion',
    levels: {
      1: 'Sentence unfinished or cut off directly.',
      2: 'Uses only single words or extremely short dismissive phrases (e.g., "Yes", "Okay").',
      3: 'Complete answer but lacks necessary context or is rigidly delivered.',
      4: 'Provides a complete answer and appropriate confirmation.',
      5: 'Complete answer and proactively confirms if the interviewer needs more information, showing high EQ.'
    }
  },

  // 14. Self Intro
  background: {
    name: 'Self Intro Background',
    levels: {
      1: 'No mention.',
      2: 'Only provides name or extremely brief single-word descriptions.',
      3: 'Mentions education or current role but lacks depth of experience.',
      4: 'Clearly describes core educational and professional background.',
      5: 'Background description is highly organized and directly highlights strongest professional advantages.'
    }
  },
  roleRelevance: {
    name: 'Self Intro Role Relevance',
    levels: {
      1: 'Completely unconnected to the applied role.',
      2: 'Mentions "I want to apply for this role" with no further explanation.',
      3: 'Vaguely mentions background is related to the role.',
      4: 'Explicitly explains how past experience matches the core requirements of this role.',
      5: 'Demonstrates deep understanding of the role\'s core challenges and precisely explains how their background directly solves them.'
    }
  },
  candidateEvidence: { // For Motivation, maps similarly to Self Intro evidence
    name: 'Self Intro / Motivation Evidence',
    levels: {
      1: 'No mention.',
      2: 'Only claims "I have a lot of experience".',
      3: 'Mentions participating in projects or work but no concrete results.',
      4: 'Cites specific projects, achievements, or technologies used as evidence.',
      5: 'Evidence includes clear quantitative data or highly persuasive qualitative impact.'
    }
  },
  specificity: 'candidateEvidence', // From motivation

  // 15. Motivation
  companyReason: {
    name: 'Company Reason',
    levels: {
      1: 'No mention.',
      2: 'Generic superficial praise (e.g., "You are a good company").',
      3: 'Mentions a specific product or news but does not explain why it attracts them.',
      4: 'Cites specific company characteristics and clearly links them to personal values or goals.',
      5: 'Demonstrates deep research (business model, culture) and proposes a win-win perspective.'
    }
  },
  roleReason: {
    name: 'Role Reason',
    levels: {
      1: 'No mention.',
      2: '"I want to find a job" or "It looks interesting".',
      3: 'Mentions the role\'s responsibilities but lacks personal passion linkage.',
      4: 'Clearly explains which specific responsibilities of the role fit their career plan.',
      5: 'Demonstrates deep understanding of the role\'s challenges and a strong desire to solve them.'
    }
  }
};

const resolveBars = (key) => {
  let target = BARS_DEFINITIONS[key];
  if (typeof target === 'string') {
    target = BARS_DEFINITIONS[target]; // follow reference
  }
  return target || {
    name: key,
    levels: {
      1: 'No evidence provided.',
      2: 'Vague evidence.',
      3: 'Basic evidence.',
      4: 'Clear evidence.',
      5: 'Exceptional evidence.'
    }
  };
};

// --- 2. Prompt Builder ---

const SYSTEM_PROMPT = `<instructions>
You are an expert HR Interview Evaluator. Your core role is to objectively map the candidate's spoken answer to the exact Behavioral Anchored Rating Scales (BARS) provided. Your operational boundary is strictly limited to evaluation; do not act as an interviewer or coach.
</instructions>

<examples>
Here is a few-shot example of how to reason and output:
<example>
  <question>How do you handle risks?</question>
  <answer>I usually just try to be careful.</answer>
  <bars dimension="Risk Identification">
    L1: No awareness -> L2: Vague/careful -> L3: Surface -> L4: Specific -> L5: Systemic.
  </bars>
  <expected_output>
    [ { "dimension": "Risk Identification", "level": 2, "reason": "The candidate only vaguely mentions 'being careful' without identifying any specific surface or systemic risks, mapping exactly to L2." } ]
  </expected_output>
</example>
</examples>

<tools>
You must output your response adhering strictly to the JSON array schema provided. You do not have access to external APIs.
</tools>

<guardrails>
1. HARD CONSTRAINT: Do not hallucinate or invent criteria outside of the provided BARS.
2. HARD CONSTRAINT: If the answer does not address the dimension at all, strictly assign Level 1.
3. FORMATTING RULE: Output ONLY a valid JSON array matching the requested schema. No markdown fences (e.g., \`\`\`json), no conversational filler.
4. SAFETY VALIDATION: The \`level\` MUST be an integer strictly between 1 and 5.
</guardrails>`;

const buildUserPrompt = (question, answer, context, dimensionsToEvaluate) => {
  const barsText = dimensionsToEvaluate.map(key => {
    const bars = resolveBars(key);
    return `[Dimension Key: ${key} - ${bars.name}]
L1: ${bars.levels[1]}
L2: ${bars.levels[2]}
L3: ${bars.levels[3]}
L4: ${bars.levels[4]}
L5: ${bars.levels[5]}`;
  }).join('\n\n');

  const roleTitle = context.targetRole || context.jobTitle || context.roleTitle || 'General';

  return `<memory>
Role applied for: ${roleTitle}
</memory>

<knowledge>
  <interview_question>${question}</interview_question>
  <candidate_answer>${answer}</candidate_answer>
  
  <bars_definitions>
${barsText}
  </bars_definitions>
</knowledge>`;
};

const extractJsonObject = (text = '') => {
  const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = String(text || '').indexOf('[');
  const end = String(text || '').lastIndexOf(']');
  if (start >= 0 && end > start) return String(text).slice(start, end + 1);
  return String(text || '').trim();
};

const round = (value = 0) => Number(Number(value || 0).toFixed(2));

// --- 3. Main Export ---

export const evaluateWithUniversalLlm = async ({ question = '', answer = '', context = {}, dimensionsArray = [], frameworkLabel = 'Evaluation' } = {}) => {
  // Edge case: empty string
  if (!String(answer || '').trim()) {
    const dimensions = dimensionsArray.map((def) => {
      const key = typeof def === 'string' ? def : def.key;
      const label = typeof def === 'string' ? key : def.label;
      return {
        key,
        label,
        status: 'missing',
        score: 0,
        level: 1,
        weight: 10,
        reason: 'Answer is entirely empty.',
      };
    });
    return {
      dimensions,
      mainGapKey: dimensions[0]?.key || '',
      mainMissingElement: dimensions[0]?.key || '',
      summary: `This evaluates the answer against the ${frameworkLabel} framework.`,
      scoreReason: 'No evidence provided.',
      totalScore: 0,
      maxScore: dimensions.length * 10,
      normalizedScore: 0,
    };
  }

  const keysToEvaluate = dimensionsArray.map(d => typeof d === 'string' ? d : d.key);
  const userPrompt = buildUserPrompt(question, answer, context, keysToEvaluate);
  
  let parsed = [];
  try {
    const response = await callDeepSeek(userPrompt, SYSTEM_PROMPT, {
      usageMetadata: { stage: 'evaluation', operation: 'llm_json', feature: 'universal_llm_scoring' },
    });
    const parsedData = JSON.parse(extractJsonObject(response.content));
    parsed = Array.isArray(parsedData) ? parsedData : [parsedData];
  } catch (error) {
    console.error('Universal LLM Error:', error);
    // Fallback: array is empty, which will trigger L1 defaults below
  }

  const dimensions = dimensionsArray.map((def) => {
    const key = typeof def === 'string' ? def : def.key;
    const label = typeof def === 'string' ? key : def.label;
    
    const evaluated = parsed.find(item => item.dimension === key || item.dimension === resolveBars(key).name) || {};
    const level = Number(evaluated.level) || 1;
    const safeLevel = Math.max(1, Math.min(5, level));
    
    // score_math_contract: L1=0, L2=0.25, L3=0.5, L4=0.75, L5=1.0
    const scoreMultiplier = (safeLevel - 1) * 0.25;
    const weight = 10; // Standard dimension weight
    const score = scoreMultiplier * weight;

    return {
      key,
      label,
      status: safeLevel >= 4 ? 'clear' : safeLevel >= 2 ? 'partial' : 'missing',
      score,
      level: safeLevel,
      weight,
      reason: evaluated.reason || 'Evaluation failed or timeout. Defaulting to missing evidence.',
    };
  });

  const applicable = dimensions.filter((item) => item.status !== 'not_applicable');
  const totalScore = round(applicable.reduce((sum, item) => sum + item.score, 0));
  const maxScore = applicable.length * 10;
  const normalizedScore = maxScore ? round((totalScore / maxScore) * 10) : 0;

  const mainGap = dimensions
    .filter((item) => item.status !== 'not_applicable')
    .sort((left, right) => left.score - right.score)[0];

  return {
    dimensions,
    mainGapKey: mainGap?.key || '',
    mainMissingElement: mainGap?.key || '',
    summary: `This evaluates the answer against the ${frameworkLabel} framework using universal LLM semantics.`,
    scoreReason: mainGap?.reason || 'No applicable framework dimensions were available.',
    totalScore,
    maxScore,
    normalizedScore,
  };
};
