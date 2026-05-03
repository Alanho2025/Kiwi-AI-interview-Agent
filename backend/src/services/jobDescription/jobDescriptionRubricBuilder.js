/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Orchestrate the JD parsing pipeline while keeping parsing helpers isolated.
 * - Return one stable rubric object that downstream services can reuse.
 */

import { buildJdRubricSchema, buildRequirementItem } from '../scoringSchemaService.js';
import { canonicalizeRole, mergeUniqueLabels } from '../taxonomyService.js';
import { extractSkillsWithAI } from './jobDescriptionAiService.js';
import { normalizeJobDescriptionText } from './jobDescriptionTextNormalizer.js';
import { detectJobDescriptionHeadings } from './jobDescriptionHeadingDetector.js';
import { collectJobDescriptionSections } from './jobDescriptionSectionCollector.js';
import { classifyJobDescriptionRequirements } from './jobDescriptionRequirementClassifier.js';
import { extractJobDescriptionSkills } from './jobDescriptionSkillExtractor.js';
import { detectJobDescriptionRoleFamily } from './jobDescriptionRoleFamilyDetector.js';
import { resolveRoleLevel } from './extractors/roleLevelResolver.js';
import { buildJobDescriptionInterviewTargets } from './jobDescriptionInterviewTargetBuilder.js';
import { buildJobDescriptionDiagnostics } from './jobDescriptionAnalysisDiagnostics.js';
import { validateJobDescriptionRubric } from './jobDescriptionSchemaValidator.js';
import { extractJobDescriptionHeader } from './jobDescriptionHeaderExtractor.js';
import { buildFieldEvidence } from './jobDescriptionEvidenceBuilder.js';
import { ROLE_KEYWORDS, cleanLineLabel, firstMatchingLine, unique } from './jobDescriptionShared.js';
import { normalizeResponsibilityPoints } from './normalizers/normalizeResponsibility.js';
import { normalizeRequirementPoints } from './normalizers/normalizeRequirement.js';
import { normalizeBenefitPoints } from './normalizers/normalizeBenefit.js';
import { normalizeSoftSkillPoints } from './normalizers/normalizeSoftSkill.js';
import { normalizeApplicationInstructionPoints } from './normalizers/normalizeApplicationInstruction.js';

const buildRoleSummary = ({ normalizedSections = {}, sections, diagnostics }) => {
  if ((normalizedSections.responsibilities || []).length > 0) return normalizedSections.responsibilities.slice(0, 6);
  if (sections.introduction?.length > 0) return sections.introduction.slice(0, 2).map((item) => item.text);
  return diagnostics.warnings.slice(0, 1);
};

const normalizeRequirementKey = (label = '') => String(label || '').toLowerCase().replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\s+/g, ' ').trim();

const dedupeRequirementItems = (items = []) => {
  const map = new Map();
  const importanceRank = { low: 1, medium: 2, high: 3 };
  const typeRank = { soft: 1, hard: 2 };

  for (const item of items) {
    const key = normalizeRequirementKey(item.label);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item });
      continue;
    }
    map.set(key, {
      ...existing,
      importance: (importanceRank[item.importance] || 0) > (importanceRank[existing.importance] || 0) ? item.importance : existing.importance,
      type: (typeRank[item.type] || 0) > (typeRank[existing.type] || 0) ? item.type : existing.type,
      notes: unique([existing.notes, item.notes]).join(' | '),
      evidence: unique([...(existing.evidence || []), ...(item.evidence || [])]),
      sourceChunks: unique([...(existing.sourceChunks || []), ...(item.sourceChunks || [])]),
    });
  }

  return [...map.values()];
};

const buildRequirementList = ({ mustHaveRequirements, niceToHaveRequirements, qualifications }) => {
  const hardRequirements = mustHaveRequirements.map((item) => buildRequirementItem({
    label: item.label,
    type: 'hard',
    importance: 'high',
    notes: item.sourceHeading || '',
  }));
  const preferredRequirements = niceToHaveRequirements.map((item) => buildRequirementItem({
    label: item.label,
    type: 'soft',
    importance: 'low',
    notes: item.sourceHeading || '',
  }));
  const qualificationRequirements = qualifications.slice(0, 6).map((item) => buildRequirementItem({
    label: item.label,
    type: 'soft',
    importance: 'medium',
    notes: item.sourceHeading || '',
  }));

  return dedupeRequirementItems([...hardRequirements, ...preferredRequirements, ...qualificationRequirements]);
};

