import fs from 'node:fs/promises';
import path from 'node:path';
import { buildInterviewEnvironment } from '../../src/services/aiControl/interviewEnvironmentService.js';
import { evaluateInterviewTurn } from '../../src/services/aiControl/interviewEvaluatorService.js';
import { selectNextAction } from '../../src/services/aiControl/actionPlanner.js';
import { deriveDynamicSlots } from '../../src/services/aiControl/dynamicSlotService.js';
import { deriveAbductiveState } from '../../src/services/aiControl/abductiveReasoningService.js';
import { inferInterviewSection, buildSectionState } from '../../src/services/aiControl/sectionPlannerService.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/interview-controller-eval.json');
const reportRoot = path.join(repoRoot, 'eval/reports');

const parseArgs = (argv = []) => {
  const options = { minAverage: 0, failBelow: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--min-average') options.minAverage = Number(argv[index + 1] || 0);
    if (value === '--fail-below') options.failBelow = Number(argv[index + 1] || 0);
  }
  return options;
};

const buildCoverageState = (session = {}) => {
  const aiTurns = (session.transcript || []).filter((turn) => turn.role === 'ai');
  const coveredTopics = [...new Set(aiTurns.map((turn) => turn.metadata?.topic).filter(Boolean))];
  const missingTopics = (session.analysisResult?.matchingDetails?.questionPlanHints?.priorityTopics || []).filter((topic) => !coveredTopics.includes(topic));
  return { coveredTopics, missingTopics, weakAreas: session.analysisResult?.explanation?.gaps || [] };
};

const scoreCase = ({ evaluatorOutput, plan, expected }) => {
  const checks = [
    { label: 'suggestedNextMode', passed: evaluatorOutput.suggestedNextMode === expected.suggestedNextMode },
    { label: 'selectedAction', passed: plan.selectedAction === expected.selectedAction },
  ];
  const earned = checks.filter((item) => item.passed).length;
  return { earned, possible: checks.length, score: Number((earned / checks.length).toFixed(2)), checks };
};

const options = parseArgs(process.argv.slice(2));
const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = [];

for (const item of dataset) {
  const environment = buildInterviewEnvironment({ session: item.session });
  const evaluatorOutput = evaluateInterviewTurn({ environment });
  const coverageState = buildCoverageState(item.session);
  const dynamicSlotState = deriveDynamicSlots({ latestAnswer: environment.latestAnswer.text, coverageState, existingState: { activeSlots: [], activeSlotTopics: [], prunedSlots: [] } });
  const currentTopic = environment.questionContext.latestQuestionTopic || dynamicSlotState.activeSlotTopics?.[0] || coverageState.missingTopics?.[0] || 'role_fit';
  const candidateState = { specificityLevel: evaluatorOutput.specificity };
  const abductiveState = deriveAbductiveState({ latestAnswer: environment.latestAnswer.text, currentTopic, candidateState, dynamicSlotState });
  const currentSection = inferInterviewSection({ currentStage: environment.questionContext.latestQuestionStage, currentTopic, coverageState, dynamicSlotState });
  const sectionState = buildSectionState({ currentSection, coverageState, dynamicSlotState });
  const plan = selectNextAction({
    taskType: 'interview_next_turn',
    currentStage: environment.questionContext.latestQuestionStage,
    currentTopic,
    candidateState,
    evaluatorState: evaluatorOutput,
    coverageState,
    matchState: { validationTargets: item.session.analysisResult?.matchingDetails?.validationTargets || [] },
    dynamicSlotState,
    abductiveState,
    sectionState,
  });
  const score = scoreCase({ evaluatorOutput, plan, expected: item.expected });
  results.push({
    id: item.id,
    suggestedNextMode: evaluatorOutput.suggestedNextMode,
    selectedAction: plan.selectedAction,
    score: score.score,
    earned: score.earned,
    possible: score.possible,
    failedChecks: score.checks.filter((check) => !check.passed).map((check) => check.label),
  });
}

const average = results.length ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2)) : 0;
const weakestCases = results.filter((item) => item.score < 1).map((item) => ({ id: item.id, score: item.score, failedChecks: item.failedChecks }));
const summary = { casesRun: results.length, average, weakestCases, thresholds: options, results };

await fs.mkdir(reportRoot, { recursive: true });
const jsonPath = path.join(reportRoot, 'interview-controller-eval.latest.json');
const mdPath = path.join(reportRoot, 'interview-controller-eval.latest.md');
await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(mdPath, [
  '# Interview Controller Eval Summary',
  '',
  `- Cases run: ${summary.casesRun}`,
  `- Average score: ${summary.average}`,
  '',
  ...summary.results.map((item) => `- ${item.id}: ${item.score} | action=${item.selectedAction} | mode=${item.suggestedNextMode}${item.failedChecks.length ? ` | failed: ${item.failedChecks.join(', ')}` : ''}`),
  '',
].join('\n'));

console.log('Interview controller eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown report: ${mdPath}`);

const averageFailed = options.minAverage > 0 && average < options.minAverage;
const caseFailed = options.failBelow > 0 && results.some((item) => item.score < options.failBelow);
if (averageFailed || caseFailed) process.exit(1);
