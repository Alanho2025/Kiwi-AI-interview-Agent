import { buildExplanationObject, buildExplanationItem } from '../scoringSchemaService.js';
import { COMMERCIAL_EXPERIENCE_PATTERN, DEGREE_PATTERN } from './matchScoringConstants.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';


export const describeEvidenceQuality = ({ requirementType = 'soft', status = 'not_met', matchedSection = '', matchedCapabilities = [], label = '', evidenceProfile = {}, evidenceStrength = 'missing' }) => {
  const projectOnly = matchedSection === 'projects';
  const transferableOnly = matchedCapabilities.length > 0 && !projectOnly && !['experience', 'skills', 'education'].includes(matchedSection);
  const isCommercialRequirement = COMMERCIAL_EXPERIENCE_PATTERN.test(label);
  const isDegreeRequirement = DEGREE_PATTERN.test(label);
  const hasCommercialSignals = Boolean((evidenceProfile.sections?.experience || []).length);

  if (status === 'met') return `direct evidence found; evidenceStrength=${evidenceStrength}`;
  if (isDegreeRequirement && matchedSection === 'education') return 'education evidence found';
  if (isCommercialRequirement && projectOnly) return 'project evidence is stronger than commercial delivery proof';
  if (isCommercialRequirement && !hasCommercialSignals) return 'missing direct commercial proof';
  if (transferableOnly) return 'transferable evidence only';
  if (projectOnly) return 'project-based evidence only';
  if (matchedSection === 'skills' && evidenceStrength === 'weak') return 'skills-list evidence only; interviewer should validate applied depth';
  if (status === 'partial') return requirementType === 'hard' ? 'partial direct evidence' : 'partial evidence found';
  if (status === 'inferred') return 'limited direct proof';
  return 'missing direct proof';
};

export const semanticEvidenceStrings = (semanticMatches = []) => semanticMatches
  .slice(0, 3)
  .map((item) => `Semantic evidence (${item.evidenceStrength || 'weak'}, ${Number(item.score || 0).toFixed(2)}): ${item.text}`)
  .filter(Boolean);

export const buildGapLabel = (item = {}) => {
  if (/communication and ownership/i.test(item.label)) return 'Limited direct evidence of communication and ownership';
  if (/communicate clearly and learn quickly/i.test(item.label)) return 'Limited direct evidence of communication and learning agility';
  if (/recent tertiary qualification/i.test(item.label)) return 'Qualification evidence needs clearer education grounding';
  if (/chatgpt|claude|ai tools/i.test(item.label)) return 'Limited direct evidence of AI tool fluency';
  if (/workflow automation|automate workflows/i.test(item.label)) return 'Limited direct evidence of workflow automation';
  if (/process improvement|efficiency|work smarter/i.test(item.label)) return 'Limited direct evidence of process improvement';
  if (/reporting|dashboard/i.test(item.label)) return 'Limited direct evidence of reporting or dashboard work';
  if (/aws/i.test(item.label)) return 'Missing evidence for AWS';
  if (/redis/i.test(item.label)) return 'Missing evidence for Redis';
  if (/elastic/i.test(item.label)) return 'Missing evidence for Elasticsearch';
  if (/kafka|distributed queue/i.test(item.label)) return 'Missing evidence for Kafka or distributed queueing systems';
  return item.status === 'not_met' ? `Missing evidence for ${item.label}` : `Limited direct evidence for ${item.label}`;
};

export const buildRiskLabel = (item = {}) => {
  if (/communication and ownership/i.test(item.label)) return 'Readiness risk for communication-heavy ownership work';
  if (/communicate clearly and learn quickly/i.test(item.label)) return 'Interview should validate communication and learning speed';
  if (/recent tertiary qualification/i.test(item.label)) return 'Resume should surface the degree evidence more clearly';
  if (/chatgpt|claude|ai tools/i.test(item.label)) return 'Interview should validate direct AI tool use';
  if (/workflow automation|automate workflows/i.test(item.label)) return 'Interview should validate workflow automation depth';
  if (/process improvement|efficiency|work smarter/i.test(item.label)) return 'Interview should validate process improvement thinking';
  if (/reporting|dashboard/i.test(item.label)) return 'Interview should validate reporting or dashboard evidence';
  if (/aws/i.test(item.label)) return 'Interview should validate whether the candidate has used AWS services';
  if (/redis/i.test(item.label)) return 'Interview should validate Redis experience';
  if (/elastic/i.test(item.label)) return 'Interview should validate Elasticsearch experience';
  if (/kafka|distributed queue/i.test(item.label)) return 'Interview should validate Kafka or distributed queueing experience';
  if (/production/i.test(item.label)) return `Interview should validate ${item.label}`;
  if (/commercial experience|professional experience/i.test(item.label)) return 'May need ramp-up before owning commercial delivery independently';
  if (/skills-list evidence only/.test(item.notes || '')) return `Interview should validate applied ${item.label} experience`;
  return `Interview should validate readiness for ${item.label}`;
};

