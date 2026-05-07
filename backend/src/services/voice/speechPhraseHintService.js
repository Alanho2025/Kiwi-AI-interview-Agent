import { buildSpeechPhraseList } from '../../config/speechPhraseList.js';

const MAX_PHRASES = 120;
const MAX_PHRASE_LENGTH = 80;

const TECH_TOKEN_PATTERN = /\b(?:[A-Z][A-Za-z0-9]*\.?[A-Za-z0-9]*|[A-Za-z]+(?:\.js|JS)|[A-Za-z]+(?:SQL|API|SDK|AI|ML|UI|UX|DB)|[A-Za-z]+(?:[- ][A-Za-z0-9]+){1,3})\b/g;

const cleanPhrase = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/^[,.;:!?()[\]{}'"`]+|[,.;:!?()[\]{}'"`]+$/g, '')
  .trim();

const addPhrase = (phrases, value) => {
  const phrase = cleanPhrase(value);
  if (!phrase || phrase.length < 2 || phrase.length > MAX_PHRASE_LENGTH) return;
  if (/^(and|or|the|with|from|your|this|that|role|team|work)$/i.test(phrase)) return;
  phrases.add(phrase);
};

const addMany = (phrases, values = []) => {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    if (typeof value === 'string') {
      addPhrase(phrases, value);
    } else if (value && typeof value === 'object') {
      addPhrase(phrases, value.label || value.name || value.title || value.skill || value.keyword || value.value);
    }
  }
};

const addTextTokens = (phrases, value = '') => {
  const text = String(value || '');
  const matches = text.match(TECH_TOKEN_PATTERN) || [];
  for (const match of matches) addPhrase(phrases, match);
};

const addRubricPhrases = (phrases, rubric = {}) => {
  addMany(phrases, [
    rubric.title,
    rubric.jobTitle,
    rubric.roleCanonical,
    rubric.roleFamily,
    rubric.companyName,
  ]);
  addMany(phrases, rubric.mustHaveRequirements);
  addMany(phrases, rubric.niceToHaveExperience);
  addMany(phrases, rubric.qualifications);
  addMany(phrases, rubric.responsibilities);
  addMany(phrases, rubric.softSkills);
  addMany(phrases, rubric.benefits);

  const technicalSkills = rubric.sections?.technicalSkills || rubric.technicalSkills || {};
  if (Array.isArray(technicalSkills)) {
    addMany(phrases, technicalSkills);
  } else if (technicalSkills && typeof technicalSkills === 'object') {
    for (const items of Object.values(technicalSkills)) addMany(phrases, items);
  }
};

const addCvPhrases = (phrases, cvProfile = {}) => {
  addMany(phrases, cvProfile.skills);
  addMany(phrases, cvProfile.technicalSkills);
  addMany(phrases, cvProfile.tools);
  addMany(phrases, cvProfile.frameworks);
  addMany(phrases, cvProfile.certifications);
  addMany(phrases, cvProfile.education);
  addMany(phrases, cvProfile.projects);
  addTextTokens(phrases, JSON.stringify(cvProfile).slice(0, 8000));
};

const addPlanPhrases = (phrases, interviewPlan = {}) => {
  addMany(phrases, interviewPlan.interviewFocus);
  addMany(phrases, interviewPlan.strengths);
  addMany(phrases, interviewPlan.gaps);
  for (const item of interviewPlan.questionPool || []) {
    addPhrase(phrases, item.topic);
    addPhrase(phrases, item.matchedSkill);
    addMany(phrases, item.basedOnSkills);
    addTextTokens(phrases, item.text);
  }
};

export const buildSessionSpeechPhraseList = (session = {}) => {
  const phrases = new Set();
  const analysis = session.analysisResult || {};
  const rubric = analysis.parsedJdProfile || analysis.matchingDetails?.rubric || {};
  const hints = analysis.matchingDetails?.questionPlanHints || {};

  addMany(phrases, [
    session.targetRole,
    session.displayTitle,
    analysis.jobTitle,
    analysis.companyName,
    hints.roleCanonical,
  ]);
  addMany(phrases, analysis.interviewFocus);
  addMany(phrases, analysis.matchingDetails?.topMatchedSkills);
  addMany(phrases, analysis.planPreview?.topMatchedAreas);
  addMany(phrases, hints.priorityTopics);
  addMany(phrases, hints.followUpTargets);
  addMany(phrases, hints.mustProbeSkills);
  addMany(phrases, hints.mustProbeExperience);
  addMany(phrases, hints.mustProbeBehavioural);
  addRubricPhrases(phrases, rubric);
  addCvPhrases(phrases, analysis.parsedCvProfile || session.cvProfile || {});
  addPlanPhrases(phrases, session.interviewPlan || {});

  return buildSpeechPhraseList(Array.from(phrases)).slice(0, MAX_PHRASES);
};
