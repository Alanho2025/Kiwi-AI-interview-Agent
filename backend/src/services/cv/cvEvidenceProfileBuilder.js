import crypto from 'node:crypto';

import { normalizeProjectsSection } from './cvProjectNormalizer.js';
import { extractAchievements } from './cvAchievementExtractor.js';
import { extractCapabilities } from './cvCapabilityExtractor.js';

const sectionByKey = (sections = [], key) => sections.find((section) => section.key === key)?.content || '';

const extractKeyCompetencies = (sections = []) => {
  const text = sectionByKey(sections, 'key_competencies') || sectionByKey(sections, 'skills') || '';
  return text.split('\n').map((line) => line.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
};

const extractSectionEntries = (text = '') => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);

const EVIDENCE_STRENGTH_BY_SOURCE = {
  experience: 'strong',
  project_outcome: 'strong',
  project_responsibility: 'strong',
  project_tech_stack: 'strong',
  achievement: 'strong',
  education: 'partial',
  volunteer: 'partial',
  key_competency: 'weak',
  skill: 'weak',
  summary: 'weak',
};

const TOOL_PATTERN = /\b(Python|JavaScript|TypeScript|React|Node\.js|Node|Express|SQL|PostgreSQL|Postgres|MongoDB|AWS|Azure|Azure Speech|GCP|Redis|Elasticsearch|Kafka|Excel|Power BI|Tableau|Salesforce|HubSpot|Figma|Docker|Kubernetes|Linux|Git|DeepSeek|OpenAI|WebSocket|Tailwind|Vite|Vitest|Playwright|Vercel|Render|Java|Unity|Trello|Photoshop|Sketch|InDesign|jQuery)\b/gi;

const TECHNICAL_PRODUCT_EVIDENCE_PATTERN = /\b(designed|developed|built|implemented|evaluated|benchmarked|automated|integrated|deployed|analysed|analyzed|tested|validated|coordinated|documented|reported|workflow|prototype|system|agent|matching|adaptive questioning|voice interaction|quality checks?|rubrics?|evidence checks?|latency benchmarks?|full-stack|websocket|azure speech|llm|api|rag|react|express|python|postgresql|mongodb|deepseek|tailwind|npi|design of experiments|failure analysis|product quality|technical trade-off)\b/i;

const inferSection = (sourceType = '') => {
  if (sourceType === 'summary') return 'summary';
  if (sourceType === 'experience') return 'experience';
  if (sourceType.startsWith('project_')) return 'projects';
  if (sourceType === 'achievement') return 'achievements';
  if (sourceType === 'education') return 'education';
  if (sourceType === 'volunteer') return 'volunteer';
  if (['skill', 'key_competency'].includes(sourceType)) return 'skills';
  return 'other';
};

const inferDomain = (text = '') => {
  if (/customer|client|retail|complaint|service/i.test(text)) return 'customer_service';
  if (/marketing|campaign|content|brand|seo/i.test(text)) return 'marketing';
  if (/health|patient|clinic|medical|nurse/i.test(text)) return 'healthcare';
  if (/teach|student|school|education/i.test(text)) return 'education';
  if (/finance|account|invoice|payroll/i.test(text)) return 'finance';
  if (/data|analytics|pipeline|dashboard|sql/i.test(text)) return 'data';
  if (/api|software|frontend|backend|app|cloud/i.test(text)) return 'software';
  return '';
};

const normalizeEvidenceText = (text = '') => String(text || '')
  .replace(/\s+/g, ' ')
  .replace(/[.,;:\s]+$/g, '')
  .trim()
  .toLowerCase();

const buildStableEvidenceKey = (item = {}, text = '') => crypto
  .createHash('sha256')
  .update([
    item.sourceType || 'unknown',
    item.projectTitle || '',
    normalizeEvidenceText(text),
  ].join('\n'))
  .digest('hex')
  .slice(0, 20);

const extractTools = (text = '') => [...new Set((String(text || '').match(TOOL_PATTERN) || [])
  .map((item) => item.replace(/^node$/i, 'Node.js')))] ;

const QUANTIFIED_EVIDENCE_ACTION_PATTERN = /\b(reduce|reduced|lower|lowered|improve|improved|increase|increased|decrease|decreased|save|saved|cut|automate|automated|design|designed|develop|developed|build|built|deliver|delivered|launch|launched|achieve|achieved|prepare|prepared|collect|collected|clean|cleaned|coordinate|coordinated|analyse|analysed|analyze|analyzed|support|supported|benchmark|benchmarked|evaluate|evaluated|deploy|deployed|migrate|migrated|lead|led)\b/i;

