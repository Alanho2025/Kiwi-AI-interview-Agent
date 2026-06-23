# Constructive Report Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make constructive reports count only real interview answers, select the correct rubric for each actual question, score evidence consistently, generate readable grounded rewrites, expose useful evidence sources, and export a complete trustworthy PDF.

**Architecture:** Build one canonical report-turn dataset from explicit transcript turn metadata, then feed that same dataset into evidence analysis, rubric scoring, metrics, QA, UI, and PDF export. Keep numeric scores and framework selection deterministic; use the LLM only for candidate-facing wording and grounded rewrite naturalisation. Preserve raw ASR text and correction provenance, and fail visibly when candidate-facing content does not pass deterministic quality checks.

**Tech Stack:** Node.js, Express services, MongoDB transcript/report documents, Vitest, React, Vite, jsPDF, Poppler visual verification.

---

## Confirmed defects this plan must close

1. `classifyEvidenceType` treats any `I can` or `I would` phrase as hypothetical before checking completed work. This misclassifies answers that include real projects and later describe transferability.
2. The action matcher misses normal verbs from noisy speech such as `tried`, `used`, `found`, `realised`, `changed`, `shared`, and `gave`.
3. The STARR result matcher cannot award the unit point for `15%` because `%` is wrapped in a trailing word boundary. It also awards result credit for an unquantified mention of `user`.
4. Reflection credit is awarded for any `learned` or `better` token, even when the candidate is describing a teammate or a product rather than their own lesson.
5. Follow-up questions inherit `questionFamily` and `evidenceMode` from their parent. A project-validation follow-up after an opening or motivation turn can therefore be scored with the motivation rubric.
6. `inferTurnRubric` currently trusts stale metadata before an unambiguous validation or past-example question. This regressed the earlier question-first safeguard.
7. Full STARR is applied to targeted follow-ups such as “what was the outcome?” and “what trade-offs did you consider?”, unfairly penalising the candidate for not repeating context that the interviewer already has.
8. Report metrics analyse every raw user turn and use a loose AI-question detector instead of the explicit turn-counting contract. Repair, confirmation, clarification, or legacy turns can contaminate evidence totals and completion.
9. The PDF deliberately renders only `turns.slice(0, 8)` without saying that later scored turns were omitted.
10. “Overall role fit” in the evidence snapshot uses the CV-JD score (`64.30`) rather than the blended overall score (`58.60`).
11. LLM output can overwrite deterministic plain-English metric values and display strings.
12. The deterministic “Stronger version” fallback contains Chinese bracket prompts. jsPDF’s standard font cannot encode them, causing visible mojibake. The fallback is a scaffold, not a stronger answer.
13. Report QA checks only whether rewrite examples exist. It does not reject placeholders, mojibake, unreadable text, wrong-question rewrites, or excessive length.
14. The evidence appendix ignores `claimText` and `evidenceSnippets`, slices generic analysis references before grounded claim references, and rewards duplicate generic references in the QA coverage score.
15. The report does not visibly explain ASR uncertainty even when names, technical terms, or repeated numeric claims conflict.

## Product decisions

- A real example is present when an accepted answer contains completed-work context plus personal action or an observed outcome. A later future-looking transfer statement must not erase that evidence.
- “Hypothetical” means hypothetical-only. Mixed answers retain their real-example signal and may separately carry a future-intent signal.
- Only accepted `user_answer` turns paired with countable `interview_question` turns enter report scoring.
- Repair prompts, transcript confirmations, clarification replies, repeat requests, system messages, and acknowledgements do not enter completion or evidence totals.
- Root behavioural questions use full STARR. Targeted behavioural follow-ups score only their requested dimension. Validation, technical-depth, trade-off, constraint, and friction follow-ups use role-specific reasoning.
- Numeric report values and rubric contracts are deterministic and cannot be rewritten by the LLM.
- A “Stronger version” must be readable English, answer the same question, use only supplied evidence, contain no bracket prompts, and stay at or below 120 words. Otherwise the section shows an explicit unavailable state.
- Raw transcript text is preserved. Normalisation is conservative and auditable. Conflicting numbers are flagged for confirmation, never silently rewritten.
- The PDF contains every scored turn. If a future product limit is introduced, it must state `Showing X of Y` and link the omission to an explicit reason.

## File map

### New backend modules

- `backend/src/services/report/reportTurnDatasetService.js`: pair countable questions with accepted answers and expose one canonical dataset.
- `backend/src/services/report/answerEvidenceSignalService.js`: extract past context, personal action, validation, measurable result, future intent, and reflection signals.
- `backend/src/services/questions/questionAssessmentContractService.js`: resolve assessment family, evidence mode, and targeted dimensions from the actual question intent.
- `backend/src/services/report/reportScoreService.js`: compute and own final report scores before candidate-facing metric construction.
- `backend/src/services/report/reportContentQualityService.js`: validate rewrites, evidence rows, metric consistency, and candidate-facing text.
- `backend/src/services/report/reportEvidenceReferenceService.js`: produce deduplicated claim/source/snippet/confidence evidence rows.
- `backend/src/services/report/reportTranscriptRiskService.js`: detect ASR entity mismatches and conflicting numeric claims without changing meaning.

### Existing backend modules to modify

- `backend/src/services/agents/reportGeneratorAgent.js`
- `backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js`
- `backend/src/services/agents/reportGenerator/reportMetricBuilder.js`
- `backend/src/services/agents/reportGenerator/reportFeedbackBuilder.js`
- `backend/src/services/agents/reportGenerator/reportCoachingBuilder.js`
- `backend/src/services/agents/reportGenerator/reportDraftBuilder.js`
- `backend/src/services/aiControl/starRubricService.js`
- `backend/src/services/questions/interviewTurnOrchestratorService.js`
- `backend/src/services/agents/interviewerAgent.js`
- `backend/src/services/report/turnRubricService.js`
- `backend/src/services/reportCoachingService.js`
- `backend/src/services/agents/reportQaAgent.js`
- `backend/src/services/report/reportQaRepairOrchestratorService.js`
- `backend/src/services/report/claimGroundingService.js`
- `backend/src/services/schemaValidationService.js`
- `backend/src/utils/schemaHelpers.js`
- `backend/src/services/voice/speechPhraseHintService.js`
- `backend/src/services/voice/transcriptNormalizer.js`
- `backend/src/services/voice/duplexVoiceAgentService.js`
- `backend/src/services/voice/duplexTurnCoordinator.js`
- `backend/src/services/voice/realtimeVoiceTurnService.js`

### Frontend modules to modify or add

- `frontend/src/utils/reportPdf/reportPdfTemplate.js`
- `frontend/src/utils/reportView/viewModel.js`
- `frontend/src/utils/reportView/insights.js`
- `frontend/src/components/report/InsightsSection.jsx`
- `frontend/src/components/report/TurnBreakdownSection.jsx`
- `frontend/src/components/report/AnswerRewriteSection.jsx`
- `frontend/src/components/report/ReportHeroCard.jsx`
- Create `frontend/src/components/report/EvidenceSourcesSection.jsx`
- `frontend/src/pages/ReportPage.jsx`

### Regression and quality tests

- Create `backend/tests/fixtures/report/constructiveReportRegressionFixture.js`
- Create `backend/tests/robustness/report/reportTurnDatasetRobustness.test.js`
- Create `backend/tests/robustness/report/reportEvidenceClassificationRobustness.test.js`
- Create `backend/tests/robustness/report/reportContentQualityRobustness.test.js`
- Modify `backend/tests/robustness/agent/starRubricRobustness.test.js`
- Modify `backend/tests/robustness/report/reportFrameworkPipeline.test.js`
- Modify `backend/tests/robustness/report/reportFrameworkQa.test.js`
- Modify `backend/tests/robustness/questions/questionMetadataPersistence.test.js`
- Modify `backend/tests/unit/transcriptNormalizer.test.js`
- Modify `backend/eval/datasets/report-qa-eval.json`
- Modify `frontend/src/api/__tests__/reportApi.test.js`
- Modify `frontend/src/utils/__tests__/reportTurnFrameworkFormatter.test.js`
- Create `frontend/src/components/report/__tests__/AnswerRewriteSection.test.jsx`
- Create `frontend/src/components/report/__tests__/EvidenceSourcesSection.test.jsx`

