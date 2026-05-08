/**
 * File responsibility: Deterministic New Zealand workplace communication coaching.
 * Main responsibilities:
 * - Score transcript evidence against observable NZ workplace interview behaviours.
 * - Keep cultural coaching focused on communication behaviours, not identity.
 * - Produce grounded strengths, gaps, and rewrite guidance for reports.
 */

const DIMENSIONS = [
  {
    id: 'friendly_professional',
    label: 'Friendly professional communication',
    positive: [
      /\b(thanks|thank you|appreciate|happy to|sure|good question)\b/i,
      /\b(clear|brief|concise|explain|summaris[ez]e|walk through)\b/i,
    ],
    gap: [
      /\b(whatever|idk|nah|obviously|just simple)\b/i,
    ],
    strength: 'Your tone sounded approachable while still staying work-focused.',
    gapText: 'Make the answer sound more approachable and professional instead of abrupt or overly casual.',
  },
  {
    id: 'teamwork',
    label: 'Teamwork and shared outcomes',
    positive: [
      /\b(team|teammate|colleague|stakeholder|designer|product owner|manager)\b/i,
      /\b(collaborat|worked with|aligned|shared goal|reviewed with|checked with|paired|handoff)\b/i,
    ],
    gap: [
      /\b(i did everything|all by myself|full system myself|without anyone|only me)\b/i,
    ],
    strength: 'You showed that your work connected to team goals and other people.',
    gapText: 'Balance your personal contribution with how you worked with others and supported a shared result.',
  },
  {
    id: 'humility_confidence',
    label: 'Humility with confidence',
    positive: [
      /\b(i led|i owned|i was responsible|my role was|i contributed|i helped)\b/i,
      /\b(result|outcome|improved|reduced|increased|measured|validated|evidence)\b/i,
    ],
    gap: [
      /\b(best|perfect|expert in everything|obvious|easy for me|single-handedly)\b/i,
      /\b(i did everything|all by myself|full system myself|only me)\b/i,
    ],
    strength: 'You showed confidence through evidence rather than unsupported self-promotion.',
    gapText: 'Use evidence to show confidence, and avoid wording that sounds like over-claiming or solo heroics.',
  },
  {
    id: 'initiative',
    label: 'Initiative',
    positive: [
      /\b(identified|noticed|proposed|suggested|initiated|took initiative|improved|automated|started|created)\b/i,
      /\b(proactively|without being asked|picked up|took ownership)\b/i,
    ],
    gap: [],
    strength: 'You gave evidence of noticing a need and acting on it.',
    gapText: 'Add one moment where you noticed a problem, proposed a next step, or took ownership without waiting for detailed instructions.',
  },
  {
    id: 'open_communication',
    label: 'Open communication',
    positive: [
      /\b(discussed|asked|clarified|explained|documented|feedback|review|checked|aligned|transparent)\b/i,
      /\b(make sure|made sure|shared context|kept .* informed)\b/i,
    ],
    gap: [],
    strength: 'You showed a willingness to communicate clearly and check understanding.',
    gapText: 'Show how you communicated decisions, asked for feedback, or clarified expectations.',
  },
  {
    id: 'manaakitanga',
    label: 'Care and respect for others',
    positive: [
      /\b(support|helped|mentor|onboard|respect|care|user|customer|accessible|inclusive)\b/i,
      /\b(made .* easier|reduced friction|unblocked|listened)\b/i,
    ],
    gap: [],
    strength: 'You showed care for users, teammates, or stakeholders through practical support.',
    gapText: 'Add how your actions supported another person, user, teammate, or stakeholder respectfully.',
  },
  {
    id: 'whanaungatanga',
    label: 'Relationship building',
    positive: [
      /\b(trust|relationship|rapport|belonging|stakeholder|shared understanding|shared goal)\b/i,
      /\b(built trust|kept .* aligned|worked closely|regular check-ins)\b/i,
    ],
    gap: [],
    strength: 'You showed relationship-building through trust, alignment, or reciprocal collaboration.',
    gapText: 'Add how you built trust or kept relationships strong while solving the problem.',
  },
  {
    id: 'wellbeing_awareness',
    label: 'Wellbeing and sustainable work',
    positive: [
      /\b(prioritis[ez]ed|scope|sustainable|workload|balance|burnout|manageable|handover|planned)\b/i,
      /\b(deprioritis[ez]ed|timebox|realistic deadline|shared the load)\b/i,
    ],
    gap: [
      /\b(24\/7|all night every night|never sleep|work nonstop|always overtime)\b/i,
    ],
    strength: 'You showed awareness of sustainable delivery and realistic workload management.',
    gapText: 'Avoid presenting constant overwork as a strength; show how you deliver sustainably and manage trade-offs.',
  },
];

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const candidateTurns = (transcript = []) => ensureArray(transcript)
  .filter((turn) => String(turn?.role || '').toLowerCase() === 'user')
  .map((turn) => normalizeText(turn.text))
  .filter(Boolean);

const splitSentences = (turns = []) => turns
  .flatMap((text) => text.split(/(?<=[.!?])\s+|\n+/))
  .map(normalizeText)
  .filter(Boolean);

const firstMatch = (sentences = [], patterns = []) => sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence))) || '';

const countMatches = (text = '', patterns = []) => patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);

const clampScore = (value) => Math.max(0, Math.min(10, Number(value.toFixed(1))));

