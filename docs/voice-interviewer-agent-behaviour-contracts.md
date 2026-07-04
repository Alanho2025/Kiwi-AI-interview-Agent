# Voice Interviewer Agent Behaviour Contracts

Branch: voice-interviewer-clean-refactor
Status: historical Phase 0 contract draft; current product behavior is governed by `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`
Runtime code changed: no

## Purpose

This document records the current responsibilities and refactor boundaries for the voice interviewer agent files before runtime code is changed.

The contracts follow the Phase 2 safe refactoring rule: document current behaviour first, add tests, then refactor in small stages.

## 1. File: backend/src/services/agents/interviewerAgent.js

Risk level: High
Area: Agent orchestration
Current responsibility: Selects the next interviewer question or interviewer turn based on session state, action type, decision context, retrieval context, focus area, evaluator state, and fallback logic.

### Public behaviour to preserve

- Selects a question based on action type.
- Uses pool questions when suitable.
- Uses controller-directed fallback questions when needed.
- Applies interview mode guard before final generation.
- Normalizes question intent before generation.
- Builds a ReAct-style trace summary for decision explainability.
- Calls the conversational LLM turn generator.
- Falls back to selected question text if generation fails.
- Applies generated text guard after LLM output.
- Returns question metadata, display text, rationale, stage, topic, category, evidence hint, retrieval snapshot, and decision trace.

### Important inputs

- session
- userId
- actionType
- targetTopic
- probeType
- category
- freshOnly
- decisionContext
- retrievalBundle
- focusArea
- lastUserAnswer
- onSentence callback

### Important outputs

- questionType
- nextQuestion
- interviewerTurn
- displayText
- rationale
- rationaleSummary
- stage
- topic
- followUpDepth
- sourceType
- questionCategory
- evidenceTypeHint
- questionDecision
- questionRanking
- retrievalSnapshot
- isComplete
- reactTrace

### Side effects

- Calls LLM generation through DeepSeek service.
- Can stream sentences through onSentence.
- Emits warnings when LLM generation fails.
- Does not directly own STT, TTS, WebSocket, or audio lifecycle.

### Fallback behaviour to preserve

- If the planned interview limit is reached, returns wrap-up completion state.
- If selected question is missing, builds a recovery question.
- If generated text fails, falls back to selected question text.
- If mode guard replaces a question, normalized intent is still applied after guarding.

### Disallowed changes during behaviour-preserving refactor

- Do not change action type routing.
- Do not change return object shape.
- Do not change selected question field names.
- Do not change guard order.
- Do not change LLM call timing.
- Do not change question decision trace shape.
- Do not change completion behaviour.
- Do not change session state or voice telemetry.

### Allowed extraction candidates

- Pure question builder helpers.
- Question intent normalization helpers.
- Evidence hint inference helpers.
- ReAct trace builder helper.
- Candidate-facing topic wording helper after behaviour-changing phase approval.

### Tests needed before refactor

- Action type to selected question mapping.
- Fallback selected question shape.
- Completion result shape when question limit is reached.
- Generated text fallback when LLM throws.
- Guard order around selected question and generated text.
- Returned questionDecision shape.

## 2. File: backend/src/services/agents/interviewerAgentQuestionBuilder.js

Risk level: High
Area: Agent question builder
Current responsibility: Provides reusable helper functions for building question intent objects and question text used by the interviewer agent.

### Public behaviour to preserve

- Normalizes text and tokens.
- Gets last user answer from transcript.
- Infers question goals from question type or action type.
- Infers evidence needs from question goal.
- Builds constraints from question and focus area.
- Normalizes question intent into a stable question object.
- Builds role-locked questions from retrieval items.
- Selects retrieved questions from retrieval bundles.
- Builds root keys for duplicate question detection.
- Picks priority technical topics.
- Infers requirement category from topic.
- Builds matched technical recovery questions.
- Builds closing, probing, rephrased, deep-dive, validation, switch-topic, abductive, section-shift, project-shift, stress, and friction questions.
- Builds trace summaries.

### Important outputs to preserve

Question builder outputs should keep these fields where currently present:

- type
- stage
- topic
- category
- followUpDepth
- text
- reason
- sourceType
- sourceId when relevant
- modeGuardApplied when relevant
- originalQuestion when relevant

### Disallowed changes during behaviour-preserving refactor

- Do not change text content in Phase 2.
- Do not change reason text in Phase 2.
- Do not change sourceType values in Phase 2.
- Do not change category or stage mapping in Phase 2.
- Do not change followUpDepth values in Phase 2.
- Do not remove exported helpers used by existing callers.

### Allowed extraction candidates

- Topic normalization helper.
- Candidate-facing topic phrase helper during Phase 3.
- Spoken template constants during Phase 3.
- Question quality diagnostics during Phase 6.

### Tests needed before refactor

- Output snapshots for each builder helper.
- normalizeQuestionIntent field preservation.
- inferQuestionGoal mapping.
- inferEvidenceNeed mapping.
- duplicate root key generation.
- retrieval question selection fallback order.

## 3. File: backend/src/services/aiControl/interviewModeGuard.js

Risk level: High
Area: AI control and mode boundary guard
Current responsibility: Enforces selected interview mode as a backend rule and prevents generated or selected questions from crossing technical and behavioural mode boundaries.

### Public behaviour to preserve

- Normalizes interview mode.
- Detects technical-looking questions.
- Detects behavioural-looking questions.
- Rewrites selected questions when the selected mode would otherwise be violated.
- Sanitizes ungrounded entity framing in generated text.
- Guards generated text against mode drift.

### Disallowed changes during Phase 5 wording cleanup

- Do not change mode normalization.
- Do not change technical detection regex unless separately approved.
- Do not change behavioural detection regex unless separately approved.
- Do not change when the guard applies.
- Do not weaken behavioural mode restrictions.
- Do not weaken technical mode restrictions.

### Allowed Phase 5 change

- Shorten fallback question wording only.
- Keep the same mode guard routing and replacement behaviour.

### Tests needed before wording cleanup

- Behavioural mode blocks technical style questions.
- Technical mode blocks purely behavioural style questions.
- Combined mode leaves questions unchanged.
- Generated text guard keeps valid text.
- Generated text guard falls back when mode drift is detected.

## 4. Product improvement phases covered by this contract

Phase 2 is behaviour-preserving only.

Phase 3, Phase 4, Phase 5, and Phase 6 are behaviour-changing or diagnostic phases. They must be reviewed separately and tested with before and after examples.

## 5. Check commands

Preferred checks when scripts exist:

```bash
cd backend
npm run lint
npm run test:agent
npm run test:voice
```

If scripts are unavailable in the current branch or environment, record the missing command in the PR notes instead of pretending it passed.