const DATE_RANGE_LINE_PATTERN = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{4}\s*[-–]/i;

const isQuantifiedEvidenceCandidate = (text = '') => {
  const normalizedText = String(text || '').trim();
  if (!/\d|%|percent/i.test(normalizedText)) return false;
  if (DATE_RANGE_LINE_PATTERN.test(normalizedText) && !QUANTIFIED_EVIDENCE_ACTION_PATTERN.test(normalizedText)) return false;
  return QUANTIFIED_EVIDENCE_ACTION_PATTERN.test(normalizedText);
};

const resolveEvidenceStrength = (item = {}, text = '') => {
  const baseStrength = EVIDENCE_STRENGTH_BY_SOURCE[item.sourceType] || 'weak';
  if (item.sourceType === 'key_competency' && TECHNICAL_PRODUCT_EVIDENCE_PATTERN.test(text)) {
    return 'partial';
  }
  return baseStrength;
};

const calculateSpecificity = ({ item = {}, text = '', tools = [] } = {}) => {
  let score = 0.25;
  if (tools.length) score += 0.2;
  if (/\d|%|percent/i.test(text)) score += 0.25;
  if (text.length >= 45) score += 0.15;
  if (['experience', 'project_outcome', 'project_responsibility', 'achievement'].includes(item.sourceType)) score += 0.15;
  return Math.min(1, Number(score.toFixed(2)));
};

export const buildTraceableCvEvidenceItem = (item = {}) => {
  const text = String(item.text || '');
  const stableKey = buildStableEvidenceKey(item, text);
  const tools = item.tools || extractTools(text);
  const section = item.section || inferSection(item.sourceType);
  const responsibilitySignal = Boolean(item.responsibilitySignal ?? /built|owned|led|managed|coordinated|supported|handled|delivered|implemented|resolved|prepared|maintained|designed|developed|evaluated|benchmarked/i.test(text));
  const achievementSignal = Boolean(item.achievementSignal ?? /\d|%|reduced|improved|increased|saved|delivered|launched|achieved/i.test(text));
  const id = item.id && !/^evidence:\d+$/.test(item.id) ? item.id : `evidence:${stableKey}`;
  const chunkId = item.chunkId && !/^cv_\d+$/.test(item.chunkId) ? item.chunkId : `cv:${stableKey}`;

  return {
    ...item,
    id,
    chunkId,
    section,
    evidenceStrength: resolveEvidenceStrength(item, text),
    tools,
    domain: item.domain || inferDomain(text),
    responsibilitySignal,
    achievementSignal,
    rawSnippet: item.rawSnippet || text,
    normalizedSummary: item.normalizedSummary || normalizeEvidenceText(text),
    sourceTrace: {
      section,
      sourceType: item.sourceType || 'unknown',
      chunkId,
      ...(item.projectTitle ? { projectTitle: item.projectTitle } : {}),
      ...(item.sourceTrace || {}),
    },
    signals: {
      responsibility: responsibilitySignal,
      outcome: achievementSignal,
      specificity: calculateSpecificity({ item, text, tools }),
      personalOwnership: Boolean(/\b(i|my|owned|led|built|designed|developed|implemented|delivered|managed)\b/i.test(text)),
      ...(item.signals || {}),
    },
  };
};