const buildRequirementListFromSectionLabels = ({ mustHaveRequirements = [], niceToHaveRequirements = [], qualifications = [] }) => {
  const hardRequirements = mustHaveRequirements.map((label) => buildRequirementItem({ label, type: 'hard', importance: 'high', notes: 'guarded_jd_parse' }));
  const preferredRequirements = niceToHaveRequirements.map((label) => buildRequirementItem({ label, type: 'soft', importance: 'low', notes: 'guarded_jd_parse' }));
  const qualificationRequirements = qualifications.slice(0, 6).map((label) => buildRequirementItem({ label, type: 'soft', importance: 'medium', notes: 'guarded_jd_parse' }));
  return dedupeRequirementItems([...hardRequirements, ...preferredRequirements, ...qualificationRequirements]);
};

const normalizeOverrideList = (value) => (Array.isArray(value) ? unique(value.map((item) => String(item || '').trim()).filter(Boolean)) : []);

const applySectionOverrides = (normalizedSections = {}, sectionOverrides = {}) => {
  const sections = { ...normalizedSections };
  const overrideMap = {
    responsibilities: normalizeOverrideList(sectionOverrides.responsibilities),
    mustHaveRequirements: normalizeOverrideList(sectionOverrides.mustHaveRequirements || sectionOverrides.coreRequirements),
    niceToHaveRequirements: normalizeOverrideList(sectionOverrides.niceToHaveRequirements || sectionOverrides.bonusRequirements),
    benefits: normalizeOverrideList(sectionOverrides.benefits),
    qualifications: normalizeOverrideList(sectionOverrides.qualifications),
  };

  Object.entries(overrideMap).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(sectionOverrides, key) || value.length > 0) sections[key] = value;
  });

  if (sections.mustHaveRequirements?.length && sections.qualifications?.length) {
    const mustHaveKeys = new Set(sections.mustHaveRequirements.map(normalizeRequirementKey));
    sections.qualifications = sections.qualifications.filter((item) => !mustHaveKeys.has(normalizeRequirementKey(item)));
  }

  return sections;
};

const flattenTechnicalGroups = (technicalSkills = {}) => Object.values(technicalSkills).flat().map((item) => item.label || item.name);

const buildMicroCriteria = ({ technicalSkills, softSkills }) => mergeUniqueLabels(
  flattenTechnicalGroups(technicalSkills).map((label) => ({ label, type: 'micro', category: 'technical', weight: 1 })),
  softSkills.map((item) => ({ label: item.label || item.name, type: 'micro', category: 'behavioural', weight: 1 })),
);

const buildMacroCriteria = ({ roleFamily, title, technicalSkills }) => {
  const entries = [
    { label: 'technical expertise', type: 'macro', weight: 1 },
    { label: 'communication', type: 'macro', weight: 1 },
    { label: 'experience', type: 'macro', weight: 1 },
  ];
  if (/lead|manager/i.test(title || '')) entries.push({ label: 'leadership', type: 'macro', weight: 1 });
  if (roleFamily.primary === 'data') entries.push({ label: 'analytical thinking', type: 'macro', weight: 1 });
  if (roleFamily.primary === 'ai_ml') entries.push({ label: 'model thinking', type: 'macro', weight: 1 });
  if ((technicalSkills.commonEngineering || []).length > 0) entries.push({ label: 'delivery discipline', type: 'macro', weight: 1 });
  return mergeUniqueLabels(entries);
};

const buildRawSectionView = ({ sections, requirementGroups, technicalSkills, softSkills }) => ({
  introduction: (sections.introduction || []).map((item) => item.text),
  responsibilities: (requirementGroups.responsibilities || []).map((item) => item.label),
  qualifications: (requirementGroups.qualifications || []).map((item) => item.label),
  mustHaveRequirements: (requirementGroups.mustHaveRequirements || []).map((item) => item.label),
  niceToHaveRequirements: (requirementGroups.niceToHaveRequirements || []).map((item) => item.label),
  technicalSkills,
  softSkills: softSkills.map((item) => item.label || item.name),
  benefits: (sections.benefits || []).map((item) => item.text),
  companyContext: (sections.companyContext || []).map((item) => item.text),
  applicationInstructions: (sections.applicationInstructions || []).map((item) => item.text),
});


const SOURCE_SECTION_KEYS = new Set([
  'responsibilities',
  'mustHaveRequirements',
  'niceToHaveRequirements',
  'qualifications',
]);

const normalizeSourceLabel = (value = '') => String(value || '')
  .replace(/^[•\-*]\s*/, '')
  .replace(/\s+/g, ' ')
  .trim()
  .trim();

const normalizeExactSourcePoints = (items = [], evidenceMap = {}) => unique(items.map((item) => {
  const label = normalizeSourceLabel(item?.label || item?.text || item?.normalizedText || item);
  const evidence = normalizeSourceLabel(item?.text || item?.label || item?.normalizedText || item);
  if (label && evidence) evidenceMap[label] = unique([...(evidenceMap[label] || []), evidence]);
  return label;
}).filter(Boolean));

