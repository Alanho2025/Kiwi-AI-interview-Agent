import { describe, expect, it } from 'vitest';

import {
  buildVoiceDurationAssessment,
  mapVoiceDurationToLevel,
  summarizeVoiceDurationAssessments,
} from '../../../src/services/report/voiceDurationAssessmentService.js';
import { buildDeterministicTurnBreakdowns, mergeTurnBreakdownsWithRubrics } from '../../../src/services/agents/reportGeneratorAgent.js';
import { buildInterviewMetrics } from '../../../src/services/agents/reportGenerator/reportEvidenceAnalysis.js';
import { buildReportTurnDataset } from '../../../src/services/report/reportTurnDatasetService.js';
import { computeInterviewPerformanceScore } from '../../../src/services/report/reportScoreService.js';

const buildAnswer = ({ seconds, inputMode = 'realtime_voice', extraMetadata = {} } = {}) => ({
  role: 'user',
  text: 'I delivered the change, checked the result, and explained what I learned.',
  metadata: {
    inputMode,
    turnType: 'user_answer',
    countsAsAnswer: true,
    transcriptAcceptance: { accepted: true },
    voiceDelivery: seconds === undefined ? {} : { speakingDurationSeconds: seconds },
    ...extraMetadata,
  },
});

const buildQuestion = ({ id = 'q-duration', questionFamily = 'past_example', turnKind = 'root_question' } = {}) => ({
  role: 'ai',
  text: `Tell me about example ${id}?`,
  questionId: id,
  metadata: {
    turnType: 'interview_question',
    countsAsQuestion: true,
    turnKind,
    followUpDepth: turnKind === 'follow_up' ? 1 : 0,
    questionFamily,
  },
});

