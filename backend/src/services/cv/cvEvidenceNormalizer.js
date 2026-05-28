import { extractCapabilities } from './cvCapabilityExtractor.js';
import { ensureArray, unique } from '../../utils/commonHelpers.js';

const normalizeTextField = (...values) => values
  .flatMap((value) => Array.isArray(value) ? value : [value])
  .map((value) => String(value || '').trim())
  .filter(Boolean)
  .join(' ');

const ensureStringList = (items = []) => unique(ensureArray(items)
  .flatMap((item) => Array.isArray(item) ? item : [item])
  .map((item) => {
    if (typeof item === 'string') return item;
    return normalizeTextField(item?.text, item?.label, item?.summary, item?.description, item?.responsibilities, item?.title, item?.role);
  })
  .filter(Boolean));

const normalizeProjectItem = (item = {}) => {
  if (typeof item === 'string') {
    return {
      title: item,
      responsibilities: [item],
      outcomes: [],
      techStack: [],
      rawText: item,
    };
  }

  const responsibilities = ensureStringList([
    item?.responsibilities,
    item?.description,
    item?.summary,
  ]);
  const outcomes = ensureStringList(item?.outcomes || item?.achievements);
  const techStack = ensureStringList(item?.techStack || item?.tools || item?.skills);
  const title = String(item?.title || item?.name || 'Project').trim();

  return {
    title,
    responsibilities,
    outcomes,
    techStack,
    rawText: normalizeTextField(title, responsibilities, outcomes, techStack),
  };
};

const toEvidenceItems = ({ experience = [], projects = [], keyCompetencies = [], achievements = [] } = {}) => ([
  ...experience.map((text) => ({ sourceType: 'experience', text })),
  ...projects.flatMap((project) => [
    ...project.responsibilities.map((text) => ({ sourceType: 'project_responsibility', projectTitle: project.title, text })),
    ...project.outcomes.map((text) => ({ sourceType: 'project_outcome', projectTitle: project.title, text })),
    ...(project.techStack.length
      ? [{ sourceType: 'project_stack', projectTitle: project.title, text: `${project.title} ${project.techStack.join(' ')}` }]
      : []),
  ]),
  ...keyCompetencies.map((text) => ({ sourceType: 'key_competency', text })),
  ...achievements.map((text) => ({ sourceType: 'achievement', text })),
]);

const filterEvidence = (items = [], predicate) => unique(ensureArray(items)
  .map((item) => typeof item === 'string' ? item : item?.text)
  .filter(Boolean)
  .filter((text) => predicate(String(text).toLowerCase())));

export const normalizeCvEvidence = (profile = {}) => {
  const existing = profile.evidenceProfile || {};
  const projects = ensureArray(profile.projects).map(normalizeProjectItem);
  const achievements = ensureStringList(profile.achievements);
  const workHistory = ensureStringList(profile.workHistory || profile.experience || profile.sections?.experience);
  const skills = ensureStringList(profile.skills).filter((item) => item !== '[object Object]');
  const personalStatement = normalizeTextField(profile.summary, profile.personalStatement, profile.headline, profile.candidateHeadline);
  const keyCompetencies = ensureStringList(profile.capabilities || existing.keyCompetencies || []);
  const education = ensureStringList(profile.education);
  const volunteer = ensureStringList(profile.volunteer);

  const capabilityResult = extractCapabilities({
    sectionTexts: [
      personalStatement,
      keyCompetencies.join('\n'),
      workHistory.join('\n'),
      projects.map((item) => item.rawText).join('\n'),
      education.join('\n'),
      volunteer.join('\n'),
      achievements.join('\n'),
    ],
    skillLabels: skills,
  });

  const evidenceItems = [
    ...ensureArray(existing.evidenceItems),
    ...toEvidenceItems({
      experience: workHistory,
      projects,
      keyCompetencies,
      achievements,
    }),
  ];

  const allEvidenceTexts = unique([
    personalStatement,
    ...keyCompetencies,
    ...workHistory,
    ...projects.flatMap((item) => [item.rawText, ...item.responsibilities, ...item.outcomes, item.techStack.join(' ')]),
    ...education,
    ...volunteer,
    ...skills,
    ...achievements,
    ...ensureArray(existing.quantifiedEvidence),
    ...ensureArray(existing.leadershipEvidence),
    ...ensureArray(existing.deliveryEvidence),
    ...ensureArray(existing.technicalDepthEvidence),
    ...evidenceItems.map((item) => item.text),
  ]);

  return {
    schemaVersion: existing.schemaVersion || 'cv_evidence_profile_v1',
    sections: {
      ...(existing.sections || {}),
      personalStatement,
      keyCompetencies,
      experience: workHistory,
      projects,
      education,
      volunteer,
      certifications: ensureStringList(profile.certifications),
      skills,
    },
    hardSkills: unique([...(existing.hardSkills || []), ...skills]),
    functionalCapabilities: unique([...(existing.functionalCapabilities || []), ...capabilityResult.functionalCapabilities]),
    behaviouralCapabilities: unique([...(existing.behaviouralCapabilities || []), ...capabilityResult.behaviouralCapabilities]),
    achievements: unique([...(existing.achievements || []), ...achievements]),
    evidenceItems: unique(evidenceItems.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)),
    quantifiedEvidence: unique([
      ...ensureArray(existing.quantifiedEvidence),
      ...filterEvidence(allEvidenceTexts, (text) => /\d|%|percent|reduced|improved|increased|decreased/.test(text)),
    ]),
    leadershipEvidence: unique([
      ...ensureArray(existing.leadershipEvidence),
      ...filterEvidence(allEvidenceTexts, (text) => /led|managed|mentored|coordinated|owned/.test(text)),
    ]),
    deliveryEvidence: unique([
      ...ensureArray(existing.deliveryEvidence),
      ...filterEvidence(allEvidenceTexts, (text) => /deployed|delivered|launched|shipped|production/.test(text)),
    ]),
    technicalDepthEvidence: unique([
      ...ensureArray(existing.technicalDepthEvidence),
      ...filterEvidence(allEvidenceTexts, (text) => /built|implemented|designed|optimized|debugged|architecture|api|backend|database/.test(text)),
    ]),
  };
};