const mergeEvidenceMaps = (...maps) => maps.reduce((accumulator, current) => {
  Object.entries(current || {}).forEach(([label, evidence]) => {
    accumulator[label] = unique([...(accumulator[label] || []), ...(evidence || [])]);
  });
  return accumulator;
}, {});

const normalizeSectionView = ({ sections, requirementGroups, technicalSkills, softSkills }) => {
  const responsibilityEvidence = {};
  const mustHaveEvidence = {};
  const niceToHaveEvidence = {};
  const qualificationEvidence = {};
  const benefitEvidence = {};
  const applicationEvidence = {};
  const softSkillEvidence = {};

  const normalizedResponsibilities = normalizeExactSourcePoints(requirementGroups.responsibilities || [], responsibilityEvidence);
  const normalizedMustHave = normalizeExactSourcePoints(requirementGroups.mustHaveRequirements || [], mustHaveEvidence);
  const normalizedNiceToHave = normalizeExactSourcePoints(requirementGroups.niceToHaveRequirements || [], niceToHaveEvidence);
  const normalizedQualifications = normalizeExactSourcePoints(requirementGroups.qualifications || [], qualificationEvidence);
  const normalizedBenefits = unique((sections.benefits || []).flatMap((item) => normalizeBenefitPoints(item, benefitEvidence)));
  const normalizedApplications = unique((sections.applicationInstructions || []).flatMap((item) => normalizeApplicationInstructionPoints(item, applicationEvidence)));
  const normalizedSoftSkills = unique([
    ...softSkills.map((item) => item.label || item.name),
    ...normalizeSoftSkillPoints(softSkills, softSkillEvidence),
    ...normalizeSoftSkillPoints(requirementGroups.softSkillSignals || [], softSkillEvidence),
  ]);

  return {
    normalized: {
      introduction: (sections.introduction || []).map((item) => item.text),
      responsibilities: normalizedResponsibilities,
      qualifications: normalizedQualifications,
      mustHaveRequirements: normalizedMustHave,
      niceToHaveRequirements: normalizedNiceToHave,
      technicalSkills,
      softSkills: normalizedSoftSkills,
      benefits: normalizedBenefits,
      companyContext: (sections.companyContext || []).map((item) => item.text),
      applicationInstructions: normalizedApplications,
    },
    evidenceMap: mergeEvidenceMaps(
      responsibilityEvidence,
      mustHaveEvidence,
      niceToHaveEvidence,
      qualificationEvidence,
      benefitEvidence,
      applicationEvidence,
      softSkillEvidence,
    ),
  };
};

