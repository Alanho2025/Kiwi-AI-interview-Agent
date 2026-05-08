import { normalizeCvEvidence } from './cvEvidenceNormalizer.js';
import { buildCvSignals } from './cvSignalExtractor.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const unique = (items = []) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

const normalizeProjects = (projects = []) => ensureArray(projects).map((item) => {
  if (typeof item === 'string') return { title: item, summary: item };
  return {
    title: item?.title || item?.name || 'Project',
    summary: item?.summary || item?.description || item?.responsibilities || '',
    techStack: ensureArray(item?.techStack || item?.tools || item?.skills),
  };
});

const normalizeWorkHistory = (workHistory = []) => ensureArray(workHistory).map((item) => {
  if (typeof item === 'string') return { summary: item };
  return {
    title: item?.title || item?.role || '',
    company: item?.company || '',
    summary: item?.summary || item?.description || item?.responsibilities || '',
  };
});

export const buildNormalizedCvProfile = (parsedCv = {}, session = {}) => {
  const signals = buildCvSignals(parsedCv);
  const cvAnalysis = parsedCv.cvAnalysis || {};
  return {
    candidateHeadline: parsedCv.candidateHeadline || parsedCv.headline || parsedCv.candidateName || session.candidateName || 'Candidate',
    candidateIntro: cvAnalysis.candidateIntro || parsedCv.summary || parsedCv.personalStatement || '',
    careerDirection: cvAnalysis.careerDirection || '',
    roleSignals: signals.roleSignals,
    skills: unique(signals.skills),
    tools: unique(signals.tools),
    capabilities: unique([...ensureArray(parsedCv.capabilities), ...signals.capabilities]),
    strongestEvidence: ensureArray(cvAnalysis.strongestEvidence),
    jdRelevantEvidence: ensureArray(cvAnalysis.jdRelevantEvidence),
    suggestedInterviewHooks: ensureArray(cvAnalysis.suggestedInterviewHooks),
    weakOrMissingEvidence: ensureArray(cvAnalysis.weakOrMissingEvidence),
    projects: normalizeProjects(parsedCv.projects),
    achievements: ensureArray(parsedCv.achievements).map((item) => typeof item === 'string' ? item : item?.summary || item?.text || '').filter(Boolean),
    workHistory: normalizeWorkHistory(parsedCv.workHistory || parsedCv.experience || parsedCv.sections?.experience),
    education: ensureArray(parsedCv.education),
    evidenceProfile: normalizeCvEvidence({
      ...parsedCv,
      projects: normalizeProjects(parsedCv.projects),
      workHistory: normalizeWorkHistory(parsedCv.workHistory || parsedCv.experience || parsedCv.sections?.experience),
      achievements: ensureArray(parsedCv.achievements).map((item) => typeof item === 'string' ? item : item?.summary || item?.text || '').filter(Boolean),
      skills: unique(signals.skills),
      capabilities: unique([...ensureArray(parsedCv.capabilities), ...signals.capabilities]),
    }),
    sourceMeta: {
      schemaVersion: parsedCv.schemaVersion || 'cv_profile_v1',
      rawLength: parsedCv.rawLength || 0,
      confidence: parsedCv.confidence || 0,
    },
  };
};
