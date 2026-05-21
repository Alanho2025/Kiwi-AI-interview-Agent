const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const unique = (items = []) => [...new Set(items.map((item) => normalizeText(item)).filter(Boolean))];

const truncate = (value = '', maxLength = 220) => {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
};

const skillLabels = (skills = []) => ensureArray(skills)
  .map((item) => (typeof item === 'string' ? item : item?.label || item?.name || ''))
  .map(normalizeText)
  .map((item) => item.toLowerCase())
  .filter(Boolean);

const evidenceText = (item) => (typeof item === 'string' ? item : item?.text || item?.evidence || item?.summary || '');

const inferCareerDirection = ({ summary = '', skills = [], evidenceProfile = {} } = {}) => {
  const haystack = `${summary} ${skills.join(' ')}`.toLowerCase();
  if (/\b(ai|machine learning|deep learning|data|analytics|python|sql)\b/.test(haystack)) {
    return 'Data, AI, and software-oriented career direction';
  }
  if (/\b(react|frontend|ui|javascript|typescript|html|css)\b/.test(haystack)) {
    return 'Frontend and product software delivery direction';
  }
  if (/\b(api|node|backend|cloud|aws|azure|docker)\b/.test(haystack)) {
    return 'Backend, API, and cloud delivery direction';
  }
  if ((evidenceProfile.sections?.projects || []).length) {
    return 'Project-backed technical growth direction';
  }
  return 'General role-fit narrative needs reviewer confirmation';
};

const evidenceLabel = (item = {}) => {
  if (item.sourceType === 'achievement') return 'Measured achievement';
  if (/project/i.test(item.sourceType || '')) return item.projectTitle ? `Project: ${item.projectTitle}` : 'Project evidence';
  if (item.sourceType === 'experience') return 'Experience evidence';
  if (item.sourceType === 'key_competency') return 'Competency signal';
  return 'CV evidence';
};

const buildStrongestEvidence = (evidenceProfile = {}) => {
  const quantifiedItems = ensureArray(evidenceProfile.quantifiedEvidence).map((text) => ({
    label: 'Quantified evidence',
    sourceType: 'quantified',
    text,
  }));
  const evidenceItems = ensureArray(evidenceProfile.evidenceItems);
  const projectItems = evidenceItems.filter((item) => /project/i.test(item.sourceType || ''));
  const experienceItems = evidenceItems.filter((item) => item.sourceType === 'experience');
  const otherItems = evidenceItems.filter((item) =>
    !/project/i.test(item.sourceType || '')
    && item.sourceType !== 'experience'
    && item.evidenceStrength !== 'weak');
  const orderedEvidenceItems = [...projectItems, ...experienceItems, ...otherItems].map((item) => ({
    label: evidenceLabel(item),
    sourceType: item.sourceType || 'cv',
    text: item.text || '',
  }));

  return [...quantifiedItems, ...orderedEvidenceItems]
    .map((item) => ({ ...item, text: truncate(item.text, 260) }))
    .filter((item) => item.text)
    .slice(0, 8);
};

const buildWeakEvidence = ({ evidenceProfile = {}, skills = [] } = {}) => {
  const missing = [];
  if (!ensureArray(evidenceProfile.sections?.experience).length) {
    missing.push('Direct work experience evidence is limited or missing.');
  }
  if (!ensureArray(evidenceProfile.sections?.projects).length) {
    missing.push('Project evidence is limited or missing.');
  }
  if (!ensureArray(evidenceProfile.quantifiedEvidence).length) {
    missing.push('Few measurable outcomes were detected.');
  }
  if (!skills.length) {
    missing.push('Core technical skills need reviewer confirmation.');
  }
  return missing;
};

export const buildCvAnalysis = ({ cvProfile = {}, evidenceProfile = null, normalizedText = '' } = {}) => {
  const resolvedEvidenceProfile = evidenceProfile || cvProfile.evidenceProfile || {};
  const skills = unique([
    ...skillLabels(cvProfile.skills),
    ...ensureArray(resolvedEvidenceProfile.hardSkills),
  ]);
  const summary = cvProfile.summary || cvProfile.personalStatement || resolvedEvidenceProfile.sections?.personalStatement || '';
  const careerDirection = inferCareerDirection({ summary, skills, evidenceProfile: resolvedEvidenceProfile });
  const strongestEvidence = buildStrongestEvidence(resolvedEvidenceProfile);
  const transferableCompetencies = unique([
    ...ensureArray(resolvedEvidenceProfile.functionalCapabilities).map((item) => item.replace(/_/g, ' ')),
    ...ensureArray(resolvedEvidenceProfile.behaviouralCapabilities).map((item) => item.replace(/_/g, ' ')),
    ...ensureArray(resolvedEvidenceProfile.sections?.keyCompetencies),
  ]).slice(0, 8);
  const candidateIntro = truncate(
    summary
      ? `${summary} Main direction: ${careerDirection}.`
      : `${cvProfile.candidateName || 'Candidate'} should introduce themselves around ${careerDirection}.`,
    420
  );
  const suggestedInterviewHooks = unique([
    'self introduction and career direction',
    ...strongestEvidence.map((item) => item.label),
    ...skills.slice(0, 4),
    ...transferableCompetencies.slice(0, 3),
  ]).slice(0, 10);

  return {
    schemaVersion: 'cv_analysis_v1',
    candidateIntro,
    careerDirection,
    strongestEvidence,
    jdRelevantEvidence: ensureArray(cvProfile.cvAnalysis?.jdRelevantEvidence),
    transferableCompetencies,
    weakOrMissingEvidence: buildWeakEvidence({ evidenceProfile: resolvedEvidenceProfile, skills }),
    suggestedInterviewHooks,
    analysisSource: normalizedText ? 'parsed_cv_text' : 'parsed_cv_profile',
  };
};

export const buildJdMatchedCvAnalysis = ({ cvAnalysis = {}, requirementChecks = [], microScores = [] } = {}) => {
  const requirementEvidence = ensureArray(requirementChecks)
    .filter((item) => ['met', 'partial', 'inferred'].includes(item.status))
    .flatMap((item) => ensureArray(item.evidence).slice(0, 2).map((text) => ({
      requirement: item.label,
      status: item.status,
      evidence: truncate(evidenceText(text), 240),
    })))
    .filter((item) => item.evidence)
    .slice(0, 12);
  const partialOrGapTargets = ensureArray(requirementChecks)
    .filter((item) => item.status !== 'met')
    .map((item) => item.label);
  const strongMicroTargets = ensureArray(microScores)
    .filter((item) => Number(item.score) >= 45)
    .map((item) => item.label);

  return {
    ...cvAnalysis,
    jdRelevantEvidence: requirementEvidence,
    suggestedInterviewHooks: unique([
      ...ensureArray(cvAnalysis.suggestedInterviewHooks).slice(0, 3),
      ...requirementEvidence.map((item) => item.requirement),
      ...partialOrGapTargets,
      ...strongMicroTargets,
    ]).slice(0, 12),
  };
};