const extractTitle = (normalized) => {
  const candidates = (normalized.lines || []).slice(0, 8);
  for (const line of candidates) {
    const text = String(line || '').replace(/\s+/g, ' ').trim();
    const splitIndex = text.search(/\b(?:company|employment type|job type|location|salary|contract type)\s*:|\b(?:what this role does|key responsibilities|responsibilities|core requirements|bonus requirements|qualifications|benefits|application notes|about the role|what you\'ll do|what you\'ll bring)\b/i);
    const head = splitIndex > 0 ? text.slice(0, splitIndex).trim() : text;
    const matched = head.match(/^([a-z0-9&/()+,.' -]{1,100}?\b(?:engineer|developer|manager|designer|analyst|architect|consultant|specialist|intern|graduate|scientist|administrator|programme|program)\b(?:\s*\([^)]{1,40}\))?)/i);
    const value = (matched?.[1] || '').replace(/^we are seeking\s+(?:a|an)\s+/i, '').replace(/[.:;,-]+$/g, '').trim();
    if (value && value.split(' ').length <= 12) return value.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
  }
  return cleanLineLabel(firstMatchingLine(normalized.lines, /job title|role title|position title/i))
    || 'Target Role';
};

export const buildStructuredJobDescriptionRubric = async (rawJD = '', options = {}) => {
  const normalized = normalizeJobDescriptionText(rawJD);
  const fallbackTitle = extractTitle(normalized);
  const header = extractJobDescriptionHeader({ rawJD, fallbackTitle, normalized });

  const aiSkills = await extractSkillsWithAI(rawJD);
  const detectedHeadings = detectJobDescriptionHeadings(normalized.blocks);
  const sections = collectJobDescriptionSections({ blocks: normalized.blocks, detectedHeadings });
  const requirementGroups = classifyJobDescriptionRequirements(sections);
  const extractedSkills = extractJobDescriptionSkills({ sections, requirementGroups, aiSkills });
  const roleFamily = detectJobDescriptionRoleFamily({
    title: header.title,
    flatText: normalized.flatText,
    groupedTechnicalSkills: extractedSkills.technicalSkills,
  });
  const roleInfo = canonicalizeRole(header.title, rawJD);
  const roleLevelDetail = resolveRoleLevel({ title: header.title, flatText: normalized.flatText });
  const roleLevel = roleLevelDetail.value;
  const diagnostics = buildJobDescriptionDiagnostics({
    sections,
    requirementGroups,
    technicalSkills: extractedSkills.technicalSkills,
    softSkills: extractedSkills.softSkills,
    aiSkills,
  });
  const { normalized: baseNormalizedSections, evidenceMap } = normalizeSectionView({
    sections,
    requirementGroups,
    technicalSkills: extractedSkills.technicalSkills,
    softSkills: extractedSkills.softSkills,
  });
  const normalizedSections = applySectionOverrides(baseNormalizedSections, options.sectionOverrides?.sections || options.sectionOverrides || {});
  const guardedHeader = {
    ...header,
    companyName: typeof options.sectionOverrides?.jobOverview?.companyName === 'string'
      ? options.sectionOverrides.jobOverview.companyName
      : header.companyName,
  };
  const interviewTargets = buildJobDescriptionInterviewTargets({
    roleFamily: roleFamily.primary,
    groupedTechnicalSkills: extractedSkills.technicalSkills,
    softSkills: extractedSkills.softSkills,
    requirementGroups,
    title: header.title,
  });

  const technicalSkillRequirements = flattenTechnicalGroups(extractedSkills.technicalSkills);
  const softSkillRequirements = extractedSkills.softSkills.map((item) => item.label || item.name);
  const macroCriteria = buildMacroCriteria({ roleFamily, title: header.title, technicalSkills: extractedSkills.technicalSkills });
  const microCriteria = buildMicroCriteria({ technicalSkills: extractedSkills.technicalSkills, softSkills: extractedSkills.softSkills });
  const requirements = options.reparseMode
    ? buildRequirementListFromSectionLabels(normalizedSections)
    : buildRequirementList(requirementGroups);
  const keywords = unique([
    ...technicalSkillRequirements,
    ...softSkillRequirements,
    ...(normalizedSections.benefits || []).slice(0, 4),
    ...(normalizedSections.mustHaveRequirements || []).slice(0, 8),
    roleInfo.roleCanonical,
  ]).slice(0, 24);

  const fieldEvidence = buildFieldEvidence({
    rawJD,
    values: {
      title: header.title,
      companyName: guardedHeader.companyName,
      location: header.location,
      employmentType: header.employmentType,
      roleFamily: roleFamily.primary,
    },
  });

  const rubric = buildJdRubricSchema({
    title: header.title,
    roleSummary: buildRoleSummary({ normalizedSections, sections, diagnostics }),
    responsibilities: normalizedSections.responsibilities,
    qualifications: normalizedSections.qualifications,
    keywords,
    macroCriteria,
    microCriteria,
    requirements,
    weights: {
      macro: Object.fromEntries(macroCriteria.map((item) => [item.label, 1])),
      micro: Object.fromEntries(microCriteria.map((item) => [item.label, 1])),
      overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
    },
    technicalSkillRequirements,
    softSkillRequirements,
    mustHaveRequirements: normalizedSections.mustHaveRequirements,
    niceToHaveExperience: normalizedSections.niceToHaveRequirements,
    roleCanonical: roleInfo.roleCanonical,
    roleFamily: roleFamily.primary || roleInfo.roleFamily,
    roleLevel,
    interviewTargets,
    metadata: {
      confidence: diagnostics.parserSelfConfidence,
      fieldConfidence: header.fieldConfidence,
      parserSelfConfidence: diagnostics.parserSelfConfidence,
      extractionCoverage: diagnostics.extractionCoverage,
      ambiguityScore: diagnostics.ambiguityScore,
      sourceLength: rawJD.length,
      headingCount: detectedHeadings.length,
      fieldEvidence,
      companyResolution: header.companyResolution,
      normalizedEvidenceMap: evidenceMap,
      agenticSafeguard: {
        reparseMode: Boolean(options.reparseMode),
        feedbackApplied: Boolean(options.criticFeedback),
      },
    },
  });

  return validateJobDescriptionRubric({
    ...rubric,
    jobOverview: {
      title: header.title,
      companyName: guardedHeader.companyName,
      location: header.location,
      contractType: header.contractType,
      employmentType: header.employmentType,
      salaryText: header.salaryText,
    },
    sections: normalizedSections,
    rawSections: buildRawSectionView({ sections, requirementGroups, technicalSkills: extractedSkills.technicalSkills, softSkills: extractedSkills.softSkills }),
    normalized: normalizedSections,
    evidenceMap,
    diagnostics: {
      ...diagnostics,
      roleLevelEvidence: roleLevelDetail.evidence,
    },
    roleFamilyDetail: roleFamily,
  });
};
