/**
 * File responsibility: Execute one end-to-end Kiwi interview evaluation scenario.
 * Main responsibilities:
 * - Check interview flow, setting adherence, question quality, and report grounding together.
 * - Catch product-level regressions that module-only tests miss.
 * - Return transparent failed checks and sub-scores for debugging.
 */

import { judgeQuestionQuality } from '../helpers/questionQualityJudge.js';
import { judgeReportGrounding } from '../helpers/reportGroundingJudge.js';
import { buildScenarioEnvironment } from './environmentBuilder.js';

const normalize = (value = '') => String(value || '').toLowerCase().replace('behavioral', 'behavioural');
const includesAll = (actual = [], expected = []) => expected.every((item) => actual.includes(normalize(item)));
const excludesAll = (actual = [], blocked = []) => blocked.every((item) => !actual.includes(normalize(item)));
const hasDuplicates = (items = []) => new Set(items.map((item) => normalize(item))).size !== items.length;
const scoreChecks = (checks = []) => {
  const earned = checks.filter((check) => check.passed).length;
  return { earned, possible: checks.length, score: checks.length ? Number((earned / checks.length).toFixed(2)) : 1 };
};
const judgeAllQuestions = (environment) => {
  const scoredQuestions = environment.questions.map((question, index) => judgeQuestionQuality({ question, previousQuestions: environment.questions.slice(0, index), cvProfile: environment.cvProfile, jdProfile: environment.jdProfile, expectedDifficulty: environment.settings.difficulty }));
  const average = scoredQuestions.length ? Number((scoredQuestions.reduce((sum, item) => sum + item.score, 0) / scoredQuestions.length).toFixed(2)) : 0;
  return { score: average, failedChecks: scoredQuestions.flatMap((item, index) => item.failedChecks.map((label) => `q${index + 1}:${label}`)), details: scoredQuestions };
};

export const runInterviewScenario = (scenario = {}) => {
  const environment = buildScenarioEnvironment(scenario);
  const expected = environment.expected;
  const plannedQuestionCount = Number(expected.plannedQuestionCount || environment.settings.questionCount || 0);
  const flowChecks = [
    { label: 'has_ai_questions', passed: environment.aiTurns.length > 0 },
    { label: 'starts_with_self_intro', passed: !expected.firstAiTopic || normalize(environment.aiTurns[0]?.metadata?.topic) === normalize(expected.firstAiTopic) },
    { label: 'question_count_matches_setting', passed: !plannedQuestionCount || environment.aiTurns.length === plannedQuestionCount },
    { label: 'has_user_answers_before_final_turn', passed: environment.userTurns.length >= Math.max(1, environment.aiTurns.length - 1) },
    { label: 'no_duplicate_questions', passed: !hasDuplicates(environment.questions) },
    { label: 'required_categories_present', passed: includesAll(environment.categories, expected.requiredCategories || []) },
    { label: 'blocked_categories_absent', passed: excludesAll(environment.categories, expected.blockedCategories || []) },
    { label: 'required_topics_present', passed: includesAll(environment.topics, expected.requiredTopics || []) },
  ];
  const flowScore = scoreChecks(flowChecks);
  const questionJudge = judgeAllQuestions(environment);
  const reportJudge = judgeReportGrounding({ report: environment.report, transcript: environment.transcript, analysisResult: { parsedCvProfile: environment.cvProfile, parsedJdProfile: environment.jdProfile }, forbiddenClaims: expected.forbiddenClaims || [] });
  const rawScore = Number(((flowScore.score * 0.45) + (questionJudge.score * 0.25) + (reportJudge.score * 0.3)).toFixed(2));
  const isNegativeProbe = expected.shouldPass === false;
  const maxPassingScore = Number(expected.maxPassingScore || 0.7);
  const score = isNegativeProbe ? Number((rawScore <= maxPassingScore ? 1 : 0).toFixed(2)) : rawScore;
  const detectionFailures = isNegativeProbe && rawScore > maxPassingScore ? ['negative_probe_not_caught'] : [];
  return {
    id: environment.id,
    score,
    rawScore,
    expectedOutcome: isNegativeProbe ? 'should_fail_quality_checks' : 'should_pass_quality_checks',
    subScores: { flow: flowScore.score, questionQuality: questionJudge.score, reportGrounding: reportJudge.score },
    failedChecks: [...flowChecks.filter((check) => !check.passed).map((check) => check.label), ...questionJudge.failedChecks, ...reportJudge.failedChecks.map((label) => `report:${label}`), ...detectionFailures],
    diagnostics: { plannedQuestionCount, actualQuestionCount: environment.aiTurns.length, categories: environment.categories, topics: environment.topics, forbiddenReportClaims: reportJudge.forbiddenHits, unknownSkillClaims: reportJudge.skillClaims },
  };
};