## UI/UX change brief requiring approval before implementation

**User problem:** The current report looks polished but hides omitted turns, mixes CV and interview signals, shows unreadable rewrites, and presents source labels without evidence. This makes the user unable to audit why a score was produced.

**Screens/components affected:** Report page hero, insight cards, strengths card, turn-by-turn breakdown, answer rewrite section, new evidence sources section, and exported PDF.

**Layout and interaction:**

- Keep the three top score cards, but label them `Overall`, `CV-JD match`, and `Interview evidence` and use the same values everywhere.
- Add a compact amber transcript-quality banner only when ASR risks exist; include the affected turns and state that raw text is preserved.
- Rename `What You Did Well` to `Evidence-backed strengths`, with a visible source chip (`CV`, `JD`, or `Answer Q6`) and one snippet.
- Show all turn cards. Targeted follow-ups display `Scored focus: Result`, `Scored focus: Validation`, or `Scored focus: Trade-offs` instead of irrelevant zeroes.
- Render an unavailable rewrite as a neutral notice with a regenerate action; never render invalid content under `Stronger version`.
- Add an evidence table with `Claim`, `Source`, `Evidence snippet`, and `Confidence` columns.
- Use neutral green/blue for supported evidence, amber for uncertainty, and red only for blocking integrity failures.

**Visual direction:** Evidence-first and audit-friendly. The report should feel like a professional assessment record, with restrained status colour, short labels, visible provenance, and no generic repeated cards.

---

### Task 1: Add a privacy-safe regression fixture

**Files:**
- Create: `backend/tests/fixtures/report/constructiveReportRegressionFixture.js`

- [ ] **Step 1: Add the sanitised fixture**

```js
export const constructiveReportRegressionTranscript = [
  {
    role: 'ai',
    text: 'Can you walk me through a specific example of how you validated that the feedback helped a candidate improve?',
    questionId: 'q-validation',
    metadata: {
      turnType: 'interview_question', countsAsQuestion: true, turnKind: 'follow_up',
      followUpIntent: 'validation', questionFamily: 'motivation', topic: 'company_and_role_motivation',
    },
  },
  {
    role: 'user',
    text: 'I separated introduction, technical, and behavioural feedback, but I did not run a before-and-after candidate validation.',
    metadata: { turnType: 'user_answer', countsAsQuestion: true },
  },
  {
    role: 'ai',
    text: 'What was the hardest friction point in that project?',
    questionId: 'q-friction',
    metadata: {
      turnType: 'interview_question', countsAsQuestion: true, turnKind: 'follow_up',
      followUpIntent: 'failure', topic: 'company_and_role_motivation',
    },
  },
  {
    role: 'user',
    text: 'The voice flow started at around 12 seconds. I tried console logging across frontend, backend, speech-to-text, and Azure Speech, found delays in answer understanding and question generation, changed the intermediate routing, and brought latency down to around 3 seconds.',
    metadata: { turnType: 'user_answer', countsAsQuestion: true },
  },
  {
    role: 'ai',
    text: 'Tell me about a time you showed ownership. What did you do and what changed?',
    questionId: 'q-ownership',
    metadata: {
      turnType: 'interview_question', countsAsQuestion: true, turnKind: 'root_question',
      questionFamily: 'behavioural', topic: 'ownership',
    },
  },
  {
    role: 'user',
    text: 'In a food recommendation app, I owned the chatbot and recommendation work. I also shared prompt examples, constraints, and a test-driven workflow with my teammate. The application was really great.',
    metadata: { turnType: 'user_answer', countsAsQuestion: true },
  },
  {
    role: 'ai',
    text: 'Tell me about a time you had to show collaboration.',
    questionId: 'q-collaboration',
    metadata: {
      turnType: 'interview_question', countsAsQuestion: true, turnKind: 'root_question',
      questionFamily: 'behavioural', topic: 'collaboration',
    },
  },
  {
    role: 'user',
    text: 'In my previous role I worked with an engineer, operators, product design, and engineering teams. I designed an experiment with 40 to 50 units, analysed the results, and reduced the retest rate from 15% to 5%. I can bring that stakeholder consultation approach into clinic workflow automation.',
    metadata: { turnType: 'user_answer', countsAsQuestion: true },
  },
];

export const repairTurnsThatMustNotCount = [
  { role: 'ai', text: 'Did I understand that correctly?', metadata: { turnType: 'transcript_confirmation', countsAsQuestion: false } },
  { role: 'user', text: 'Yes, that is correct.', metadata: { turnType: 'transcript_confirmation', countsAsQuestion: false } },
];
```

- [ ] **Step 2: Verify the fixture contains no candidate name, session UUID, employer name, or uploaded document text**

Run:

```bash
rg -n '62269744|Alan Ho|Auckland Eye|Apple|Foxconn' backend/tests/fixtures/report/constructiveReportRegressionFixture.js
```

Expected: no output and exit code `1`.

- [ ] **Step 3: Commit the fixture with the first failing report tests, not by itself**

---

### Task 2: Build one canonical report-turn dataset

**Files:**
- Create: `backend/src/services/report/reportTurnDatasetService.js`
- Create: `backend/tests/robustness/report/reportTurnDatasetRobustness.test.js`
- Modify: `backend/src/services/agents/reportGeneratorAgent.js:31-71,251-258`

- [ ] **Step 1: Write failing tests for accepted answers and repair exclusion**

```js
import { describe, expect, it } from 'vitest';
import { buildReportTurnDataset } from '../../../src/services/report/reportTurnDatasetService.js';
import {
  constructiveReportRegressionTranscript,
  repairTurnsThatMustNotCount,
} from '../../fixtures/report/constructiveReportRegressionFixture.js';

describe('report turn dataset', () => {
  it('pairs only countable interview questions with accepted answers', () => {
    const dataset = buildReportTurnDataset([
      ...constructiveReportRegressionTranscript.slice(0, 2),
      ...repairTurnsThatMustNotCount,
      ...constructiveReportRegressionTranscript.slice(2),
    ]);

    expect(dataset.questionAnswerPairs).toHaveLength(4);
    expect(dataset.acceptedAnswers).toHaveLength(4);
    expect(dataset.repairTurnCount).toBe(2);
    expect(dataset.questionAnswerPairs.map((item) => item.questionId)).toEqual([
      'q-validation', 'q-friction', 'q-ownership', 'q-collaboration',
    ]);
  });

  it('does not count an unpaired confirmation reply as an answer', () => {
    const dataset = buildReportTurnDataset(repairTurnsThatMustNotCount);
    expect(dataset.scoredAnswerCount).toBe(0);
    expect(dataset.countableQuestionCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/robustness/report/reportTurnDatasetRobustness.test.js
```

Expected: FAIL because `reportTurnDatasetService.js` does not exist.

- [ ] **Step 3: Implement explicit turn eligibility and pairing**

```js
import { buildQuestionHistory } from '../questions/questionDeduplicationService.js';
import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';

const EXCLUDED_USER_TURN_TYPES = new Set([
  'repair_prompt', 'transcript_confirmation', 'clarification',
  'repeat_request', 'system', 'bridge_acknowledgement', 'acknowledgement',
]);

const isAcceptedAnswer = (turn = {}) => {
  if (normalizeKey(turn.role) !== 'user' || !normalizeText(turn.text)) return false;
  const metadata = turn.metadata || {};
  if (metadata.countsAsQuestion === false) return false;
  if (EXCLUDED_USER_TURN_TYPES.has(normalizeKey(metadata.turnType))) return false;
  if (metadata.transcriptAcceptance?.accepted === false) return false;
  return !metadata.turnType || metadata.turnType === 'user_answer' || metadata.countsAsQuestion === true;
};

const isCountableQuestion = (turn, countableFingerprints) => {
  if (!['ai', 'assistant', 'interviewer'].includes(normalizeKey(turn?.role))) return false;
  const fingerprint = buildQuestionHistory([turn]).countableQuestions[0]?.fingerprint;
  return Boolean(fingerprint && countableFingerprints.has(fingerprint));
};

export const buildReportTurnDataset = (transcript = []) => {
  const turns = ensureArray(transcript);
  const history = buildQuestionHistory(turns);
  const countableFingerprints = new Set(history.countableQuestions.map((item) => item.fingerprint));
  const questionAnswerPairs = [];
  let pendingQuestion = null;

  for (const turn of turns) {
    if (isCountableQuestion(turn, countableFingerprints)) {
      pendingQuestion = turn;
      continue;
    }
    if (!isAcceptedAnswer(turn) || !pendingQuestion) continue;
    questionAnswerPairs.push({
      questionId: pendingQuestion.questionId || pendingQuestion.metadata?.questionId || null,
      questionTurn: pendingQuestion,
      answerTurn: turn,
    });
    pendingQuestion = null;
  }

  const acceptedAnswers = questionAnswerPairs.map((item) => item.answerTurn);
  const excludedUserTurnCount = turns.filter((turn) => normalizeKey(turn.role) === 'user').length - acceptedAnswers.length;
  return {
    questionAnswerPairs,
    acceptedAnswers,
    countableQuestionCount: history.countableQuestions.length,
    scoredAnswerCount: acceptedAnswers.length,
    repairTurnCount: history.repairQuestions.length + Math.max(0, excludedUserTurnCount),
  };
};
```

