import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';

const HARD_DIRECT_CATEGORIES = new Set(['qualification', 'certification', 'compliance_or_safety', 'availability_or_location']);
const STATUS_ORDER = { not_met: 0, inferred: 1, partial: 2, met: 3 };
const JD_SECTION_HEADING_PATTERN = /^(about the hiring team|about the team|about the role|what the role entails|responsibilities|requirements|qualifications|preferred qualifications|nice to have|benefits|business unit|company overview|about us|hiring team|role entails)$/i;

const normalizeStatus = (value = '') => (
  ['met', 'partial', 'inferred', 'not_met'].includes(value) ? value : 'not_met'
);

const strongestEvidence = (matches = []) => matches[0] || null;

const isWeakSkillOnly = (evidence = []) => (
  evidence.length > 0
  && evidence.every((item) => ['skill', 'key_competency', 'summary'].includes(item.sourceType) || item.evidenceStrength === 'weak')
);

const requirementText = (requirement = {}) => `${requirement.text || requirement.label || ''} ${requirement.category || ''}`;

const isQualificationRequirement = (requirement = {}) => /degree|bachelor|master|qualification|tertiary|diploma/i.test(requirementText(requirement));

const isProfessionalExperienceRequirement = (requirement = {}) => /professional|commercial|years? of experience|work experience/i.test(requirementText(requirement));

const filterEvidenceByRequirementType = ({ requirement = {}, evidence = [] } = {}) => {
  if (isQualificationRequirement(requirement)) {
    const educationEvidence = evidence.filter((item) => ['education', 'certifications'].includes(item.section));
    return educationEvidence.length ? educationEvidence : evidence;
  }

  if (isProfessionalExperienceRequirement(requirement)) {
    const experienceEvidence = evidence.filter((item) => item.section === 'experience');
    return experienceEvidence.length ? experienceEvidence : evidence;
  }

  return evidence;
};

const requiresDirectProof = (requirement = {}) => (
  requirement.mustHave
  && (HARD_DIRECT_CATEGORIES.has(requirement.category) || /registered|license|certificat|degree|qualification|safety|compliance|location|visa|right to work/i.test(requirement.text || requirement.label || ''))
);

const statusFromEvidence = ({ requirement = {}, evidence = [] } = {}) => {
  const best = strongestEvidence(evidence);
  if (!best) return 'not_met';
  if (requiresDirectProof(requirement) && best.evidenceStrength === 'weak') return 'not_met';
  if (isQualificationRequirement(requirement) && !['education', 'certifications'].includes(best.section)) return 'partial';
  if (isProfessionalExperienceRequirement(requirement) && best.section !== 'experience') return 'partial';
  if (isWeakSkillOnly(evidence) && requirement.mustHave) return 'partial';
  if (best.evidenceStrength === 'strong' && Number(best.score || 0) >= 0.66) return 'met';
  if (Number(best.score || 0) >= 0.52) return 'partial';
  if (Number(best.score || 0) >= 0.34) return 'inferred';
  return 'not_met';
};

const evidenceStrengthFromStatus = ({ status, evidence = [] }) => {
  if (status === 'not_met') return 'missing';
  const best = strongestEvidence(evidence);
  if (!best) return 'missing';
  if (status === 'met') return best.evidenceStrength || 'strong';
  if (best.evidenceStrength === 'strong') return 'partial';
  return best.evidenceStrength || 'weak';
};

const buildReason = ({ requirement = {}, status = 'not_met', evidence = [] } = {}) => {
  const best = strongestEvidence(evidence);
  if (!best) return 'No meaningful CV evidence was retrieved for this requirement.';
  if (status === 'met') return `The CV gives direct ${best.evidenceStrength || 'usable'} evidence for this requirement.`;
  if (status === 'partial') {
    if (isQualificationRequirement(requirement) && !['education', 'certifications'].includes(best.section)) {
      return 'The CV has related evidence, but the qualification should be confirmed from the education or certification section.';
    }
    if (isProfessionalExperienceRequirement(requirement) && best.section !== 'experience') {
      return 'The CV has related project evidence, but it does not fully prove professional or commercial experience.';
    }
    if (isWeakSkillOnly(evidence)) return 'The CV mentions related capability, but the evidence is mostly from a skills list or summary rather than applied work.';
    return 'The CV has related evidence, but it does not fully prove the exact requirement.';
  }
  if (status === 'inferred') return 'The CV evidence is adjacent to the requirement, so the match should be validated in interview.';
  if (requiresDirectProof(requirement)) return 'This requirement needs direct qualification, certification, safety, legal, or availability proof and the CV does not show it clearly.';
  return 'The retrieved evidence is too weak to support the requirement.';
};

const buildMissingEvidence = ({ requirement = {}, status = 'not_met' } = {}) => {
  if (status === 'met') return '';
  const rawEvidenceNeeded = String(requirement.evidenceNeeded || '').replace(/\s+/g, ' ').trim();
  if (rawEvidenceNeeded && !JD_SECTION_HEADING_PATTERN.test(rawEvidenceNeeded)) return rawEvidenceNeeded;
  return `The candidate should show direct examples for ${requirement.text || requirement.label}.`;
};