const buildDimensionScore = ({ dimension, transcriptText, sentences }) => {
  const positiveCount = countMatches(transcriptText, dimension.positive);
  const gapCount = countMatches(transcriptText, dimension.gap);
  const evidenceQuote = firstMatch(sentences, dimension.positive);
  const riskQuote = firstMatch(sentences, dimension.gap);
  const score = clampScore(4.5 + Math.min(3.5, positiveCount * 1.4) - Math.min(3, gapCount * 1.8));

  return {
    id: dimension.id,
    label: dimension.label,
    score,
    observed: positiveCount > 0,
    riskDetected: gapCount > 0,
    evidenceQuote,
    riskQuote,
    feedback: positiveCount > 0 && gapCount === 0 ? dimension.strength : dimension.gapText,
  };
};

const buildSummary = ({ score, strengths, gaps }) => {
  if (score >= 8) return 'Your answers showed strong NZ workplace communication signals: clear evidence, collaboration, and respectful professional tone.';
  if (score >= 6.5) return 'Your answers showed useful NZ workplace fit signals, with room to make collaboration and relationship-building more explicit.';
  if (strengths.length > 0) return 'Your answers had some NZ workplace fit signals, but several responses would land better with clearer teamwork, humility, and communication evidence.';
  if (gaps.length > 0) return 'The transcript did not yet show enough observable NZ workplace communication evidence, so the coaching should be treated as preparation guidance.';
  return 'There was not enough candidate transcript evidence to assess NZ workplace communication fit.';
};

const pickSuggestedRewrite = ({ sentences, dimensionScores }) => {
  const risk = dimensionScores.find((item) => item.riskQuote);
  if (risk?.id === 'teamwork' || risk?.id === 'humility_confidence') {
    return {
      weak: risk.riskQuote,
      better: 'I led the main implementation, and I kept the team aligned through design checks and review so the final solution matched our shared goal.',
      reason: 'This keeps ownership clear while showing collaboration, humility, and shared outcomes.',
    };
  }

  const genericTeamwork = sentences.find((sentence) => /\b(good team player|work well in teams|communication is important)\b/i.test(sentence));
  if (genericTeamwork) {
    return {
      weak: genericTeamwork,
      better: 'When our team hit a blocker, I clarified the issue, coordinated the next step with teammates, and helped us reach a shared decision.',
      reason: 'This turns a broad claim into a concrete teamwork and communication example.',
    };
  }

  const firstCandidateSentence = sentences[0] || '';
  return {
    weak: firstCandidateSentence,
    better: firstCandidateSentence
      ? `${firstCandidateSentence} I would also add who I worked with, how I communicated the decision, and what result it created for the team or user.`
      : '',
    reason: 'NZ workplace interview answers usually land better when they connect personal action to team, user, or stakeholder impact.',
  };
};

export const buildNzWorkplaceFit = ({ session = {}, transcript = null } = {}) => {
  const enabled = Boolean(session?.settings?.enableNZCultureFit);
  if (!enabled) {
    return {
      enabled: false,
      score: null,
      summary: 'NZ workplace communication coaching was not enabled for this session.',
      dimensionScores: [],
      strengths: [],
      gaps: [],
      evidence: [],
      suggestedRewrite: null,
    };
  }

  const turns = candidateTurns(transcript || session.transcript || []);
  const sentences = splitSentences(turns);
  const transcriptText = turns.join(' ');
  const tokenCount = tokenize(transcriptText).length;

  if (tokenCount < 8) {
    return {
      enabled: true,
      score: 0,
      summary: 'There was not enough candidate transcript evidence to assess NZ workplace communication fit.',
      dimensionScores: DIMENSIONS.map((dimension) => ({
        id: dimension.id,
        label: dimension.label,
        score: 0,
        observed: false,
        riskDetected: false,
        evidenceQuote: '',
        riskQuote: '',
        feedback: dimension.gapText,
      })),
      strengths: [],
      gaps: ['Give at least one specific example with context, action, collaboration, and result.'],
      evidence: [],
      suggestedRewrite: null,
    };
  }

  const dimensionScores = DIMENSIONS.map((dimension) => buildDimensionScore({ dimension, transcriptText, sentences }));
  const observedScores = dimensionScores.filter((item) => item.observed || item.riskDetected);
  const denominator = observedScores.length || dimensionScores.length;
  const score = clampScore((observedScores.length ? observedScores : dimensionScores).reduce((sum, item) => sum + item.score, 0) / denominator);
  const strengths = dimensionScores
    .filter((item) => item.observed && !item.riskDetected && item.score >= 6)
    .slice(0, 4)
    .map((item) => item.feedback);
  const gaps = dimensionScores
    .filter((item) => item.riskDetected || (!item.observed && ['teamwork', 'humility_confidence', 'open_communication'].includes(item.id)))
    .slice(0, 4)
    .map((item) => item.feedback);
  const evidence = dimensionScores
    .filter((item) => item.evidenceQuote || item.riskQuote)
    .slice(0, 6)
    .map((item) => ({
      dimension: item.label,
      quote: item.riskQuote || item.evidenceQuote,
      signal: item.riskDetected ? 'risk' : 'strength',
    }));

  return {
    enabled: true,
    score,
    summary: buildSummary({ score, strengths, gaps }),
    dimensionScores,
    strengths,
    gaps,
    evidence,
    suggestedRewrite: pickSuggestedRewrite({ sentences, dimensionScores }),
  };
};

export default buildNzWorkplaceFit;