- [ ] **Step 4: Replace raw `userTurns` and loose pairing in `reportGeneratorAgent.js`**

Use `buildReportTurnDataset(transcript)` once. Pass `dataset.acceptedAnswers` to evidence analysis, `dataset.questionAnswerPairs` to turn breakdown construction, and the dataset to interview metrics. Remove the duplicate `isReportQuestionTurn` and `buildQuestionAnswerPairs` implementations.

- [ ] **Step 5: Verify GREEN**

Run the Task 2 command. Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/report/reportTurnDatasetService.js backend/src/services/agents/reportGeneratorAgent.js backend/tests/fixtures/report/constructiveReportRegressionFixture.js backend/tests/robustness/report/reportTurnDatasetRobustness.test.js
git commit -m "fix(report): score only accepted interview answers"
```

---

### Task 3: Replace single-keyword evidence classification with shared evidence signals

**Files:**
- Create: `backend/src/services/report/answerEvidenceSignalService.js`
- Create: `backend/tests/robustness/report/reportEvidenceClassificationRobustness.test.js`
- Modify: `backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js:20-116`
- Modify: `backend/src/services/aiControl/starRubricService.js:8-75`
- Modify: `backend/tests/robustness/agent/starRubricRobustness.test.js`

- [ ] **Step 1: Write RED tests using the three disputed examples**

```js
import { describe, expect, it } from 'vitest';
import { analyseCandidateAnswers } from '../../../src/services/agents/reportGenerator/reportEvidenceAnalysis.js';
import { analyzeStarrBreakdown } from '../../../src/services/aiControl/starRubricService.js';
import { constructiveReportRegressionTranscript } from '../../fixtures/report/constructiveReportRegressionFixture.js';

const answers = constructiveReportRegressionTranscript.filter((turn) => turn.role === 'user');

