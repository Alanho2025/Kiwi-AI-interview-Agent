import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';

const HARD_DIRECT_CATEGORIES = new Set(['qualification', 'certification', 'compliance_or_safety', 'availability_or_location']);
const STATUS_ORDER = { not_met: 0, inferred: 1, partial: 2, met: 3 };
const JD_SECTION_HEADING_PATTERN = /^(about the hiring team|about the team|about the role|what the role entails|responsibilities|requirements|qualifications|preferred qualifications|nice to have|benefits|business unit|company overview|about us|hiring team|role entails)$/i;
const DEGREE_LEVEL_PATTERN = /\b(bachelor|bachelor's|master|master's|degree|diploma|tertiary|university)\b/i;
const RELATED_COMPUTING_FIELD_PATTERN = /\b(computer science|software engineering|information technology|information systems|data science|artificial intelligence|\bai\b|machine learning|computer engineering|software development|computing|technology)\b/i;

const normalizeStatus = (value = '') => (
  ['met', 'partial', 'inferred', 'not_met'].includes(value) ? value : 'not_met'
);

const strongestEvidence = (matches = []) => matches[0] || null;

const isWeakSkillOnly = (evidence = []) => (
  evidence.length > 0
  && evidence.every((item) => ['skill', 'key_competency', 'summary'].includes(item.sourceType) || (item.evidenceStrength === 'weak' && item.sourceType !== 'project_tech_stack'))
);

const requirementText = (requirement = {}) => `${requirement.text || requirement.label || ''} ${requirement.category || ''}`;

const isQualificationRequirement = (requirement = {}) => /degree|bachelor|master|qualification|tertiary|diploma/i.test(requirementText(requirement));

const isProfessionalExperienceRequirement = (requirement = {}) => /professional|commercial|years? of experience|work experience/i.test(requirementText(requirement));

const hasDirectRelatedDegreeEvidence = ({ requirement = {}, evidence = [] } = {}) => {
  if (!isQualificationRequirement(requirement)) return false;
  const requirementValue = requirementText(requirement);
  const acceptsComputingRelatedField = RELATED_COMPUTING_FIELD_PATTERN.test(requirementValue)
    || /related fields?/i.test(requirementValue);

  return evidence.some((item) => {
    if (!['education', 'certifications'].includes(item.section)) return false;
    const text = String(item.text || '');
    if (!DEGREE_LEVEL_PATTERN.test(text)) return false;
    if (!acceptsComputingRelatedField) return true;
    return RELATED_COMPUTING_FIELD_PATTERN.test(text);
  });
};

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

const hasProjectTechEvidence = (evidence = []) => evidence.some((item) =>
  item.sourceType === 'project_tech_stack'
  || (item.section === 'projects' && item.evidenceStrength === 'strong')
);

const statusFromEvidence = ({ requirement = {}, evidence = [] } = {}) => {
  const best = strongestEvidence(evidence);
  if (!best) return 'not_met';
  if (hasDirectRelatedDegreeEvidence({ requirement, evidence })) return 'met';
  if (requiresDirectProof(requirement) && best.evidenceStrength === 'weak') return 'not_met';
  if (isQualificationRequirement(requirement) && !['education', 'certifications'].includes(best.section)) return 'partial';
  if (isProfessionalExperienceRequirement(requirement) && best.section !== 'experience') return 'partial';
  if (hasProjectTechEvidence(evidence) && requirement.mustHave && ['technical_skill', 'tool_or_platform', 'domain_knowledge'].includes(requirement.category)) return 'partial';
  if (isWeakSkillOnly(evidence) && requirement.mustHave) return 'partial';
  if (best.evidenceStrength === 'strong' && Number(best.score || 0) >= 0.66) return 'met';
  if (Number(best.score || 0) >= 0.52) return 'partial';
  if (Number(best.score || 0) >= 0.34) return 'inferred';
  return 'not_met';
};