const buildInterviewProbe = ({ requirement = {}, status = 'not_met' } = {}) => {
  const label = requirement.normalizedCapability || requirement.text || requirement.label || 'this requirement';

  if (/gaming|npc|procedural|dynamic narrative|player behavior/i.test(label)) {
    return 'Ask whether the candidate has applied AI agents in gaming, simulation, or interactive user experience contexts.';
  }

  if (/agent framework|agent principles|ai agent/i.test(label)) {
    return 'Ask which AI agent concepts or frameworks the candidate has used, and how they applied them in a project.';
  }

  if (/product mindset|analytical/i.test(label)) {
    return 'Ask for one example where the candidate used analysis to make a product or user experience decision.';
  }

  if (status === 'met') return `Ask for one concrete example that proves depth in ${label}.`;
  return `Ask the candidate for a specific example that shows direct evidence for ${label}.`;
};

const buildHeuristicJudgement = ({ requirement = {}, topEvidence = [] } = {}) => {
  const filteredEvidence = filterEvidenceByRequirementType({ requirement, evidence: topEvidence });
  const status = statusFromEvidence({ requirement, evidence: filteredEvidence });
  return {
    requirementId: requirement.id || normalizeTaxonomyLabel(requirement.text || requirement.label),
    status,
    confidence: status === 'met' ? 0.82 : status === 'partial' ? 0.68 : status === 'inferred' ? 0.52 : 0.42,
    evidenceStrength: evidenceStrengthFromStatus({ status, evidence: filteredEvidence }),
    reason: buildReason({ requirement, status, evidence: filteredEvidence }),
    missingEvidence: buildMissingEvidence({ requirement, status }),
    interviewProbe: buildInterviewProbe({ requirement, status }),
  };
};

const buildPrompt = ({ items = [] }) => `Judge whether CV evidence satisfies each JD requirement.

Return strict JSON only:
{
  "judgements": [
    {
      "requirementId": "string",
      "status": "met | partial | inferred | not_met",
      "confidence": 0.0,
      "evidenceStrength": "strong | partial | weak | missing",
      "reason": "short evidence-based reason",
      "missingEvidence": "what is still missing",
      "interviewProbe": "one validation question target"
    }
  ]
}

Rules:
1. Skill-list-only evidence cannot fully satisfy must-have requirements.
2. University or hobby projects do not fully satisfy professional-years requirements.
3. Legal, certification, safety, registration, and qualification requirements require direct evidence.
4. Degree or qualification requirements should be proven by education or certification evidence, not project descriptions.
5. Use partial when evidence is related but incomplete.
6. Use inferred only when the match is plausible but not directly proven.
7. Always judge only from the candidateEvidence provided.
8. Do not use JD section headings as missing evidence.

Items:
${JSON.stringify(items, null, 2).slice(0, 18000)}`;

const normalizeAiJudgements = (payload = {}, fallbackById = {}) => {
  const rows = Array.isArray(payload.judgements) ? payload.judgements : [];
  return Object.fromEntries(rows.map((item) => {
    const id = String(item.requirementId || '').trim();
    if (!id) return null;
    const fallback = fallbackById[id] || {};
    const status = normalizeStatus(item.status || fallback.status);
    return [id, {
      ...fallback,
      status,
      confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : fallback.confidence,
      evidenceStrength: item.evidenceStrength || fallback.evidenceStrength || 'missing',
      reason: String(item.reason || fallback.reason || '').trim(),
      missingEvidence: String(item.missingEvidence || fallback.missingEvidence || '').trim(),
      interviewProbe: String(item.interviewProbe || fallback.interviewProbe || '').trim(),
    }];
  }).filter(Boolean));
};

export const judgeRequirementEvidenceBatch = async ({ requirements = [], semanticEvidenceContext = {} } = {}) => {
  const items = requirements.map((requirement) => {
    const key = normalizeTaxonomyLabel(requirement.text || requirement.label);
    const topEvidence = filterEvidenceByRequirementType({
      requirement,
      evidence: semanticEvidenceContext.byLabel?.[key] || [],
    });
    return {
      requirement,
      topEvidence,
      fallback: buildHeuristicJudgement({ requirement, topEvidence }),
    };
  });

  const fallbackById = Object.fromEntries(items.map((item) => [item.requirement.id, item.fallback]));

  if (process.env.AI_TEST_MODE === 'mock' || process.env.MATCH_ENGINE !== 'semantic') {
    return fallbackById;
  }

  const aiPayload = await callDeepSeekJson({
    prompt: buildPrompt({
      items: items.map(({ requirement, topEvidence }) => ({
        requirement: {
          id: requirement.id,
          text: requirement.text || requirement.label,
          category: requirement.category,
          importance: requirement.importance,
          mustHave: requirement.mustHave,
          evidenceNeeded: requirement.evidenceNeeded,
        },
        candidateEvidence: topEvidence.slice(0, 5),
      })),
    }),
    systemInstruction: 'You are a strict CV-JD evidence judge. Return valid JSON only. No prose.',
    fallback: { judgements: Object.values(fallbackById) },
    maxRetries: 1,
    usageMetadata: { stage: 'cv_jd_match', feature: 'evidence_judge' },
  });

  const aiById = normalizeAiJudgements(aiPayload, fallbackById);
  return Object.fromEntries(Object.entries(fallbackById).map(([id, fallback]) => {
    const ai = aiById[id];
    if (!ai) return [id, fallback];
    if (STATUS_ORDER[ai.status] > STATUS_ORDER[fallback.status] && fallback.evidenceStrength === 'weak') {
      return [id, { ...ai, status: fallback.status, reason: fallback.reason }];
    }
    return [id, ai];
  }));
};
