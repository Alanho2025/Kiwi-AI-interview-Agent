/**
 * File responsibility: Resolve interview session settings into one backend contract.
 * Main responsibilities:
 * - Keep question count, time-boxed length, level, and question type in one object.
 * - Prevent interview controllers from silently falling back to default 8-question settings.
 * - Preserve the current product model where 15 minutes maps to 8 planned questions and 30 minutes maps to 15 planned questions.
 */

import {
  normalizeControlMode,
  normalizeFocusAreaKey,
  normalizeQuestionLimit,
  normalizeSeniorityLevelKey,
  normalizeTimeLimitMinutes,
  resolveInterviewModeConfig,
} from '../../config/interviewBlueprints.js';

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
const toMinutes = (seconds) => {
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed / 60);
};

export const resolveInterviewSessionConfig = (session = {}) => {
  const settings = session?.settings || {};
  const seniorityLevel = firstDefined(settings.seniorityLevel, settings.level, session.seniorityLevel, session.level, 'junior');
  const focusArea = firstDefined(settings.questionType, settings.focusArea, session.questionType, session.focusArea, 'combined');
  const controlMode = normalizeControlMode(firstDefined(session.controlMode, settings.controlMode, 'question_limited'));
  const derivedMinutes = toMinutes(firstDefined(session.timeLimitSeconds, settings.timeLimitSeconds));
  const timeLimitMinutes = normalizeTimeLimitMinutes(firstDefined(
    session.timeLimitMinutes,
    settings.timeLimitMinutes,
    derivedMinutes,
    15,
  ));
  const questionLimit = normalizeQuestionLimit(firstDefined(
    session.questionLimit,
    session.totalQuestions,
    settings.questionLimit,
    settings.totalQuestions,
    8,
  ));

  const modeConfig = resolveInterviewModeConfig({
    seniorityLevel,
    focusArea,
    questionType: focusArea,
    controlMode,
    questionLimit,
    timeLimitMinutes,
  });

  return {
    ...modeConfig,
    sessionContractType: controlMode === 'time_limited' ? 'time_boxed' : 'question_limited',
    estimatedMinutes: controlMode === 'time_limited' ? modeConfig.timeLimitMinutes : null,
    plannedQuestionCount: modeConfig.totalQuestions,
    questionType: normalizeFocusAreaKey(focusArea),
    seniorityLevel: normalizeSeniorityLevelKey(seniorityLevel),
  };
};

export default resolveInterviewSessionConfig;