const evidenceStrengthFromStatus = ({ requirement = {}, status, evidence = [] }) => {
  if (status === 'not_met') return 'missing';
  const best = strongestEvidence(evidence);
  if (!best) return 'missing';
  if (status === 'met' && hasDirectRelatedDegreeEvidence({ requirement, evidence })) return 'strong';
  if (status === 'met') return best.evidenceStrength || 'strong';
  if (best.evidenceStrength === 'strong') return 'partial';
  return best.evidenceStrength || 'weak';
};

const buildReason = ({ requirement = {}, status = 'not_met', evidence = [] } = {}) => {
  const best = strongestEvidence(evidence);
  if (!best) return 'No meaningful CV evidence was retrieved for this requirement.';
  if (status === 'met' && hasDirectRelatedDegreeEvidence({ requirement, evidence })) {
    return 'The CV gives direct education evidence for this degree or related-field qualification requirement.';
  }
  if (status === 'met') return `The CV gives direct ${best.evidenceStrength || 'usable'} evidence for this requirement.`;
  if (status === 'partial') {
    if (isQualificationRequirement(requirement) && !['education', 'certifications'].includes(best.section)) {
      return 'The CV has related evidence, but the qualification should be confirmed from the education or certification section.';
    }
    if (isProfessionalExperienceRequirement(requirement) && best.section !== 'experience') {
      return 'The CV has related project evidence, but it does not fully prove professional or commercial experience.';
    }
    if (hasProjectTechEvidence(evidence)) return 'The CV shows this tool in project-level evidence, but the implementation depth should still be validated.';
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
    evidenceStrength: evidenceStrengthFromStatus({ requirement, status, evidence: filteredEvidence }),
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
5. A Bachelor, Master, or higher degree in Information Technology counts as a related-field qualification for Computer Science, Software Engineering, AI, Data Science, or related-field degree requirements.
6. Use partial when evidence is related but incomplete.
7. Use inferred only when the match is plausible but not directly proven.
8. Always judge only from the candidateEvidence provided.
9. Do not use JD section headings as missing evidence.

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

  // Segment items into local-bypassed vs ambiguous (requiring LLM)
  const localBypassedJudgements = {};
  const ambiguousItems = [];

  for (const item of items) {
    const maxScore = item.topEvidence[0]?.score || 0;
    const isBypass = maxScore >= 0.82 || maxScore <= 0.45 || item.topEvidence.length === 0;

    if (isBypass) {
      localBypassedJudgements[item.requirement.id] = {
        ...item.fallback,
        routedLocally: true,
      };
    } else {
      ambiguousItems.push(item);
    }
  }

  // If there are no ambiguous items, we completely bypass the LLM!
  if (ambiguousItems.length === 0) {
    return localBypassedJudgements;
  }

  // Call LLM only for ambiguous items
  const aiPayload = await callDeepSeekJson({
    prompt: buildPrompt({
      items: ambiguousItems.map(({ requirement, topEvidence }) => ({
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
    fallback: { judgements: ambiguousItems.map(item => item.fallback) },
    maxRetries: 1,
    usageMetadata: { stage: 'cv_jd_match', feature: 'evidence_judge' },
  });

  const aiById = normalizeAiJudgements(aiPayload, fallbackById);

  // Merge local bypassed judgements and AI judgements
  return Object.fromEntries(requirements.map((req) => {
    const id = req.id;
    if (localBypassedJudgements[id]) {
      return [id, localBypassedJudgements[id]];
    }

    const ai = aiById[id];
    const fallback = fallbackById[id];
    if (!ai) return [id, fallback];
    if (fallback.status === 'met' && fallback.evidenceStrength === 'strong' && /degree|bachelor|master|qualification|tertiary|diploma/i.test(fallback.reason || '')) {
      return [id, fallback];
    }
    if (STATUS_ORDER[ai.status] > STATUS_ORDER[fallback.status] && fallback.evidenceStrength === 'weak') {
      return [id, { ...ai, status: fallback.status, reason: fallback.reason }];
    }
    return [id, ai];
  }));
};