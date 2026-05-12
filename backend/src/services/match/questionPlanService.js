import { unique } from './matchShared.js';
import { pickNzCultureQuestions } from '../../data/nzCultureQuestions.js';

export const buildQuestionPlanHints = ({ rubric, requirementChecks, microScores, settings = {}, cvEvidenceProfile = {}, transitionProfile = {}, cvAnalysis = {} }) => {
  const projectStack = (cvEvidenceProfile.sections?.projects || []).flatMap((item) => item.techStack || []).slice(0, 4);
  const cvHooks = (cvAnalysis.suggestedInterviewHooks || []).slice(0, 5);
  const jdEvidenceTargets = (cvAnalysis.jdRelevantEvidence || []).map((item) => item.requirement).filter(Boolean).slice(0, 5);
  const mustProbeSkills = unique([
    ...(rubric.interviewTargets?.prioritySkills || []).slice(0, 4),
    ...jdEvidenceTargets,
    ...requirementChecks.filter((item) => item.status !== 'met').slice(0, 3).map((item) => item.label),
    ...microScores.filter((item) => item.score >= 45 && item.score < 80).slice(0, 3).map((item) => item.label),
    ...projectStack,
  ]).slice(0, 7);

  const mustProbeExperience = unique([
    ...(rubric.interviewTargets?.experienceFocus || []).slice(0, 4),
    ...cvHooks,
    ...requirementChecks.filter((item) => /experience|project|production|stakeholder/i.test(item.label)).map((item) => item.label),
    ...(transitionProfile.careerTransitionSignal >= 0.7 ? ['career transition story', 'recent project depth'] : []),
  ]).slice(0, 6);

  const nzEnabled = Boolean(settings.enableNZCultureFit);
  const nzQuestions = nzEnabled
    ? pickNzCultureQuestions({ difficulty: rubric.roleLevel || 'all', count: 2 })
    : [];
  const nzBehaviouralHints = nzQuestions.map((q) => q.dimension.replace(/_/g, ' '));

  const mustProbeBehavioural = unique([
    ...(rubric.interviewTargets?.behaviouralFocus || []).slice(0, 4),
    ...nzBehaviouralHints,
    ...((cvEvidenceProfile.behaviouralCapabilities || []).map((item) => item.replace(/_/g, ' '))),
  ]).slice(0, 8);

  return {
    roleCanonical: rubric.roleCanonical,
    roleFamily: rubric.roleFamily,
    roleLevel: rubric.roleLevel,
    mustProbeSkills,
    mustProbeExperience,
    mustProbeBehavioural,
    priorityTopics: unique([...jdEvidenceTargets, ...mustProbeSkills, ...mustProbeExperience]).slice(0, 8),
    followUpTargets: unique(['self introduction and career direction', ...cvHooks, ...jdEvidenceTargets, ...projectStack]).slice(0, 8),
    avoidTopics: [],
    followUpAnchors: unique([...jdEvidenceTargets.slice(0, 3), ...mustProbeSkills.slice(0, 3), ...mustProbeExperience.slice(0, 2), ...projectStack.slice(0, 2)]),
    orderedStages: ['opening', 'technical_core', 'experience_deep_dive', 'project_validation', 'behavioural', 'gap_probe', 'wrap_up'],
    nzCultureQuestions: nzQuestions,
  };
};
