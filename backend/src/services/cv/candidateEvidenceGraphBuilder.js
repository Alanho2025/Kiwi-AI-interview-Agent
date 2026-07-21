const clampPercentage = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const resolveCandidateEvidenceSource = (sourceType = '') => {
  if (sourceType.startsWith('project_')) return 'cv_project';
  if (sourceType === 'experience') return 'cv_work_experience';
  if (sourceType === 'achievement') return 'cv_achievement';
  if (sourceType === 'education') return 'cv_education';
  if (['summary', 'skill', 'key_competency'].includes(sourceType)) return 'cv_capability';
  return 'cv_other';
};

const buildEvidenceTitle = ({ item = {}, text = '', section = '' } = {}) => {
  if (item.projectTitle) return item.projectTitle;
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalizedText) return section ? `${section} evidence` : 'CV evidence';
  return normalizedText.length > 72 ? `${normalizedText.slice(0, 69).trim()}...` : normalizedText;
};

const buildProofAngles = ({ item = {}, text = '', tools = [], responsibilitySignal = false, achievementSignal = false } = {}) => {
  const angles = [];
  if (responsibilitySignal) angles.push('Personal ownership and delivery');
  if (achievementSignal) angles.push('Measurable outcome or impact');
  if (tools.length) angles.push(`Technical/tool fluency: ${tools.slice(0, 3).join(', ')}`);
  if (item.sourceType?.startsWith('project_')) angles.push('Project execution context');
  if (/stakeholder|client|customer|team|cross-functional|presented|communicat/i.test(text)) {
    angles.push('Stakeholder communication context');
  }
  if (!angles.length) angles.push('Supporting capability signal');
  return [...new Set(angles)].slice(0, 4);
};

const buildStrengthSignals = ({ evidenceStrength = 'weak', signals = {}, responsibilitySignal = false, achievementSignal = false, sourceTrace = null } = {}) => {
  const credibilityBase = { strong: 82, partial: 64, weak: 44 }[evidenceStrength] || 40;
  return {
    specificity: clampPercentage(Number(signals.specificity || 0) * 100),
    outcomeEvidence: achievementSignal ? 86 : 24,
    personalOwnership: (signals.personalOwnership || responsibilitySignal) ? 86 : 28,
    credibility: clampPercentage(credibilityBase + (sourceTrace?.chunkId ? 10 : 0)),
  };
};

const buildHowToSayIt = ({ responsibilitySignal = false, achievementSignal = false, tools = [] } = {}) => {
  if (responsibilitySignal && achievementSignal) {
    return ['Use this as a STAR example: name the situation, your action, and the result before adding tools or context.'];
  }
  if (responsibilitySignal) {
    return ['Use this to explain what you owned, what decision you made, and how the work helped the team or user.'];
  }
  if (achievementSignal) {
    return ['Use this to explain the metric or outcome, then add your personal role so the evidence does not sound passive.'];
  }
  if (tools.length) {
    return ['Use this as supporting context after a concrete delivery example, not as the whole answer.'];
  }
  return ['Use this as a supporting signal and pair it with a concrete example when answering role-fit questions.'];
};

const buildAvoidUsingFor = ({ item = {}, text = '', responsibilitySignal = false, achievementSignal = false } = {}) => {
  const limits = [];
  if (!achievementSignal) limits.push('Do not use this as proof of measurable business impact without adding a concrete result.');
  if (!responsibilitySignal) limits.push('Do not use this as proof of personal ownership without naming your role and actions.');
  if (['skill', 'key_competency', 'summary'].includes(item.sourceType)) {
    limits.push('Do not use this as sole proof of delivery without a work, project, or achievement example.');
  }
  if (!/stakeholder|client|customer|team|cross-functional|presented|communicat/i.test(text)) {
    limits.push('Do not use this as proof of stakeholder communication without explicit audience or decision context.');
  }
  if (!limits.length) limits.push('Do not use this as proof beyond the stated scope without adding validated context.');
  return limits.slice(0, 3);
};

const buildFitLimits = ({ item = {}, responsibilitySignal = false, achievementSignal = false } = {}) => {
  const limits = [];
  if (achievementSignal) limits.push('Validate the metric baseline, scope, and timeframe if asked for detail.');
  if (responsibilitySignal) limits.push('Clarify your exact ownership scope before presenting this as role-level proof.');
  if (item.sourceType?.startsWith('project_')) limits.push('Connect the project context to the employer problem instead of only naming the build.');
  if (!achievementSignal) limits.push('Add outcome context before using this to prove impact.');
  if (!limits.length) limits.push('Treat this as supporting context, not standalone proof.');
  return limits.slice(0, 3);
};

export const buildCandidateEvidenceStrategy = ({
  item = {},
  text = '',
  section = '',
  tools = [],
  evidenceStrength = 'weak',
  responsibilitySignal = false,
  achievementSignal = false,
  signals = {},
  sourceTrace = null,
} = {}) => ({
  candidateEvidenceSource: item.candidateEvidenceSource || resolveCandidateEvidenceSource(item.sourceType),
  title: item.title || buildEvidenceTitle({ item, text, section }),
  proofAngles: item.proofAngles || buildProofAngles({ item, text, tools, responsibilitySignal, achievementSignal }),
  strengthSignals: item.strengthSignals || buildStrengthSignals({ evidenceStrength, signals, responsibilitySignal, achievementSignal, sourceTrace }),
  howToSayIt: item.howToSayIt || buildHowToSayIt({ responsibilitySignal, achievementSignal, tools }),
  avoidUsingFor: item.avoidUsingFor || buildAvoidUsingFor({ item, text, responsibilitySignal, achievementSignal }),
  fitLimits: item.fitLimits || buildFitLimits({ item, responsibilitySignal, achievementSignal }),
});

const buildCandidateEvidenceGraphItem = (item = {}) => ({
  evidenceId: item.id,
  source: item.candidateEvidenceSource || resolveCandidateEvidenceSource(item.sourceType),
  title: item.title || buildEvidenceTitle({ item, text: item.text, section: item.section }),
  sourceTrace: item.sourceTrace,
  proofAngles: item.proofAngles || [],
  strengthSignals: item.strengthSignals || {},
  howToSayIt: item.howToSayIt || [],
  avoidUsingFor: item.avoidUsingFor || [],
  fitLimits: item.fitLimits || [],
});

export const buildCandidateEvidenceGraph = (evidenceItems = []) => ({
  schemaVersion: 'candidate_evidence_graph_v2',
  accessScope: 'private',
  evidenceItems: evidenceItems.map(buildCandidateEvidenceGraphItem),
});