const dedupeEvidenceItems = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const normalizedText = normalizeEvidenceText(item.text);
    if (!normalizedText) return false;
    const key = `${item.sourceType || 'unknown'}:${item.projectTitle || ''}:${normalizedText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractQuantifiedEvidence = ({ achievements = [], evidenceItems = [], normalizedText = '' } = {}) => {
  const achievementTexts = achievements.map((item) => item?.text || item).filter(Boolean);
  const evidenceTexts = evidenceItems.map((item) => item?.text || item).filter(Boolean);
  const lineTexts = String(normalizedText || '')
    .split('\n')
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean)
    .filter((line) => /(?:\d+(?:\.\d+)?%|percent|reduced|improved|increased|decreased|saved|cut)/i.test(line));

  return [...new Set([...achievementTexts, ...evidenceTexts, ...lineTexts]
    .map((text) => String(text || '').trim())
    .filter(isQuantifiedEvidenceCandidate))];
};

const inferRoleSignals = ({ projects = [], achievements = [], hardSkills = [], capabilities = [] } = {}) => ({
  priorProfessionalMaturity: achievements.length > 0 ? 0.82 : 0.6,
  targetRoleReadiness: Math.min(0.92, 0.4 + (projects.length * 0.12) + (hardSkills.length * 0.03)),
  careerTransitionSignal: capabilities.includes('adaptability') || hardSkills.length >= 4 ? 0.8 : 0.45,
});

export const buildCvEvidenceProfile = (cvProfile = {}, normalizedText = '', options = {}) => {
  const sections = Array.isArray(cvProfile.sections) ? cvProfile.sections : [];
  const personalStatement = sectionByKey(sections, 'personal_statement') || cvProfile.summary || '';
  const keyCompetencies = extractKeyCompetencies(sections);
  const experienceEntries = extractSectionEntries(sectionByKey(sections, 'experience') || cvProfile.experience || '');
  const projects = normalizeProjectsSection(sectionByKey(sections, 'projects') || cvProfile.projects || '');
  const educationEntries = extractSectionEntries(sectionByKey(sections, 'education') || cvProfile.education || '');
  const volunteerEntries = extractSectionEntries(sectionByKey(sections, 'volunteer') || '');
  const hardSkills = Array.isArray(cvProfile.skills) ? cvProfile.skills.map((item) => item.label) : [];
  const achievements = extractAchievements(normalizedText);
  const capabilityResult = extractCapabilities({
    sectionTexts: [personalStatement, keyCompetencies.join('\n'), experienceEntries.join('\n'), projects.map((item) => item.rawText).join('\n'), educationEntries.join('\n'), volunteerEntries.join('\n')],
    skillLabels: hardSkills,
  });

  const evidenceItems = dedupeEvidenceItems([
    ...(personalStatement ? [{ sourceType: 'summary', text: personalStatement }] : []),
    ...experienceEntries.map((text) => ({ sourceType: 'experience', text })),
    ...projects.flatMap((project) => {
      const projectEvidence = [
        ...(project.techStack?.length ? [{
          sourceType: 'project_tech_stack',
          projectTitle: project.title,
          text: `Project tech stack for ${project.title}: ${project.techStack.join(', ')}.`,
          tools: project.techStack,
        }] : []),
        ...project.responsibilities.map((text) => ({ sourceType: 'project_responsibility', projectTitle: project.title, text })),
        ...project.outcomes.map((text) => ({ sourceType: 'project_outcome', projectTitle: project.title, text })),
      ];
      return projectEvidence.length
        ? projectEvidence
        : [{ sourceType: 'project_responsibility', projectTitle: project.title, text: project.rawText || project.title }];
    }),
    ...keyCompetencies.map((text) => ({ sourceType: 'key_competency', text })),
    ...educationEntries.map((text) => ({ sourceType: 'education', text })),
    ...volunteerEntries.map((text) => ({ sourceType: 'volunteer', text })),
    ...hardSkills.map((text) => ({ sourceType: 'skill', text })),
    ...achievements.map((item) => ({ sourceType: 'achievement', text: item.text, achievementType: item.type })),
  ]).map(buildTraceableCvEvidenceItem);

  return {
    schemaVersion: 'cv_evidence_profile_v2',
    accessScope: 'private',
    candidateName: cvProfile.candidateName || 'Candidate',
    roleSignals: inferRoleSignals({
      projects,
      achievements,
      hardSkills,
      capabilities: capabilityResult.functionalCapabilities,
    }),
    sections: {
      personalStatement,
      keyCompetencies,
      experience: experienceEntries,
      projects,
      education: educationEntries,
      volunteer: volunteerEntries,
      certifications: extractSectionEntries(sectionByKey(sections, 'certifications') || cvProfile.certifications || ''),
      skills: hardSkills,
    },
    hardSkills,
    functionalCapabilities: capabilityResult.functionalCapabilities,
    behaviouralCapabilities: capabilityResult.behaviouralCapabilities,
    achievements,
    quantifiedEvidence: extractQuantifiedEvidence({ achievements, evidenceItems, normalizedText }),
    evidenceItems,
    nlpSignals: options.nlpSignals || null,
  };
};