describe('constructive report evidence classification', () => {
  it('counts project, ownership, and collaboration answers as real examples', () => {
    const analysed = analyseCandidateAnswers(answers);
    expect(analysed.filter((item) => item.evidenceType === 'direct_past_experience')).toHaveLength(3);
    expect(analysed.at(-1).signals.hasFutureIntent).toBe(true);
    expect(analysed.at(-1).evidenceType).toBe('direct_past_experience');
  });

  it('recognises the latency debugging actions', () => {
    const breakdown = analyzeStarrBreakdown(answers[1].text);
    expect(breakdown.action).not.toBe('missing');
    expect(breakdown.resultOrReaction).toBe('clear');
  });

  it('recognises a percentage result only when the number and unit occur together', () => {
    const breakdown = analyzeStarrBreakdown(answers[3].text);
    expect(breakdown.resultOrReaction).toBe('clear');
    expect(breakdown.scores.resultOrReaction).toBe(2);
    expect(analyzeStarrBreakdown('I reviewed the user interface and collected feedback.').resultOrReaction).not.toBe('clear');
  });

  it('does not treat teammate learning as candidate reflection', () => {
    const breakdown = analyzeStarrBreakdown(answers[2].text);
    expect(breakdown.reflection).toBe('missing');
    expect(breakdown.resultOrReaction).not.toBe('clear');
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/robustness/report/reportEvidenceClassificationRobustness.test.js tests/robustness/agent/starRubricRobustness.test.js
```

Expected failures: direct-example count is `0`, latency action is missing, percentage result is partial, and vague ownership result/reflection are over-scored.

- [ ] **Step 3: Implement shared signals**

```js
import { normalizeText } from '../../utils/commonHelpers.js';

const pattern = (text, expression) => expression.test(text);

export const extractAnswerEvidenceSignals = (answer = '') => {
  const text = normalizeText(answer);
  const lower = text.toLowerCase();
  const hasPastContext = pattern(lower, /\b(in|during|when|at) (my |our |the )?(previous role|project|application|team|company|station|workflow)\b|\b(at the beginning|started at|my original role)\b/);
  const hasPersonalAction = pattern(lower, /\bi\s+(?:personally\s+)?(?:tried|used|built|designed|implemented|led|owned|fixed|improved|handled|created|deployed|checked|tested|coordinated|analysed|analyzed|shared|gave|asked|found|changed|simplified|separated|refactored|automated|consulted|measured)\b/);
  const hasValidation = pattern(lower, /\b(?:validated|tested|checked|measured|compared|reviewed|analysed|analyzed|experiment(?:ed)?)\b/);
  const metricMatches = [...text.matchAll(/\b\d+(?:\.\d+)?\s*(?:%|percent|seconds?|minutes?|hours?|units?|requests?|points?|times?)(?!\w)/gi)].map((match) => match[0]);
  const hasOutcome = metricMatches.length > 0 || pattern(lower, /\b(?:reduced|decreased|increased|improved|brought|cut|raised|resolved|delivered|achieved)\b/);
  const hasFutureIntent = pattern(lower, /\b(?:i would|i could|i can|i will|i plan to)\b/);
  const hasFirstPersonReflection = pattern(lower, /\b(?:i learned|i learnt|i realised|i realized|this taught me|next time i would|i would do .* differently|i can apply|i can bring)\b/);

  return {
    hasPastContext,
    hasPersonalAction,
    hasValidation,
    hasOutcome,
    metricMatches,
    hasFutureIntent,
    hasFirstPersonReflection,
    isDirectPastExperience: hasPastContext && (hasPersonalAction || hasOutcome),
    isHypotheticalOnly: hasFutureIntent && !(hasPastContext && (hasPersonalAction || hasOutcome)),
  };
};
```

- [ ] **Step 4: Make direct evidence precedence explicit**

`classifyEvidenceType` must return `direct_past_experience` before considering hypothetical-only. Keep `indirect_adjacent_experience` for explicit adjacency, and use `generic_filler` only when neither direct nor hypothetical-only signals exist.

- [ ] **Step 5: Rebuild evidence strength from the shared signals**

Award one point each for real context, personal action, validation, and measurable outcome. Include matched evidence snippets in the analysis object so dimension reasons can cite the answer rather than generic labels.

- [ ] **Step 6: Refactor STARR to use the same signals**

Action requires a first-person action. Result requires an outcome verb or a number-unit match. Reflection requires a first-person reflection phrase. Remove bare `user`, bare `feedback`, and bare `better` as independent scoring signals.

- [ ] **Step 7: Verify GREEN and run the report group**

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/robustness/report/reportEvidenceClassificationRobustness.test.js tests/robustness/agent/starRubricRobustness.test.js
npm run test:report
```

Expected: disputed-example tests pass; existing report tests remain green.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/report/answerEvidenceSignalService.js backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js backend/src/services/aiControl/starRubricService.js backend/tests/robustness/report/reportEvidenceClassificationRobustness.test.js backend/tests/robustness/agent/starRubricRobustness.test.js
git commit -m "fix(report): recognise real actions and measurable outcomes"
```

---

### Task 4: Assign assessment metadata to the actual follow-up intent

**Files:**
- Create: `backend/src/services/questions/questionAssessmentContractService.js`
- Modify: `backend/src/services/questions/interviewTurnOrchestratorService.js:72-83,189-209,291-320`
- Modify: `backend/src/services/agents/interviewerAgent.js:220-237,460-494`
- Modify: `backend/tests/robustness/questions/questionMetadataPersistence.test.js`

- [ ] **Step 1: Write RED tests for validation, trade-off, and behavioural-result follow-ups**

```js
import { describe, expect, it } from 'vitest';
import { resolveFollowUpAssessmentContract } from '../../../src/services/questions/questionAssessmentContractService.js';

describe('follow-up assessment contracts', () => {
  it.each([
    ['validation', 'role_specific', 'past_example', ['validationVerification', 'outcomeValue']],
    ['technical_depth', 'role_specific', 'past_example', ['approach', 'validationVerification']],
    ['tradeoff', 'role_specific', 'past_example', ['judgementTradeoffs', 'validationVerification']],
    ['constraint', 'role_specific', 'past_example', ['judgementTradeoffs', 'riskQualityEthics']],
    ['failure', 'role_specific', 'past_example', ['approach', 'outcomeValue']],
  ])('maps %s to a role-specific contract', (intent, questionFamily, evidenceMode, targetedDimensions) => {
    expect(resolveFollowUpAssessmentContract({ intent, parentQuestionFamily: 'motivation' })).toMatchObject({
      questionFamily, evidenceMode, targetedDimensions,
    });
  });

  it('keeps an outcome follow-up on a behavioural story behavioural', () => {
    expect(resolveFollowUpAssessmentContract({ intent: 'result', parentQuestionFamily: 'behavioural' })).toMatchObject({
      questionFamily: 'behavioural', evidenceMode: 'past_example', targetedDimensions: ['resultOrReaction'],
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run the focused question metadata test. Expected: module missing.

- [ ] **Step 3: Implement the contract resolver**

```js
const ROLE_SPECIFIC = {
  validation: ['validationVerification', 'outcomeValue'],
  technical_depth: ['approach', 'validationVerification'],
  tradeoff: ['judgementTradeoffs', 'validationVerification'],
  constraint: ['judgementTradeoffs', 'riskQualityEthics'],
  failure: ['approach', 'outcomeValue'],
};

const BEHAVIOURAL = {
  ownership: ['action'],
  behavioural_action: ['action'],
  result: ['resultOrReaction'],
  reflection: ['reflection'],
};

export const resolveFollowUpAssessmentContract = ({ intent = '', parentQuestionFamily = '', parentEvidenceMode = 'past_example' } = {}) => {
  if (ROLE_SPECIFIC[intent]) {
    return { questionFamily: 'role_specific', evidenceMode: 'past_example', targetedDimensions: ROLE_SPECIFIC[intent] };
  }
  if (BEHAVIOURAL[intent] && parentQuestionFamily === 'behavioural') {
    return { questionFamily: 'behavioural', evidenceMode: 'past_example', targetedDimensions: BEHAVIOURAL[intent] };
  }
  return {
    questionFamily: parentQuestionFamily || 'role_specific',
    evidenceMode: parentEvidenceMode || 'past_example',
    targetedDimensions: [],
  };
};
```

- [ ] **Step 4: Preserve lineage separately from scoring metadata**

Keep `parentQuestionFamily`, `parentEvidenceMode`, `rootTopic`, and `parentTopic` for traceability. Set the actual turn’s `questionFamily`, `evidenceMode`, and `targetedDimensions` from the assessment contract. Do not overwrite them with parent metadata in `interviewerAgent.js`.

- [ ] **Step 5: Verify persisted interviewer result metadata**

Assert that a validation follow-up after a motivation question persists `questionFamily: role_specific`, while `parentQuestionFamily: motivation` remains available in the trace.

- [ ] **Step 6: Run question tests and commit**

```bash
cd backend && npm run test:questions
git add backend/src/services/questions/questionAssessmentContractService.js backend/src/services/questions/interviewTurnOrchestratorService.js backend/src/services/agents/interviewerAgent.js backend/tests/robustness/questions/questionMetadataPersistence.test.js
git commit -m "fix(interview): classify follow-ups by assessment intent"
```

---

### Task 5: Make report rubric inference detect stale metadata and targeted follow-ups

**Files:**
- Modify: `backend/src/services/report/turnRubricService.js:26-116,189-307`
- Modify: `backend/tests/robustness/report/reportFrameworkPipeline.test.js`

- [ ] **Step 1: Add RED tests for the actual disputed questions**

```js
it('does not score a project validation question with motivation metadata', () => {
  const turn = analyzeTurnStructure({
    question: 'Can you walk me through a specific example of how you validated that the feedback helped a candidate improve?',
    answer: 'I separated feedback types but did not run before-and-after user validation.',
    metadata: { topic: 'company_and_role_motivation', questionFamily: 'motivation', followUpIntent: 'validation' },
  });
  expect(turn.rubricType).toBe('role_specific');
  expect(turn.frameworkKey).toBe('role_specific_reasoning');
  expect(turn.frameworkBreakdown.dimensions.map((item) => item.key)).toContain('validationVerification');
});

it('uses trade-off reasoning rather than STARR for a constraint follow-up', () => {
  const turn = analyzeTurnStructure({
    question: 'What trade-offs or constraints did you consider when designing the experiments?',
    answer: 'I had to balance sample size, operator time, fixture changes, and reproducibility.',
    metadata: { followUpIntent: 'tradeoff', questionFamily: 'behavioural' },
  });
  expect(turn.rubricType).toBe('role_specific');
  expect(turn.starApplicable).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

Run `reportFrameworkPipeline.test.js`. Expected: validation uses `company_motivation`; trade-off uses STARR.

- [ ] **Step 3: Resolve rubric from the assessment contract before stale family metadata**

Add `resolveTurnAssessmentContract({ question, metadata })`. Priority order:

1. Explicit `followUpIntent` mapped by `questionAssessmentContractService`.
2. Exact self-introduction and exact company/role motivation wording.
3. Unambiguous validation, trade-off, constraint, technical-depth, credential, and behavioural wording.
4. Explicit root-question family metadata.
5. Safe role-specific or STARR fallback.

- [ ] **Step 4: Mark untargeted dimensions `not_applicable`**

For targeted follow-ups, keep the complete framework definition but mark dimensions outside `targetedDimensions` as `not_applicable` and exclude them from `calculateFrameworkScore`. Q5 must display only Result/Reaction as scored, not Task 0 and Action 0.

- [ ] **Step 5: Add an alignment diagnostic**

Export `validateRubricQuestionAlignment({ question, rubric, metadata })` returning `{ passed, reason }`. Validation questions must expose a validation dimension; motivation rubrics require an actual company/role motivation question.

- [ ] **Step 6: Verify GREEN, run report tests, and commit**

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/robustness/report/reportFrameworkPipeline.test.js
npm run test:report
git add backend/src/services/report/turnRubricService.js backend/tests/robustness/report/reportFrameworkPipeline.test.js
git commit -m "fix(report): align rubrics with actual follow-up questions"
```

---

### Task 6: Make completion and evidence totals use the canonical dataset

**Files:**
- Modify: `backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js:69-136`
- Modify: `backend/src/services/agents/reportGenerator/reportMetricBuilder.js:59-150`
- Modify: `backend/src/services/agents/reportGeneratorAgent.js:251-267`
- Modify: `backend/tests/robustness/report/reportTurnDatasetRobustness.test.js`

- [ ] **Step 1: Add RED consistency assertions**

```js
it('uses scored answers rather than raw user turns for completion and evidence totals', () => {
  const dataset = buildReportTurnDataset([
    ...constructiveReportRegressionTranscript,
    ...repairTurnsThatMustNotCount,
  ]);
  const metrics = buildInterviewMetrics(dataset, 4);
  expect(metrics.scoredCandidateAnswerCount).toBe(4);
  expect(metrics.plannedQuestionCount).toBe(4);
  expect(metrics.interviewCompletedByLimit).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

Expected: current function expects a transcript array and counts raw roles.

- [ ] **Step 3: Change metric construction**

```js
export const buildInterviewMetrics = (dataset = {}, plannedQuestionCount = 0) => ({
  candidateTurnCount: Number(dataset.acceptedAnswers?.length || 0),
  interviewerQuestionCount: Number(dataset.countableQuestionCount || 0),
  scoredCandidateAnswerCount: Number(dataset.scoredAnswerCount || 0),
  repairTurnCount: Number(dataset.repairTurnCount || 0),
  plannedQuestionCount: Number(plannedQuestionCount || 0),
  interviewCompletedByLimit: plannedQuestionCount > 0
    && Number(dataset.scoredAnswerCount || 0) >= Number(plannedQuestionCount),
});
```

- [ ] **Step 4: Rename the hypothesis metric internally**

Keep the legacy output key for schema compatibility, but calculate it as `hypotheticalOnlyTurns`. Add `mixedFutureIntentTurns` separately. Evidence category totals must sum to `scoredCandidateAnswerCount`.

- [ ] **Step 5: Verify GREEN and commit**

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/robustness/report/reportTurnDatasetRobustness.test.js tests/robustness/report/reportEvidenceClassificationRobustness.test.js
git add backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js backend/src/services/agents/reportGenerator/reportMetricBuilder.js backend/src/services/agents/reportGeneratorAgent.js backend/tests/robustness/report/reportTurnDatasetRobustness.test.js
git commit -m "fix(report): reconcile completion with scored answers"
```

---

### Task 7: Compute final scores once and lock candidate-facing metrics

**Files:**
- Create: `backend/src/services/report/reportScoreService.js`
- Modify: `backend/src/services/agents/reportGenerator/reportDraftBuilder.js:109-162,203-222`
- Modify: `backend/src/services/agents/reportGenerator/reportMetricBuilder.js:20-150`
- Modify: `backend/src/services/agents/reportGenerator/reportFeedbackBuilder.js:59-68`
- Modify: `backend/src/services/reportCoachingService.js:44-51,271-298`
- Modify: `backend/src/services/agents/reportGeneratorAgent.js:251-333`
- Modify: `backend/tests/robustness/report/reportFrameworkPipeline.test.js`

- [ ] **Step 1: Add a RED score consistency test**

```js
it('uses the blended overall score in the overall metric', () => {
  const scores = buildReportScores({ cvJdScore: 64.3, interviewScore: 53 });
  const metrics = buildPlainEnglishMetrics({
    scores,
    evidenceSummary: { averageStrength: 1.2, totals: { direct_past_experience: 3 } },
    interviewMetrics: { plannedQuestionCount: 15, scoredCandidateAnswerCount: 15 },
  });
  expect(scores.overall).toBe(58.6);
  expect(metrics.find((item) => item.id === 'overall_fit').displayValue).toBe('58.60/100');
  expect(metrics.find((item) => item.id === 'cv_jd_match').displayValue).toBe('64.30/100');
});
```

- [ ] **Step 2: Verify RED**

Expected: the overall metric displays `64.30/100` and no separate deterministic CV-JD metric is guaranteed.

- [ ] **Step 3: Move score ownership into `reportScoreService.js`**

```js
export const buildReportScores = ({ cvJdScore = 0, interviewScore = 0, analysisResult = {}, evidenceSummary = {} } = {}) => ({
  overall: Number(((Number(cvJdScore) * 0.5) + (Number(interviewScore) * 0.5)).toFixed(1)),
  cvJdMatch: Number(cvJdScore || 0),
  interviewPerformance: Number(interviewScore || 0),
  macro: Number(analysisResult.scoreBreakdown?.macro || 0),
  micro: Number(analysisResult.scoreBreakdown?.micro || 0),
  requirements: Number(analysisResult.scoreBreakdown?.requirements || 0),
  evidenceStrength: Number(evidenceSummary.averageStrength || 0),
  directEvidenceTurns: Number(evidenceSummary.totals?.direct_past_experience || 0),
  hypotheticalTurns: Number(evidenceSummary.totals?.hypothetical_understanding || 0),
});
```

Move `computeInterviewPerformanceScore` into the same module and call it after deterministic turn breakdowns exist. Pass the resulting scores to feedback and draft builders.

- [ ] **Step 4: Lock numeric metrics during LLM normalisation**

`normalizeMetric` must take `id`, `value`, `displayValue`, and `unit` from deterministic fallback. The LLM may improve only `label` and `interpretation`.

```js
const normalizeMetric = (item = {}, fallback = {}) => ({
  id: ensureString(fallback.id, item.id || ''),
  label: ensureString(item.label, fallback.label || ''),
  value: Number(fallback.value || 0),
  displayValue: ensureString(fallback.displayValue, ''),
  unit: ensureString(fallback.unit, ''),
  interpretation: ensureString(item.interpretation, fallback.interpretation || ''),
});
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
cd backend && npm run test:report
git add backend/src/services/report/reportScoreService.js backend/src/services/agents/reportGenerator/reportDraftBuilder.js backend/src/services/agents/reportGenerator/reportMetricBuilder.js backend/src/services/agents/reportGenerator/reportFeedbackBuilder.js backend/src/services/reportCoachingService.js backend/src/services/agents/reportGeneratorAgent.js backend/tests/robustness/report/reportFrameworkPipeline.test.js
git commit -m "fix(report): keep score labels and values consistent"
```

---

### Task 8: Validate stronger answers and remove the corrupt fallback

**Files:**
- Create: `backend/src/services/report/reportContentQualityService.js`
- Create: `backend/tests/robustness/report/reportContentQualityRobustness.test.js`
- Modify: `backend/src/services/agents/reportGenerator/reportCoachingBuilder.js:20-37,177-197`
- Modify: `backend/src/services/reportCoachingService.js:88-97,271-298,323-417`
- Modify: `backend/src/services/agents/reportQaAgent.js:33-149`
- Modify: `backend/src/services/report/reportQaRepairOrchestratorService.js:12-58`
- Modify: `backend/src/services/schemaValidationService.js:140-194`
- Modify: `backend/src/utils/schemaHelpers.js:58-85`

- [ ] **Step 1: Add RED content-quality tests**

```js
import { describe, expect, it } from 'vitest';
import { validateAnswerRewrite } from '../../../src/services/report/reportContentQualityService.js';

describe('answer rewrite quality', () => {
  it.each([
    'Topic: self_intro. Principle: [補充核心原則]',
    'Topic: project. Action: [describe your action]',
    'Topic: project. Action: [ŠªfPNºˆLRÕ]',
  ])('rejects non-candidate-facing rewrite text', (better) => {
    expect(validateAnswerRewrite({ question: 'Tell me about the project.', weak: 'It was hard.', better })).toMatchObject({ valid: false });
  });

  it('accepts a grounded readable rewrite', () => {
    const better = 'The main friction was latency. I traced the frontend, backend, speech-to-text, and Azure Speech stages, found delays in answer understanding and question generation, simplified the routing step, and reduced latency from about 12 seconds to about 3 seconds.';
    expect(validateAnswerRewrite({ question: 'What was the hardest friction point?', weak: 'Latency was hard.', better })).toMatchObject({ valid: true });
  });
});
```

- [ ] **Step 2: Verify RED**

Expected: quality service missing.

- [ ] **Step 3: Implement deterministic quality checks**

```js
const BRACKET_PROMPT = /\[[^\]]{2,}\]/;
const MOJIBAKE = /(?:�|Ã|Â|â€|Š|Ÿ|Œ|Ð|Þ)/;
const CJK_PROMPT_WORDS = /(?:補充|說明|釐清|列出|假設|限制|風險|驗證)/;

export const validateAnswerRewrite = ({ question = '', weak = '', better = '' } = {}) => {
  const text = String(better || '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const reasons = [
    !text ? 'missing_text' : null,
    BRACKET_PROMPT.test(text) ? 'contains_bracket_prompt' : null,
    MOJIBAKE.test(text) ? 'contains_mojibake' : null,
    CJK_PROMPT_WORDS.test(text) ? 'contains_non_english_scaffold' : null,
    words.length > 120 ? 'too_long' : null,
    text === String(weak || '').trim() ? 'unchanged_answer' : null,
    !String(question || '').trim() ? 'missing_question' : null,
  ].filter(Boolean);
  return { valid: reasons.length === 0, reasons, wordCount: words.length };
};
```

- [ ] **Step 4: Remove deterministic Chinese scaffolds from candidate-facing output**

The deterministic fallback returns no `ready` rewrite. It returns:

```js
{
  status: 'unavailable',
  failureReason: 'A grounded stronger answer could not be generated reliably. Regenerate the report to try again.',
  question: turn.question,
  weak: turn.answer,
  better: '',
}
```

The LLM prompt must request actual English answers, not structural placeholders. Run every generated rewrite through `validateAnswerRewrite`. Keep only `status: ready` items.

- [ ] **Step 5: Add QA flags and repair instructions**

Add `invalid_answer_rewrite`, `placeholder_answer_rewrite`, `unreadable_answer_rewrite`, and `rewrite_question_mismatch`. These are blocking integrity flags. A repair attempt may regenerate wording, but must not alter question, answer, score, rubric, or evidence fields.

- [ ] **Step 6: Extend schema normalisation**

Preserve `status`, `failureReason`, `question`, and `evidenceUsed` on rewrite items. Default unknown legacy items to `status: ready` only if they pass validation.

- [ ] **Step 7: Verify GREEN and commit**

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/robustness/report/reportContentQualityRobustness.test.js tests/robustness/report/reportFrameworkQa.test.js
git add backend/src/services/report/reportContentQualityService.js backend/src/services/agents/reportGenerator/reportCoachingBuilder.js backend/src/services/reportCoachingService.js backend/src/services/agents/reportQaAgent.js backend/src/services/report/reportQaRepairOrchestratorService.js backend/src/services/schemaValidationService.js backend/src/utils/schemaHelpers.js backend/tests/robustness/report/reportContentQualityRobustness.test.js backend/tests/robustness/report/reportFrameworkQa.test.js
git commit -m "fix(report): reject unreadable answer rewrites"
```

---

### Task 9: Produce meaningful evidence references and honest QA coverage

**Files:**
- Create: `backend/src/services/report/reportEvidenceReferenceService.js`
- Modify: `backend/src/services/report/claimGroundingService.js:105-169`
- Modify: `backend/src/services/agents/reportGenerator/reportDraftBuilder.js:300-304`
- Modify: `backend/src/services/agents/reportQaAgent.js:20-31,81-131`
- Modify: `backend/tests/robustness/report/reportGroundingRobustness.test.js`
- Modify: `backend/tests/robustness/report/reportFrameworkQa.test.js`

- [ ] **Step 1: Add RED tests for duplicate generic sources**

```js
it('does not treat duplicate generic source labels as meaningful coverage', async () => {
  const report = buildReport({ rubricType: 'starr', frameworkKey: 'behavioural_starr', starApplicable: true, starBreakdown: completeStarr });
  report.evidenceReferences = Array.from({ length: 8 }, () => ({ sourceType: 'jd', label: 'Job requirement' }));
  const qa = await runReportQaAgent({ report, analysisResult: { decision: { label: 'manual_review' } } });
  expect(qa.qualityFlags).toContain('uninformative_evidence_references');
  expect(qa.consistencyChecks.find((item) => item.rule === 'meaningful_evidence_presence').passed).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

Expected: current QA awards reference count and does not inspect content.

- [ ] **Step 3: Build candidate-facing evidence rows**

```js
export const buildCandidateEvidenceReferences = (references = []) => {
  const seen = new Set();
  return references.flatMap((reference) => {
    const snippets = Array.isArray(reference.evidenceSnippets) ? reference.evidenceSnippets : [];
    return snippets.map((snippet) => ({
      claimId: reference.claimId,
      claim: reference.claimText,
      sourceType: snippet.sourceType,
      sourceLabel: snippet.sourceType === 'interview_answer' ? 'Interview answer' : snippet.sourceType.toUpperCase(),
      evidenceSnippet: snippet.text,
      confidenceLevel: reference.confidenceLevel,
      similarity: snippet.similarity,
    }));
  }).filter((item) => {
    const key = `${item.claim}|${item.sourceType}|${item.evidenceSnippet}`.toLowerCase();
    if (!item.claim || !item.evidenceSnippet || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
```

- [ ] **Step 4: Put grounded claim rows before generic analysis references**

The report’s candidate-facing `evidenceReferences` must be the deduplicated rows. Keep raw analysis and retrieval references under internal metadata, not in the visible appendix.

- [ ] **Step 5: Correct QA coverage**

Coverage counts unique references with a claim and snippet. Add checks for evidence-total/scored-answer consistency, rubric-question alignment, score-metric consistency, duplicate strength/gap labels, and transcript risk visibility. Do not let section count or duplicate reference count hide blocking flags.

- [ ] **Step 6: Verify GREEN and commit**

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/robustness/report/reportGroundingRobustness.test.js tests/robustness/report/reportFrameworkQa.test.js
git add backend/src/services/report/reportEvidenceReferenceService.js backend/src/services/report/claimGroundingService.js backend/src/services/agents/reportGenerator/reportDraftBuilder.js backend/src/services/agents/reportQaAgent.js backend/tests/robustness/report/reportGroundingRobustness.test.js backend/tests/robustness/report/reportFrameworkQa.test.js
git commit -m "fix(report): expose claim-level evidence sources"
```

---

### Task 10: Preserve ASR provenance and flag transcript conflicts

**Files:**
- Create: `backend/src/services/report/reportTranscriptRiskService.js`
- Modify: `backend/src/services/voice/speechPhraseHintService.js:83-108`
- Modify: `backend/src/services/voice/transcriptNormalizer.js:12-33`
- Modify: `backend/src/services/voice/duplexVoiceAgentService.js:28-48,385-412`
- Modify: `backend/src/services/voice/duplexTurnCoordinator.js:380-415,517-629`
- Modify: `backend/src/services/voice/realtimeVoiceTurnService.js:87-177`
- Modify: `backend/tests/unit/transcriptNormalizer.test.js`
- Modify: `backend/tests/robustness/voice/duplexTurnCoordinator.transcriptConfirmation.test.js`
- Modify: `backend/tests/robustness/report/reportContentQualityRobustness.test.js`

- [ ] **Step 1: Write RED tests for phrase hints and provenance**

```js
it('adds the candidate name and project terminology to session phrase hints', () => {
  const phrases = buildSessionSpeechPhraseList({
    candidateName: 'A Candidate',
    analysisResult: { parsedCvProfile: { projects: [{ title: 'Kiwi Voice Coach' }] } },
  });
  expect(phrases).toEqual(expect.arrayContaining(['A Candidate', 'Kiwi Voice Coach', 'prompt engineering', 'test-driven development', 'Codex']));
});

it('preserves raw and normalized text with correction metadata', () => {
  const result = normalizeTranscript('I used by coding and text driven development');
  expect(result.rawText).toBe('I used by coding and text driven development');
  expect(result.normalizedText).toContain('vibe coding');
  expect(result.normalizedText).toContain('test-driven development');
  expect(result.corrections.length).toBe(2);
});
```

- [ ] **Step 2: Verify RED**

Expected: candidate name and added terms are absent; merged duplex segments lose raw/correction metadata.

- [ ] **Step 3: Extend only high-confidence terminology corrections**

Add exact replacements for common domain phrases such as `by coding -> vibe coding`, `proper engineering -> prompt engineering`, and `text driven -> test-driven`. Do not add a global `Ellen -> Alan` replacement and do not rewrite numbers.

- [ ] **Step 4: Preserve segment provenance through duplex processing**

Change segment merge output to:

```js
{
  rawText,
  normalizedText,
  corrections,
  segments: [{ rawText, normalizedText, confidence }],
}
```

Pass this object through the coordinator. Persist `rawTranscriptText`, `normalizedTranscriptText`, `transcriptCorrections`, and `answeredQuestionId` in user-turn metadata while keeping the accepted normalized text in `turn.text`.

- [ ] **Step 5: Detect but do not rewrite conflicts**

`reportTranscriptRiskService` must flag:

- self-introduced name differs materially from the session candidate name;
- the same metric changes from `15% to 5%` to `50% to 5%`;
- a high-value entity has low ASR confidence or was produced from a partial fallback.

Each flag carries affected turn IDs, raw snippets, normalized snippets, and `needsUserConfirmation: true`. The report may count a metric as present but must downgrade confidence until confirmed.

- [ ] **Step 6: Preserve the voice contract**

Keep contentful low-confidence transcripts in the existing understanding-confirmation flow. The new provenance fields must not cause repair or confirmation turns to count as interview questions and must not silently score a rejected transcript.

- [ ] **Step 7: Verify GREEN and run voice tests**

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/unit/transcriptNormalizer.test.js tests/robustness/voice/duplexTurnCoordinator.transcriptConfirmation.test.js tests/robustness/report/reportContentQualityRobustness.test.js
npm run test:voice
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/report/reportTranscriptRiskService.js backend/src/services/voice/speechPhraseHintService.js backend/src/services/voice/transcriptNormalizer.js backend/src/services/voice/duplexVoiceAgentService.js backend/src/services/voice/duplexTurnCoordinator.js backend/src/services/voice/realtimeVoiceTurnService.js backend/tests/unit/transcriptNormalizer.test.js backend/tests/robustness/voice/duplexTurnCoordinator.transcriptConfirmation.test.js backend/tests/robustness/report/reportContentQualityRobustness.test.js
git commit -m "fix(voice): preserve transcript corrections for report QA"
```

---

### Task 11: Make the web report evidence-first and safe for legacy data

**Files:**
- Modify: `frontend/src/utils/reportView/viewModel.js:22-67`
- Modify: `frontend/src/utils/reportView/insights.js:53-133`
- Modify: `frontend/src/components/report/InsightsSection.jsx:34-82`
- Modify: `frontend/src/components/report/TurnBreakdownSection.jsx:156-260`
- Modify: `frontend/src/components/report/AnswerRewriteSection.jsx:21-45`
- Modify: `frontend/src/components/report/ReportHeroCard.jsx`
- Create: `frontend/src/components/report/EvidenceSourcesSection.jsx`
- Modify: `frontend/src/pages/ReportPage.jsx:120-140`
- Create: `frontend/src/components/report/__tests__/AnswerRewriteSection.test.jsx`
- Create: `frontend/src/components/report/__tests__/EvidenceSourcesSection.test.jsx`

- [ ] **Step 1: Write RED UI tests**

```jsx
it('shows an unavailable state instead of an invalid stronger answer', () => {
  render(<AnswerRewriteSection answerRewriteTips={[{
    status: 'unavailable', weak: 'Raw answer', better: '',
    failureReason: 'A grounded stronger answer could not be generated reliably.',
  }]} />);
  expect(screen.queryByText('Stronger version')).not.toBeInTheDocument();
  expect(screen.getByText(/could not be generated reliably/i)).toBeInTheDocument();
});

it('renders claim, source, snippet, and confidence', () => {
  render(<EvidenceSourcesSection items={[{
    claim: 'Reduced retest rate', sourceLabel: 'Answer Q6',
    evidenceSnippet: 'reduced the retest rate from 15% to 5%', confidenceLevel: 'medium',
  }]} />);
  expect(screen.getByText('Reduced retest rate')).toBeInTheDocument();
  expect(screen.getByText('Answer Q6')).toBeInTheDocument();
  expect(screen.getByText(/15% to 5%/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend && npm run test -- src/components/report/__tests__/AnswerRewriteSection.test.jsx src/components/report/__tests__/EvidenceSourcesSection.test.jsx
```

Expected: unavailable rewrite is still labelled stronger; evidence component is missing.

- [ ] **Step 3: Implement the approved UI brief**

Use the layout described before Task 1. Source chips must use candidate-friendly labels. Targeted follow-ups must display their scored focus and omit non-applicable zeroes. Legacy v5 reports run through a view-model integrity guard that hides invalid rewrites and adds `Legacy report needs regeneration` when the source artifact fails current checks.

- [ ] **Step 4: Add transcript-risk banner behaviour**

Show it only when `report.transcriptRisks.length > 0`. Do not show raw confidence numbers without explanation. Include the affected question number and a concise action such as `Review transcript` or `Regenerate after confirmation`.

- [ ] **Step 5: Verify GREEN, lint, and commit**

```bash
cd frontend && npm run test -- src/components/report src/utils
npm run lint
git add frontend/src/utils/reportView frontend/src/components/report frontend/src/pages/ReportPage.jsx
git commit -m "fix(report-ui): show evidence and integrity states"
```

---

### Task 12: Export every scored turn and useful evidence to PDF

**Files:**
- Modify: `frontend/src/utils/reportPdf/reportPdfTemplate.js:498-598`
- Modify: `frontend/src/api/__tests__/reportApi.test.js`
- Modify: `frontend/src/utils/__tests__/reportTurnFrameworkFormatter.test.js`

- [ ] **Step 1: Write RED PDF text tests**

```js
it('exports all scored turns rather than only the first eight', async () => {
  const turns = Array.from({ length: 15 }, (_, index) => ({
    question: `Question ${index + 1}?`, answer: `Answer ${index + 1}`,
    feedback: `Feedback ${index + 1}`, scores: { business: 5, logic: 5, evidence: 5 },
  }));
  await generateReportPDF(buildPdfFixture({ turnBreakdowns: turns }));
  const renderedText = pdfMocks.instances.at(-1).textCalls.join('\n');
  expect(renderedText).toContain('Q15: Question 15?');
});

it('never sends invalid rewrite text to jsPDF', async () => {
  await generateReportPDF(buildPdfFixture({ answerRewriteExamples: [{ status: 'unavailable', weak: 'Raw', better: '[補充情境]' }] }));
  const renderedText = pdfMocks.instances.at(-1).textCalls.join('\n');
  expect(renderedText).not.toContain('補充情境');
  expect(renderedText).toContain('could not be generated reliably');
});

it('prints evidence snippets rather than repeated generic source labels', async () => {
  await generateReportPDF(buildPdfFixture({ evidenceReferences: [{
    claim: 'Latency reduction', sourceLabel: 'Answer Q3', evidenceSnippet: 'latency from 12 seconds to 3 seconds', confidenceLevel: 'medium',
  }] }));
  const renderedText = pdfMocks.instances.at(-1).textCalls.join('\n');
  expect(renderedText).toContain('Latency reduction');
  expect(renderedText).toContain('latency from 12 seconds to 3 seconds');
});
```

- [ ] **Step 2: Verify RED**

Run frontend PDF tests. Expected: Q15 missing, invalid rewrite rendered, evidence snippet missing.

- [ ] **Step 3: Remove the silent eight-turn slice**

Iterate all `vm.turnBreakdowns`. Let existing `ensureSpace` pagination create additional pages. Add a small `15 scored answers` subtitle so the PDF and completion card describe the same population.

- [ ] **Step 4: Render only ready rewrites**

For `status: unavailable`, draw one amber notice. Never pass known-invalid text to jsPDF. Because the report locale is English, candidate-facing fallback content must remain ASCII-safe English. Multilingual PDF font embedding is a separate approved feature, not required for this defect fix.

- [ ] **Step 5: Render evidence rows**

Use `claim` as the card title and `${sourceLabel} - ${confidenceLevel} confidence` as metadata. Use `evidenceSnippet` as the card body. Paginate every unique meaningful row; do not pre-slice generic references.

- [ ] **Step 6: Verify GREEN and commit**

```bash
cd frontend && npm run test -- src/api/__tests__/reportApi.test.js src/utils/__tests__/reportTurnFrameworkFormatter.test.js
npm run lint
git add frontend/src/utils/reportPdf/reportPdfTemplate.js frontend/src/api/__tests__/reportApi.test.js frontend/src/utils/__tests__/reportTurnFrameworkFormatter.test.js
git commit -m "fix(report-pdf): export complete auditable feedback"
```

---

### Task 13: Expand report QA and the deterministic eval dataset

**Files:**
- Modify: `backend/src/services/agents/reportQaAgent.js`
- Modify: `backend/src/services/report/reportQaRepairOrchestratorService.js`
- Modify: `backend/eval/datasets/report-qa-eval.json`
- Modify: `backend/tests/robustness/report/reportFrameworkQa.test.js`

- [ ] **Step 1: Add RED QA cases**

Add deterministic cases for:

- real examples classified as zero despite direct-example signals;
- validation question mapped to motivation;
- evidence totals not equal to scored answers;
- overall metric not equal to final overall score;
- invalid answer rewrite;
- duplicate or snippet-free evidence references;
- 15 scored answers but fewer than 15 exported/displayed turns;
- conflicting numeric transcript claims without a visible warning.

- [ ] **Step 2: Verify RED**

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run tests/robustness/report/reportFrameworkQa.test.js
NODE_ENV=test AI_TEST_MODE=mock node eval/runners/runReportQaEval.js
```

Expected: new expected flags are absent and the eval gate reports failed checks.

- [ ] **Step 3: Add blocking integrity flags**

Blocking flags:

```js
const BLOCKING_REPORT_FLAGS = new Set([
  'rubric_question_mismatch',
  'evidence_total_mismatch',
  'score_metric_mismatch',
  'invalid_answer_rewrite',
  'uninformative_evidence_references',
  'turn_export_count_mismatch',
  'unacknowledged_transcript_conflict',
]);
```

Any blocking flag forces `passed: false`, `latestStatus: needs_review`, and a visible candidate-facing reason. An LLM repair may fix wording only; deterministic count, score, rubric, and evidence-reference failures require deterministic recomputation.

- [ ] **Step 4: Verify GREEN and commit**

```bash
cd backend && npm run test:report
NODE_ENV=test AI_TEST_MODE=mock node eval/runners/runReportQaEval.js
git add backend/src/services/agents/reportQaAgent.js backend/src/services/report/reportQaRepairOrchestratorService.js backend/eval/datasets/report-qa-eval.json backend/tests/robustness/report/reportFrameworkQa.test.js
git commit -m "test(report): gate integrity regressions"
```

---

### Task 14: Version the report contract and handle existing v5 reports safely

**Files:**
- Modify: `backend/src/services/agents/reportGenerator/reportDraftBuilder.js:224-225`
- Modify: `backend/src/services/schemaValidationService.js:140-194`
- Modify: `frontend/src/utils/reportView/viewModel.js`
- Modify: `frontend/src/hooks/useReportData.js`
- Modify: `frontend/src/hooks/__tests__/useReportData.test.jsx`

- [ ] **Step 1: Write RED legacy compatibility tests**

Assert that a v5 report containing `[補充情境]` or mojibake is loaded without crashing, hides the invalid rewrite, preserves all original scores as historical data, and shows `Regenerate this report for corrected scoring`.

- [ ] **Step 2: Verify RED**

Expected: v5 rewrite renders directly.

- [ ] **Step 3: Emit schema v6 for new reports**

Schema v6 adds:

- `reportTurnSummary`
- `candidateFeedback.answerRewriteStatus`
- `candidateFeedback.answerRewriteExamples[].status`
- `transcriptRisks`
- candidate-facing evidence reference rows
- targeted assessment metadata

Do not mutate stored v5 scores on read. Apply only presentation safety guards. Recalculation happens through explicit report regeneration.

- [ ] **Step 4: Verify GREEN and commit**

```bash
cd frontend && npm run test -- src/hooks/__tests__/useReportData.test.jsx src/utils
cd ../backend && npm run test:report
git add backend/src/services/agents/reportGenerator/reportDraftBuilder.js backend/src/services/schemaValidationService.js frontend/src/utils/reportView/viewModel.js frontend/src/hooks/useReportData.js frontend/src/hooks/__tests__/useReportData.test.jsx
git commit -m "feat(report): version integrity-safe report output"
```

---

### Task 15: Run the complete regression and visual acceptance gate

**Files:**
- No production changes unless a failing check identifies a defect.
- Generated verification files belong under `tmp/pdfs/` and must not be committed.

- [ ] **Step 1: Run focused backend tests**

```bash
cd backend
NODE_ENV=test AI_TEST_MODE=mock ./node_modules/.bin/vitest run \
  tests/robustness/report/reportTurnDatasetRobustness.test.js \
  tests/robustness/report/reportEvidenceClassificationRobustness.test.js \
  tests/robustness/report/reportContentQualityRobustness.test.js \
  tests/robustness/report/reportFrameworkPipeline.test.js \
  tests/robustness/report/reportFrameworkQa.test.js \
  tests/robustness/agent/starRubricRobustness.test.js \
  tests/unit/transcriptNormalizer.test.js
```

Expected: all pass, no warnings caused by report code.

- [ ] **Step 2: Run package quality checks**

```bash
cd backend && npm run lint && npm run test:all
cd ../frontend && npm run quality:all
```

Expected: all pass. Do not run `backend npm run quality:all` or real AI evals without explicit credential/cost approval.

- [ ] **Step 3: Generate a fixture PDF**

Use the deterministic regression fixture to generate a PDF without live AI. The artifact must contain:

- at least three real examples;
- Q2 validation rubric, not motivation;
- Q3 action present and 12-to-3-second result;
- Q6 result scored clearly for 15%-to-5%;
- no Chinese scaffold, mojibake, or bracket prompt;
- every scored question;
- evidence claims with snippets;
- consistent overall, CV-JD, and interview scores.

- [ ] **Step 4: Render and inspect every page**

```bash
mkdir -p tmp/pdfs/constructive-report-v6
pdftoppm -png -r 150 tmp/pdfs/constructive-report-v6/report.pdf tmp/pdfs/constructive-report-v6/page
pdftotext -layout tmp/pdfs/constructive-report-v6/report.pdf tmp/pdfs/constructive-report-v6/report.txt
rg -n '補充|說明|Š|Ã|\[.*\]|Q15|15%|3 seconds|Validation' tmp/pdfs/constructive-report-v6/report.txt
```

Expected: no corrupt or bracket-prompt match; expected content matches are readable. Visually confirm no clipping, overlap, empty spill page, broken footer, or misleading omission.

- [ ] **Step 5: Run mock report QA eval**

```bash
cd backend && NODE_ENV=test AI_TEST_MODE=mock node eval/runners/runReportQaEval.js
```

Expected: average `1.00` and no weakest cases.

- [ ] **Step 6: Obtain separate approval before real report regeneration**

Regenerating session `62269744-d831-417b-8061-a31c8573f077` can use real AI credentials and incur cost. After approval, regenerate only that report, render the new PDF, and compare the disputed fields against this acceptance checklist. Do not silently overwrite the historical artifact; preserve version history.

- [ ] **Step 7: Final scoped commit if verification required no code changes**

No commit is needed for temporary PDF files or generated eval reports unless the repository intentionally tracks the deterministic eval summary.

---

## Acceptance criteria

- Q3, Q4, and Q6 are recognised as direct past examples; mixed transfer language does not erase past evidence.
- Q2 cannot use the company/role motivation rubric.
- Q3 action is at least partial and its 12-second-to-3-second result is clear.
- Q4 does not receive a clear result or reflection solely from `user`, `feedback`, `learn`, `better`, or `great` keywords.
- Q6 recognises the percentage result; a 15-versus-50 source conflict is shown as uncertainty, not silently resolved.
- Q5 is evaluated as a targeted result follow-up and is not penalised for omitting Task and Action restatement.
- Q7 uses trade-off/constraint reasoning, not full STARR.
- Completion, evidence totals, turn breakdown count, UI count, and PDF count reconcile to the same accepted-answer population.
- The evidence snapshot’s overall score equals the top-level overall score.
- LLM output cannot alter deterministic metric values or rubrics.
- Invalid rewrites are never rendered as stronger answers.
- Evidence sources include claims, source labels, snippets, and confidence; duplicate `Job requirement` cards do not pass QA.
- ASR raw text, normalized text, corrections, and confidence provenance remain available.
- Focused tests, backend `test:all`, frontend `quality:all`, deterministic report QA eval, and visual PDF inspection pass.

## Explicitly deferred without separate approval

- Installing a Unicode font package or embedding a multilingual font in jsPDF.
- Running real AI evaluations or regenerating the real stored report.
- Backfilling all historical reports.
- Changing the 50/50 CV-JD/interview blend weight; this plan fixes consistency and evidence quality, not product weighting policy.
- Pushing branches or commits to a remote repository.
