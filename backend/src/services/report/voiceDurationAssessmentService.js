import { ensureArray, normalizeKey } from '../../utils/commonHelpers.js';

const VOICE_INPUT_MODES = new Set(['realtime_voice', 'duplex_voice']);
const LEVEL_TO_POINTS = {
  1: 0,
  2: 2.5,
  3: 5,
  4: 7.5,
  5: 10,
};

const buildNotApplicableAssessment = (reason) => ({
  eligible: false,
  reason,
  seconds: null,
  level: null,
  earnedPoints: null,
  maxPoints: 10,
});

const roundToTwoDecimals = (value) => Number(value.toFixed(2));

const average = (items, selector) => {
  if (!items.length) return null;
  return roundToTwoDecimals(items.reduce((sum, item) => sum + selector(item), 0) / items.length);
};

export const mapVoiceDurationToLevel = (rawSeconds) => {
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60 || seconds > 150) return 1;
  if (seconds < 70 || seconds > 140) return 2;
  if (seconds < 80 || seconds > 130) return 3;
  if (seconds < 90 || seconds > 120) return 4;
  return 5;
};

export const buildVoiceDurationAssessment = ({ questionTurnKind, answerTurn = {} } = {}) => {
  if (questionTurnKind !== 'root_question') {
    return buildNotApplicableAssessment('non_root_question');
  }

  const inputMode = normalizeKey(answerTurn.metadata?.inputMode);
  if (inputMode === 'text') {
    return buildNotApplicableAssessment('text_timing_deferred');
  }
  if (!VOICE_INPUT_MODES.has(inputMode)) {
    return buildNotApplicableAssessment('voice_mode_unverified');
  }

  const seconds = Number(answerTurn.metadata?.voiceDelivery?.speakingDurationSeconds);
  const level = mapVoiceDurationToLevel(seconds);
  if (level === null) {
    return buildNotApplicableAssessment('duration_evidence_unavailable');
  }

  return {
    eligible: true,
    reason: 'eligible_root_voice_answer',
    seconds,
    level,
    earnedPoints: LEVEL_TO_POINTS[level],
    maxPoints: 10,
  };
};

export const summarizeVoiceDurationAssessments = (assessments = []) => {
  const all = ensureArray(assessments);
  const eligible = all.filter((assessment) => assessment?.eligible === true);
  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const notApplicableReasonCounts = {};

  eligible.forEach((assessment) => {
    levelCounts[assessment.level] += 1;
  });

  all.filter((assessment) => assessment?.eligible !== true).forEach((assessment) => {
    const reason = assessment?.reason || 'unknown';
    notApplicableReasonCounts[reason] = (notApplicableReasonCounts[reason] || 0) + 1;
  });

  return {
    eligibleAnswerCount: eligible.length,
    notApplicableAnswerCount: all.length - eligible.length,
    averageEligibleDurationSeconds: average(eligible, (assessment) => assessment.seconds),
    averageEligibleEarnedPoints: average(eligible, (assessment) => assessment.earnedPoints),
    targetRangeAnswerCount: eligible.filter((assessment) => assessment.seconds >= 90 && assessment.seconds <= 120).length,
    underTargetAnswerCount: eligible.filter((assessment) => assessment.seconds < 90).length,
    overTargetAnswerCount: eligible.filter((assessment) => assessment.seconds > 120).length,
    levelCounts,
    notApplicableReasonCounts,
  };
};