const CAPABILITY_EVIDENCE_PATTERNS = {
  documentation: /document|runbook|knowledge base|procedure/i,
  ownership: /owned|owning|responsible|end-to-end/i,
  automation: /automate|automation|pipeline|ci\/cd|workflow/i,
  stakeholder_collaboration: /stakeholder|communicat|presented|status updates|cross-functional|across teams/i,
  troubleshooting: /troubleshoot|incident|root cause|debug/i,
  reporting_dashboard: /report|dashboard|insight|analytics/i,
  learning_agility: /learn|experiment|trial|research|new tool/i,
};

export const buildCapabilityStrengths = (cvEvidenceProfile = {}) => {
  const capabilityLabels = cvEvidenceProfile.functionalCapabilities || [];
  const evidenceItems = cvEvidenceProfile.evidenceItems || [];
  return capabilityLabels
    .map((capability) => {
      const pattern = CAPABILITY_EVIDENCE_PATTERNS[capability];
      if (!pattern) return null;
      const evidence = evidenceItems.filter((item) => pattern.test(item.text || '')).slice(0, 2).map((item) => item.text);
      if (!evidence.length) return null;
      return buildExplanationItem({ label: capability.replace(/_/g, ' '), evidence, detail: 'Grounded transferable capability' });
    })
    .filter(Boolean);
};

export const buildStrengths = (microScores = [], requirementChecks = [], cvEvidenceProfile = {}) => {
  const groundedMicro = microScores
    .filter((item) => item.score >= 72 && (item.evidence || []).length > 0)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Direct matched evidence found' }));
  const capabilityStrengths = buildCapabilityStrengths(cvEvidenceProfile);
  const requirementStrengths = requirementChecks
    .filter((item) => ['met', 'partial'].includes(item.status) && (item.evidence || []).length > 0)
    .slice(0, 4)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: item.status === 'met' ? 'Requirement is well supported' : 'Requirement is partly supported' }));
  const seen = new Set();
  return [...groundedMicro.slice(0, 5), ...capabilityStrengths, ...requirementStrengths].filter((item) => {
    const key = normalizeTaxonomyLabel(item.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
};

export const buildExplanation = ({ microScores, requirementChecks, cvEvidenceProfile = {} }) => {
  const achievementLabels = new Set((cvEvidenceProfile.achievements || []).map((item) => item.text));
  const strengths = buildStrengths(microScores, requirementChecks, cvEvidenceProfile);

  const gaps = requirementChecks
    .filter((item) => item.status !== 'met')
    .filter((item) => item.status === 'not_met' || (item.mustHave && item.status === 'inferred') || /missing direct commercial proof|skills-list evidence only|missing direct proof/.test(item.notes || ''))
    .slice(0, 5)
    .map((item) => buildExplanationItem({ label: buildGapLabel(item), evidence: item.evidence, detail: item.notes || 'Direct proof is limited' }));

  const risks = requirementChecks
    .filter((item) => item.type === 'hard' && (
      ['not_met', 'inferred'].includes(item.status)
      || /skills-list evidence only/.test(item.notes || '')
      || (item.status !== 'met' && /production|commercial experience|professional experience/i.test(item.label || ''))
    ))
    .slice(0, 4)
    .map((item) => buildExplanationItem({ label: buildRiskLabel(item), evidence: item.evidence, detail: item.status === 'not_met' ? 'This could block independent performance early on' : 'This still needs interview validation' }));

  const hasProjectHeavyGap = requirementChecks.some((item) => /project-based evidence only/.test(item.notes || ''));
  const summary = strengths.length > 0
    ? `Top matched areas: ${strengths.map((item) => item.label).join(', ')}. ${hasProjectHeavyGap ? 'Project-based evidence is helping, but direct workplace proof still needs validation.' : 'The profile shows useful evidence, but interviewers should still check any direct-proof gaps before treating it as fully job-ready.'}`
    : 'Limited strong matches were found, so the interview should probe direct evidence, transferable experience, and role-specific examples.';
  const explanation = buildExplanationObject({ strengths, gaps, risks, summary, achievementCount: achievementLabels.size });
  return { strengths, gaps, risks, explanation };
};