describe('voice duration assessment service', () => {
  it.each([
    [59.99, 1, 0],
    [60, 2, 2.5],
    [69.99, 2, 2.5],
    [70, 3, 5],
    [79.99, 3, 5],
    [80, 4, 7.5],
    [89.99, 4, 7.5],
    [90, 5, 10],
    [100, 5, 10],
    [120, 5, 10],
    [120.01, 4, 7.5],
    [130, 4, 7.5],
    [130.01, 3, 5],
    [140, 3, 5],
    [140.01, 2, 2.5],
    [150, 2, 2.5],
    [150.01, 1, 0],
  ])('maps %s seconds to Level %s and %s points', (seconds, level, points) => {
    expect(mapVoiceDurationToLevel(seconds)).toBe(level);
    expect(buildVoiceDurationAssessment({
      questionTurnKind: 'root_question',
      answerTurn: buildAnswer({ seconds }),
    })).toMatchObject({
      eligible: true,
      reason: 'eligible_root_voice_answer',
      seconds,
      level,
      earnedPoints: points,
      maxPoints: 10,
    });
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    'does not turn invalid duration %s into a candidate zero',
    (seconds) => {
      const assessment = buildVoiceDurationAssessment({
        questionTurnKind: 'root_question',
        answerTurn: buildAnswer({ seconds }),
      });

      expect(assessment).toMatchObject({
        eligible: false,
        reason: 'duration_evidence_unavailable',
        seconds: null,
        level: null,
        earnedPoints: null,
        maxPoints: 10,
      });
    },
  );

  it.each([
    ['text', 'text_timing_deferred'],
    ['unknown_voice_mode', 'voice_mode_unverified'],
  ])('keeps %s outside duration scoring', (inputMode, reason) => {
    expect(buildVoiceDurationAssessment({
      questionTurnKind: 'root_question',
      answerTurn: buildAnswer({ seconds: 100, inputMode }),
    })).toMatchObject({
      eligible: false,
      reason,
      seconds: null,
      level: null,
      earnedPoints: null,
      maxPoints: 10,
    });
  });

  it('keeps follow-up duration outside the root-answer assessment', () => {
    expect(buildVoiceDurationAssessment({
      questionTurnKind: 'follow_up',
      answerTurn: buildAnswer({ seconds: 30 }),
    })).toMatchObject({
      eligible: false,
      reason: 'non_root_question',
      seconds: null,
      level: null,
      earnedPoints: null,
    });
  });

  it('accepts duplex voice as an eligible source mode', () => {
    expect(buildVoiceDurationAssessment({
      questionTurnKind: 'root_question',
      answerTurn: buildAnswer({ seconds: 100, inputMode: 'duplex_voice' }),
    })).toMatchObject({
      eligible: true,
      seconds: 100,
      level: 5,
      earnedPoints: 10,
    });
  });

  it.each(['self_intro', 'past_example', 'scenario', 'knowledge', 'motivation'])('does not depend on %s content framework', (questionFamily) => {
    const dataset = buildReportTurnDataset([
      buildQuestion({ id: `q-${questionFamily}`, questionFamily }),
      buildAnswer({ seconds: 100 }),
    ]);

    expect(dataset.questionAnswerPairs[0].voiceDurationAssessment).toMatchObject({
      eligible: true,
      level: 5,
      earnedPoints: 10,
    });
  });

  it('summarizes only eligible assessments and keeps stale aggregate-like fields irrelevant', () => {
    const summary = summarizeVoiceDurationAssessments([
      buildVoiceDurationAssessment({ questionTurnKind: 'root_question', answerTurn: buildAnswer({ seconds: 100 }) }),
      buildVoiceDurationAssessment({ questionTurnKind: 'root_question', answerTurn: buildAnswer({ seconds: 60 }) }),
      buildVoiceDurationAssessment({ questionTurnKind: 'follow_up', answerTurn: buildAnswer({ seconds: 30 }) }),
      buildVoiceDurationAssessment({ questionTurnKind: 'root_question', answerTurn: buildAnswer({ seconds: 100, inputMode: 'text' }) }),
    ]);

    expect(summary).toEqual({
      eligibleAnswerCount: 2,
      notApplicableAnswerCount: 2,
      averageEligibleDurationSeconds: 80,
      averageEligibleEarnedPoints: 6.25,
      targetRangeAnswerCount: 1,
      underTargetAnswerCount: 1,
      overTargetAnswerCount: 0,
      levelCounts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 },
      notApplicableReasonCounts: {
        non_root_question: 1,
        text_timing_deferred: 1,
      },
    });

    const dataset = buildReportTurnDataset([
      buildQuestion(),
      buildAnswer({ seconds: 100 }),
    ]);
    const metrics = buildInterviewMetrics({
      ...dataset,
      latestVoiceDeliverySummary: { averageSpeakingDurationSeconds: 40 },
    }, 1);

    expect(metrics.voiceDurationAssessmentSummary.averageEligibleDurationSeconds).toBe(100);
    expect(metrics).not.toHaveProperty('averageAnswerDurationSeconds');
    expect(metrics).not.toHaveProperty('overlongAnswerCount');
  });

  it('passes the same deterministic assessment through the turn breakdown and ignores model duration fields', async () => {
    const dataset = buildReportTurnDataset([
      buildQuestion(),
      buildAnswer({ seconds: 100 }),
    ]);
    const pair = dataset.questionAnswerPairs[0];
    const [breakdown] = await buildDeterministicTurnBreakdowns(dataset.questionAnswerPairs, [{ evidenceStrength: 2 }]);
    const [merged] = mergeTurnBreakdownsWithRubrics([
      {
        question: pair.questionTurn.text,
        answer: pair.answerTurn.text,
        feedback: 'Model feedback',
        voiceDurationAssessment: { eligible: true, seconds: 1, level: 1, earnedPoints: 0 },
      },
    ], [breakdown]);

    expect(breakdown.voiceDurationAssessment).toEqual(pair.voiceDurationAssessment);
    expect(merged.voiceDurationAssessment).toEqual(pair.voiceDurationAssessment);
  });

  it('does not change the current overall score when Phase 1 duration data is attached', () => {
    const baseTurn = {
      rubricType: 'role_specific',
      questionFamily: 'role_specific',
      frameworkBreakdown: { normalizedScore: 8 },
    };
    const withoutDuration = computeInterviewPerformanceScore({}, { turnBreakdowns: [baseTurn] });
    const withDuration = computeInterviewPerformanceScore({}, {
      turnBreakdowns: [{
        ...baseTurn,
        voiceDurationAssessment: {
          eligible: true,
          seconds: 100,
          level: 5,
          earnedPoints: 10,
          maxPoints: 10,
        },
      }],
    });

    expect(withDuration).toBe(withoutDuration);
  });
});
