/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Orchestrate the JD parsing pipeline while keeping parsing helpers isolated.
 * - Return one stable rubric object that downstream services can reuse.
 */

import { buildJdRubricSchema, buildRequirementItem } from '../scoringSchemaService.js';
import { canonicalizeRole, inferRoleLevel, mergeUniqueLabels } from '../taxonomyService.js';
import { extractSkillsWithAI } from './jobDescriptionAiService.js';
import { normalizeJobDescriptionText } from './jobDescriptionTextNormalizer.js';
import { detectJobDescriptionHeadings } from './jobDescriptionHeadingDetector.js';
import { collectJobDescriptionSections } from './jobDescriptionSectionCollector.js';
import { classifyJobDescriptionRequirements } from './jobDescriptionRequirementClassifier.js';
import { extractJobDescriptionSkills } from './jobDescriptionSkillExtractor.js';
import { detectJobDescriptionRoleFamily } from './jobDescriptionRoleFamilyDetector.js';
import { buildJobDescriptionInterviewTargets } from './jobDescriptionInterviewTargetBuilder.js';
import { buildJobDescriptionDiagnostics } from './jobDescriptionAnalysisDiagnostics.js';
import { validateJobDescriptionRubric } from './jobDescriptionSchemaValidator.js';
import { ROLE_KEYWORDS, cleanLineLabel, firstMatchingLine, unique } from './jobDescriptionShared.js';

const buildRoleSummary = ({ sections, responsibilities, diagnostics }) => {
  if (responsibilities.length > 0) return responsibilities.map((item) => item.label || item.text).slice(0, 6);
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
  const qualificationRequirements = qualifications.slice(0, 4).map((item) => buildRequirementItem({
    label: item.label,
    type: 'soft',
    importance: 'medium',
    notes: item.sourceHeading || '',
  }));

  return dedupeRequirementItems([...hardRequirements, ...preferredRequirements, ...qualificationRequirements]);
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


const extractJobOverview = ({ title, rawJD }) => {
  const companyMatch = rawJD.match(/join\s+([A-Z][A-Za-z0-9& .'-]+?)\s+as\s+a?n?/i)
    || rawJD.match(/why join us\??\s+at\s+([A-Z][A-Za-z0-9& .'-]+)/i)
    || rawJD.match(/about\s+([A-Z][A-Za-z0-9& .'-]+)/i);
  const locationMatch = rawJD.match(/based in (?:our )?([^\n]+?(?:Auckland|Wellington|Christchurch|Sydney|Melbourne|Brisbane|Perth)[^\n]*)/i)
    || rawJD.match(/location\s*:\s*([^\n]+)/i);
  const contractMatch = title.match(/(\d+\s*(?:month|year)\s*contract)/i) || rawJD.match(/(\d+\s*(?:month|year)\s*contract)/i);
  const employmentTypeMatch = rawJD.match(/\b(full[- ]?time|part[- ]?time|contract|permanent|fixed term)\b/i);

  return {
    title,
    companyName: companyMatch?.[1]?.trim() || '',
    location: locationMatch?.[1]?.trim() || '',
    contractType: contractMatch?.[1]?.trim() || '',
    employmentType: employmentTypeMatch?.[1]?.trim() || '',
  };
};

const buildSectionView = ({ sections, requirementGroups, technicalSkills, softSkills }) => ({
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

export const buildStructuredJobDescriptionRubric = async (rawJD = '') => {
  const normalized = normalizeJobDescriptionText(rawJD);
  const title = firstMatchingLine(normalized.lines.slice(0, 10), ROLE_KEYWORDS)
    || cleanLineLabel(firstMatchingLine(normalized.lines, /job title|role title|position title/i))
    || 'Target Role';

  const aiSkills = await extractSkillsWithAI(rawJD);
  const detectedHeadings = detectJobDescriptionHeadings(normalized.blocks);
  const sections = collectJobDescriptionSections({ blocks: normalized.blocks, detectedHeadings });
  const requirementGroups = classifyJobDescriptionRequirements(sections);
  const extractedSkills = extractJobDescriptionSkills({ sections, requirementGroups, aiSkills });
  const roleFamily = detectJobDescriptionRoleFamily({
    title,
    text: normalized.normalizedText,
    groupedTechnicalSkills: extractedSkills.technicalSkills,
  });
  const roleInfo = canonicalizeRole(title, rawJD);
  const roleLevel = inferRoleLevel(rawJD);
  const diagnostics = buildJobDescriptionDiagnostics({
    sections,
    requirementGroups,
    technicalSkills: extractedSkills.technicalSkills,
    softSkills: extractedSkills.softSkills,
    aiSkills,
  });
  const interviewTargets = buildJobDescriptionInterviewTargets({
    roleFamily: roleFamily.primary,
    groupedTechnicalSkills: extractedSkills.technicalSkills,
    softSkills: extractedSkills.softSkills,
    requirementGroups,
    title,
  });

  const technicalSkillRequirements = flattenTechnicalGroups(extractedSkills.technicalSkills);
  const softSkillRequirements = extractedSkills.softSkills.map((item) => item.label || item.name);
  const macroCriteria = buildMacroCriteria({ roleFamily, title, technicalSkills: extractedSkills.technicalSkills });
  const microCriteria = buildMicroCriteria({ technicalSkills: extractedSkills.technicalSkills, softSkills: extractedSkills.softSkills });
  const requirements = buildRequirementList(requirementGroups);
  const keywords = unique([
    ...technicalSkillRequirements,
    ...softSkillRequirements,
    ...(sections.benefits || []).slice(0, 3).map((item) => item.text),
    roleInfo.roleCanonical,
  ]).slice(0, 20);

  const rubric = buildJdRubricSchema({
    title,
    roleSummary: buildRoleSummary({ sections, responsibilities: requirementGroups.responsibilities, diagnostics }),
    responsibilities: requirementGroups.responsibilities.map((item) => item.label),
    qualifications: requirementGroups.qualifications.map((item) => item.label),
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
    mustHaveRequirements: requirementGroups.mustHaveRequirements.map((item) => item.label),
    niceToHaveExperience: requirementGroups.niceToHaveRequirements.map((item) => item.label),
    roleCanonical: roleInfo.roleCanonical,
    roleFamily: roleFamily.primary || roleInfo.roleFamily,
    roleLevel,
    interviewTargets,
    metadata: {
      confidence: diagnostics.confidence,
      sourceLength: rawJD.length,
      headingCount: detectedHeadings.length,
    },
  });

  return validateJobDescriptionRubric({
    ...rubric,
    jobOverview: extractJobOverview({ title, rawJD, sections }),
    sections: buildSectionView({ sections, requirementGroups, technicalSkills: extractedSkills.technicalSkills, softSkills: extractedSkills.softSkills }),
    diagnostics,
    roleFamilyDetail: roleFamily,
  });
};
