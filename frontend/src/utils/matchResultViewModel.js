import { isJobDescriptionSectionHeading } from './jobDescriptionSectionHeadingGuard.js';

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const toPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric <= 1 ? numeric * 100 : numeric));
};

const sentenceCase = (value = '') => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^./, (letter) => letter.toUpperCase());

const firstText = (items = []) => items.find((item) => typeof item === 'string' && item.trim()) || '';

const getLabel = (item) => (typeof item === 'string' ? item : item?.label || item?.title || '').trim();

const getEvidence = (item = {}) => {
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  return firstText(evidence.map((entry) => (typeof entry === 'string' ? entry : entry?.text || entry?.label || '')));
};

const getDetail = (item = {}) => {
  const detail = String(item.detail || item.notes || '').trim();
  if (!detail) return '';
  return detail.split(';')
    .map((part) => part.trim())
    .filter((part) => !/^(section|capabilities|evidenceStrength|missingEvidence|interviewProbe)=/i.test(part))
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractEvidenceStrength = (item = {}) => {
  const match = String(item.notes || item.detail || '').match(/evidenceStrength=([^;]+)/i);
  return match?.[1]?.trim() || '';
};

const extractNoteField = (item = {}, field) => {
  const match = String(item.notes || item.detail || '').match(new RegExp(`${field}=([^;]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

const joinLabels = (items = [], limit = 2) => items
  .map(getLabel)
  .filter(Boolean)
  .slice(0, limit)
  .join(', ');

const shortenRequirementLabel = (label = '') => {
  const text = String(label || '').replace(/\s+/g, ' ').trim();

  if (/gaming scenarios|npc|procedural content|dynamic narratives|player behavior/i.test(text)) {
    return 'Gaming AI integration';
  }

  if (/agent principles|agent frameworks|ai agent expertise/i.test(text)) {
    return 'AI agent principles and frameworks';
  }

  if (/product mindset|analytical skills/i.test(text)) {
    return 'Product mindset and analytical skills';
  }

  if (/deployment challenges|deploy/i.test(text) && /agent|ai/i.test(text)) {
    return 'AI agent deployment readiness';
  }

  if (text.length <= 90) return text;
  return `${text.slice(0, 87).trim()}...`;
};

const normalizeLabelKey = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const STRICT_TECH_PATTERNS = {
  aws: /\b(aws|amazon web services|ec2|lambda|s3|rds|ecs|eks|cloudwatch|iam)\b/i,
  redis: /\bredis\b/i,
  elasticsearch: /\belasticsearch\b/i,
  kafka: /\b(kafka|distributed queue|distributed queueing|message queue|event streaming)\b/i,
  typescript: /\btypescript\b/i,
  nextjs: /\b(next\.js|nextjs)\b/i,
  vue: /\b(vue|vue\.js)\b/i,
  python: /\bpython\b/i,
  postgres: /\b(postgresql|postgres)\b/i,
};

const getStrictTechKeys = (label = '') => Object.entries(STRICT_TECH_PATTERNS)
  .filter(([, pattern]) => pattern.test(label))
  .map(([key]) => key);

const hasStrictTechEvidence = (label = '', evidenceText = '') => {
  const keys = getStrictTechKeys(label);
  if (!keys.length) return true;
  return keys.every((key) => STRICT_TECH_PATTERNS[key].test(String(evidenceText || '')));
};

const buildRequirementStatusByLabel = (requirementChecks = []) => {
  const byLabel = new Map();
  requirementChecks.forEach((item) => {
    const label = item.label || '';
    byLabel.set(normalizeLabelKey(label), item);
    byLabel.set(normalizeLabelKey(shortenRequirementLabel(label)), item);
  });
  return byLabel;
};

const summarizeSemanticEvidenceMatches = (matches = []) => {
  const summary = { strong: 0, partial: 0, weak: 0, missing: 0 };
  matches.forEach((item) => {
    const topMatch = (item.matches || [])[0];
    if (!topMatch) {
      summary.missing += 1;
      return;
    }
    const strength = topMatch.evidenceStrength || 'weak';
    if (strength === 'strong') summary.strong += 1;
    else if (strength === 'partial') summary.partial += 1;
    else summary.weak += 1;
  });
  return summary;
};

const filterSemanticEvidenceMatches = (matches = [], requirementChecks = []) => {
  const byLabel = buildRequirementStatusByLabel(requirementChecks);
  return matches
    .map((item) => {
      const label = item.label || '';
      const requirement = byLabel.get(normalizeLabelKey(label)) || byLabel.get(normalizeLabelKey(shortenRequirementLabel(label)));
      const filteredMatches = (item.matches || []).filter((match) => {
        if (!hasStrictTechEvidence(label, match.text || '')) return false;
        if (requirement?.status === 'not_met') return false;
        if (requirement?.status && ['partial', 'inferred'].includes(requirement.status) && match.evidenceStrength === 'strong') {
          return false;
        }
        return true;
      });
      return { ...item, matches: filteredMatches };
    })
    .filter((item) => (item.matches || []).length > 0)
    .slice(0, 5);
};

const decisionCopy = {
  strong_match: {
    label: 'Strong match',
    tone: 'success',
    summary: 'Your CV shows strong alignment with this role.',
  },
  moderate_match: {
    label: 'Promising but needs validation',
    tone: 'info',
    summary: 'Your CV shows useful alignment, but some role-critical evidence still needs interview validation.',
  },
  borderline: {
    label: 'Mixed match',
    tone: 'warning',
    summary: 'Your CV shows partial fit, but the role-critical evidence is not yet consistent.',
  },
  weak_match: {
    label: 'Weak match',
    tone: 'warning',
    summary: 'Your CV does not yet show enough clear evidence for this role.',
  },
  not_qualified: {
    label: 'Not enough CV evidence yet',
    tone: 'danger',
    summary: 'One or more hard requirements are not clearly supported by the CV evidence.',
  },
  manual_review: {
    label: 'Needs review',
    tone: 'warning',
    summary: 'The match needs manual review before treating it as final.',
  },
};

const scoreTone = (score) => {
  if (score >= 80) return 'Strong';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Partial';
  return 'Weak';
};

const scoreReason = {
  macro: {
    title: 'Responsibility fit',
    description: 'How closely the CV background matches the role level, responsibilities, and work context.',
  },
  micro: {
    title: 'Skill and tool fit',
    description: 'How clearly the CV supports the JD skills with specific evidence.',
  },
  requirements: {
    title: 'Must-have evidence',
    description: 'Coverage of required qualifications, hard requirements, and important role criteria.',
  },
};

const scoreExplanationByBand = {
  macro: {
    Strong: 'The CV background strongly matches the role context and responsibilities.',
    Good: 'The CV has relevant role context, with a few details to validate.',
    Partial: 'The CV shows some related background, but direct role context is still thin.',
    Weak: 'The CV does not show enough direct role context yet.',
  },
  micro: {
    Strong: 'Key JD skills are clearly backed by CV evidence.',
    Good: 'Several JD skills are supported, but some skill evidence could be sharper.',
    Partial: 'Some skill overlap exists, but the CV needs more specific examples.',
    Weak: 'The main JD skills are not clearly supported by the CV.',
  },
  requirements: {
    Strong: 'Must-have requirements are mostly supported by the CV.',
    Good: 'Most important requirements have at least usable support.',
    Partial: 'Some must-have requirements are only partial or inferred.',
    Weak: 'Important requirements are missing or weakly supported.',
  },
};

const evidenceStrengthOrder = { missing: 0, weak: 1, partial: 2, strong: 3 };
const evidenceStrengthByOrder = Object.fromEntries(Object.entries(evidenceStrengthOrder).map(([key, value]) => [value, key]));
const evidenceStrengthCapByStatus = {
  met: 'strong',
  partial: 'partial',
  inferred: 'weak',
  not_met: 'missing',
};

const capEvidenceStrengthForStatus = (strength = '', status = '') => {
  if (!strength) return '';
  const cap = evidenceStrengthCapByStatus[status] || 'missing';
  const cappedOrder = Math.min(evidenceStrengthOrder[strength] ?? 0, evidenceStrengthOrder[cap] ?? 0);
  return evidenceStrengthByOrder[cappedOrder] || 'missing';
};

const isLowValueEvidenceText = (value = '') => (
  /^Matched in (experience|keyCompetencies|personalStatement): (engineer|engineering|ai|focused|teams?|workflows?|value|off)(?:,\s*(engineer|engineering|ai|focused|teams?|workflows?|value|off))*$/i.test(String(value || '').trim())
  || /^Capability match:/i.test(String(value || '').trim())
);

const sanitizeRequirementEvidence = ({ status = '', evidence = '' } = {}) => {
  if (status === 'not_met' && isLowValueEvidenceText(evidence)) return '';
  return evidence;
};

const sanitizeLimitation = (value = '') => String(value || '')
  .replace(/The available evidence is below the grounded match threshold\./i, 'The CV does not show enough direct proof for this focus area.')
  .replace(/role intent/gi, 'focus area')
  .trim();

const statusLabels = {
  met: { label: 'Matched', tone: 'success', reason: 'Supported by CV evidence.' },
  partial: { label: 'Partly matched', tone: 'warning', reason: 'Some evidence exists, but it may need stronger proof.' },
  inferred: { label: 'Needs validation', tone: 'warning', reason: 'The match is inferred from adjacent evidence and should be checked in interview.' },
  not_met: { label: 'Missing evidence', tone: 'danger', reason: 'No clear CV evidence was found for this requirement.' },
};

const requirementPriority = (item = {}) => {
  const statusRank = { not_met: 0, inferred: 1, partial: 2, met: 3 }[item.status] ?? 4;
  const typeRank = item.type === 'hard' ? 0 : 1;
  const importanceRank = { high: 0, medium: 1, low: 2 }[item.importance] ?? 1;
  return statusRank * 10 + typeRank * 3 + importanceRank;
};

const buildSummary = ({ decision, strengths, gaps, risks, fallbackSummary }) => {
  const matched = joinLabels(strengths, 2);
  const gap = joinLabels(risks, 1) || joinLabels(gaps, 1);

  if (matched && gap) {
    return `Strongest signals: ${matched}. Main area to validate: ${gap}.`;
  }

  if (matched) {
    return `Strongest signals: ${matched}. No major hard requirement risk was highlighted.`;
  }

  if (gap) {
    return `Main area to validate: ${gap}. The CV needs clearer role-fit evidence before this match feels strong.`;
  }

  return fallbackSummary || decision.summary;
};

const buildEvidenceItem = (item, fallbackDetail) => ({
  id: item?.id || getLabel(item),
  label: getLabel(item),
  detail: getDetail(item) || fallbackDetail,
  evidence: getEvidence(item),
});

const buildRoleEvidenceGroups = (roleEvidenceMap = {}) => {
  const groups = { direct: [], adjacent: [], weak: [], gap: [] };
  (roleEvidenceMap.items || []).forEach((item) => {
    if (isJobDescriptionSectionHeading(item.roleIntent || item.label)) return;
    const classification = groups[item.classification] ? item.classification : 'gap';
    const sourceEvidence = (item.sourceEvidence || [])[0] || {};
    groups[classification].push({
      id: item.roleIntentId || item.id || item.roleIntent,
      label: item.roleIntent || item.label || 'Role intent',
      priority: item.priority || 'medium',
      classification,
      score: clampScore(item.score),
      evidence: sourceEvidence.text || '',
      sourceSection: sourceEvidence.sourceTrace?.section || '',
      limitation: sanitizeLimitation(item.limitation || ''),
    });
  });
  return groups;
};

const buildRoleIntentCoverageFromGroups = (groups = {}) => {
  const highPriorityItems = Object.values(groups)
    .flat()
    .filter((item) => item.priority === 'high');
  return {
    highPriorityTotal: highPriorityItems.length,
    strong: highPriorityItems.filter((item) => item.classification === 'direct').length,
    partial: highPriorityItems.filter((item) => ['adjacent', 'weak'].includes(item.classification)).length,
    missing: highPriorityItems.filter((item) => item.classification === 'gap').length,
  };
};

const buildScoreExplanation = ({ key, label, strengths, gaps, risks, requirementChecks }) => {
  if (key === 'macro') {
    const gap = joinLabels(gaps, 1) || joinLabels(risks, 1);
    return gap
      ? `${scoreExplanationByBand[key][label]} Main role-fit concern: ${gap}.`
      : scoreExplanationByBand[key][label];
  }

  if (key === 'micro') {
    const matched = joinLabels(strengths, 1);
    return matched
      ? `${scoreExplanationByBand[key][label]} Clearest skill signal: ${matched}.`
      : scoreExplanationByBand[key][label];
  }

  const missingCount = requirementChecks.filter((item) => item.status === 'not_met').length;
  const partialCount = requirementChecks.filter((item) => ['partial', 'inferred'].includes(item.status)).length;
  if (missingCount || partialCount) {
    return `${scoreExplanationByBand[key][label]} ${missingCount} missing and ${partialCount} partial requirement checks need attention.`;
  }
  return scoreExplanationByBand[key][label];
};

export const buildMatchResultViewModel = (analysisResult = {}, matchRate = 0) => {
  const scoreBreakdown = analysisResult?.scoreBreakdown || {};
  const explanation = analysisResult?.explanation || {};
  const strengths = Array.isArray(explanation.strengths) ? explanation.strengths : [];
  const gaps = Array.isArray(explanation.gaps) ? explanation.gaps : [];
  const risks = Array.isArray(explanation.risks) ? explanation.risks : [];
  const rawRequirementChecks = Array.isArray(analysisResult?.requirementChecks) ? analysisResult.requirementChecks : [];
  const matchingDetails = analysisResult?.matchingDetails || {};
  const decisionKey = analysisResult?.decision?.label || 'manual_review';
  const decision = decisionCopy[decisionKey] || {
    label: sentenceCase(decisionKey || 'manual_review'),
    tone: 'warning',
    summary: 'The match needs manual review before treating it as final.',
  };
  const overallScore = clampScore(analysisResult?.overallScore ?? matchRate);
  const filteredSemanticEvidenceMatches = Array.isArray(matchingDetails.semanticEvidenceMatches)
    ? filterSemanticEvidenceMatches(matchingDetails.semanticEvidenceMatches, rawRequirementChecks)
    : [];
  const roleEvidenceMap = analysisResult?.roleEvidenceMap || matchingDetails.roleEvidenceMap || {};
  const roleEvidenceGroups = buildRoleEvidenceGroups(roleEvidenceMap);

  const scoreCards = Object.entries(scoreReason).map(([key, copy]) => {
    const score = clampScore(scoreBreakdown[key]);
    const label = scoreTone(score);
    return {
      key,
      ...copy,
      score,
      label,
      explanation: buildScoreExplanation({ key, label, strengths, gaps, risks, requirementChecks: rawRequirementChecks }),
    };
  });

  const requirementChecks = rawRequirementChecks
    .slice()
    .sort((left, right) => requirementPriority(left) - requirementPriority(right))
    .map((item) => {
      const status = statusLabels[item.status] || statusLabels.not_met;
      const originalLabel = item.label || 'Requirement';
      const label = shortenRequirementLabel(originalLabel);
      const evidence = getEvidence(item);
      return {
        id: item.id || originalLabel,
        label,
        originalLabel,
        status: status.label,
        tone: status.tone,
        meta: `${sentenceCase(item.type || 'requirement')} · ${sentenceCase(item.importance || 'medium')} importance`,
        reason: getDetail(item) || status.reason,
        evidence: sanitizeRequirementEvidence({ status: item.status, evidence }),
        evidenceStrength: capEvidenceStrengthForStatus(extractEvidenceStrength(item), item.status),
        missingEvidence: extractNoteField(item, 'missingEvidence'),
        interviewProbe: extractNoteField(item, 'interviewProbe'),
      };
    });

  return {
    decision,
    overallScore,
    confidencePercent: toPercent(analysisResult?.confidence),
    summary: buildSummary({
      decision,
      strengths,
      gaps,
      risks,
      fallbackSummary: explanation.summary || analysisResult?.planPreview || '',
    }),
    scoreCards,
    matchedEvidence: strengths.slice(0, 3).map((item) => buildEvidenceItem(item, 'This is one of the clearest role-fit signals in the CV.')),
    improvementEvidence: [...risks, ...gaps]
      .slice(0, 3)
      .map((item) => buildEvidenceItem(item, 'This is the main area to strengthen or validate in interview.')),
    requirementChecks,
    evidenceStrengthBreakdown: filteredSemanticEvidenceMatches.length
      ? summarizeSemanticEvidenceMatches(filteredSemanticEvidenceMatches)
      : matchingDetails.evidenceStrengthBreakdown || {},
    semanticEvidenceMatches: filteredSemanticEvidenceMatches,
    semanticEvidenceModel: matchingDetails.semanticEvidenceModel || null,
    roleIntentCoverage: buildRoleIntentCoverageFromGroups(roleEvidenceGroups),
    roleEvidenceGroups,
  };
};
