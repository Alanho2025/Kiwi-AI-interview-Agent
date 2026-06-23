# Implementation Workflows

This document explains the current implemented workflow in the `Alan-workplace` branch, aligned with code on 2026-06-23.

## End-to-end product workflow

```text
User login
  -> CV upload or recent CV selection
  -> CV text extraction and profile parsing
  -> CV human review
  -> JD paste
  -> guarded JD parse into structured rubric
  -> JD human review
  -> session setup
  -> CV-JD match analysis
  -> JD question filter creation
  -> interview plan generation
  -> prepared question pool composition
  -> preparation-time question deduplication and readiness checks
  -> text or voice interview
  -> adaptive next-turn control and final transcript novelty guard
  -> interview completion
  -> canonical accepted-answer report dataset
  -> report generation, QA, optional bounded repair, and versioned persistence
```

The workflow is gated at the user-facing level. The user must review the parsed CV fields and structured JD rubric before generating the match and interview plan.

## CV pipeline

### Purpose

The CV pipeline turns an uploaded or reused CV into structured candidate evidence.

### Flow

```text
Upload or select CV
  -> extract text from PDF or DOCX
  -> parse CV profile
  -> store original document and parsed content
  -> generate CV question seeds
  -> user reviews match-relevant fields
  -> refresh CV question seeds after review
```

### Key behavior

- The CV review gate prevents matching before the user confirms parsed CV evidence.
- The review is focused on match-relevant fields, not full resume editing.
- CV seed generation supports later question preparation.
- If seed generation fails, the system may continue with fallback behavior. This should be considered a resilience path, not a strict correctness guarantee.

## JD pipeline

### Purpose

The JD pipeline turns pasted job description text into a structured rubric for matching and question planning.

### Flow

```text
Paste JD
  -> clear stale structured JD if raw JD changed
  -> guarded JD parse
  -> structured rubric generation
  -> safeguard result returned
  -> user reviews or edits structured JD
  -> verified JD becomes eligible for match and planning
```

### Key behavior

- The implemented JD input path is pasted text.
- JD file upload should remain future work unless new code is added.
- JD confidence is a signal, but human review is the main gate.
- Company value enrichment is supportive and best-effort. It should not be described as a hard requirement for interview start.

## CV-JD match workflow

### Purpose

The match workflow compares reviewed CV evidence with reviewed JD requirements and stores match evidence for later interview planning.

### Flow

```text
Reviewed CV + reviewed JD rubric
  -> run CV-JD match analysis
  -> store match analysis record
  -> create strengths, gaps, fit signals, and evidence references
  -> build JD question filter
  -> pass matchAnalysisId into interview plan generation
```

### Key behavior

- Match should be generated only after CV and JD review gates.
- Match output is not just a displayed score. It also feeds question planning and report grounding.
- JD question filter failure is treated as a fallback path. It should be visible through diagnostics where possible.

## Question pipeline

### Purpose

The question pipeline prepares candidate-specific and role-specific question material, then lets the adaptive controller decide what to ask next.

### Flow

```text
CV profile
  -> CV question seeds
JD rubric + match analysis
  -> JD question filter
CV seeds + JD filter + match gaps + settings
  -> prepared question pool
  -> deduplicate equivalent assessment goals and fingerprints
User answer + transcript + retrieved evidence
  -> answer understanding
  -> evaluator
  -> decision context
  -> action planning
  -> selected question or follow-up
  -> final spoken-question novelty guard against transcript history
  -> next unique question or safe wrap-up
```

### Key behavior

- CV seeds are not final questions by themselves.
- The prepared question pool is a candidate pool, not a fixed script.
- The adaptive controller can ask prepared questions, generated follow-ups, gap validation questions, or move to a new topic.
- Prepared-pool deduplication and the final spoken-question guard use assessment keys and normalized fingerprints while preserving distinct follow-up intents.
- If neither the selected question nor an alternative is unique, the interview closes with `no_unique_question_remaining` instead of repeating an assessment-equivalent question.
- Question metadata should record why a question was asked, what evidence was used, and whether it came from a prepared source or generated follow-up.

## Text interview workflow

### Purpose

Text mode is the safest and most stable demo path.

### Flow

```text
Start interview
  -> opening self-introduction question
  -> user submits text answer
  -> answer is stored
  -> adaptive next-turn task runs
  -> next question is stored and returned
  -> repeat until question limit, time limit, or manual end
  -> report generation can be triggered after completion
```

### Key behavior

- Text mode avoids STT, browser audio, and TTS dependencies.
- The first question is template-based and should not need retrieval.
- Later questions use the adaptive controller.

## Voice interview workflow

### Purpose

Voice mode provides a product-level interview experience with speech input and speech output.

### Flow

```text
Frontend opens duplex WebSocket
  -> backend validates session and authentication
  -> client sends session_start
  -> backend starts the configured STT provider order and sends session_ready
  -> user speaks
  -> speech_start and audio chunks are sent
  -> speech_end finalizes STT
  -> transcript confidence gate runs
  -> accepted transcript enters adaptive turn processing
  -> assistant response is streamed as text through the independently configured TTS provider order
  -> turn_done is sent
```

### Transcript gate behavior

| Gate result | Behavior |
| --- | --- |
| Accepted | Save the answer and run adaptive next-turn processing |
| Rejected | Ask the user to repeat or clarify. Do not score the bad transcript as an answer |
| Needs confirmation | Ask the user to confirm or correct the transcript before moving on |

### Key behavior

- Voice mode is safer but more complex than text mode.
- Transcript repair and confirmation can add extra turns.
- Audio sent before `speech_start` may be ignored.
- Bridge acknowledgements may be used when the next question is slow, but this is not the same as an instant guaranteed response.
- Azure is the default STT/TTS provider. ElevenLabs can be configured as the session-start fallback for either path independently.
- STT does not switch providers in the middle of an active recording turn.
- Live quality depends on configured-provider credentials, browser permissions, and WebSocket connection health.

## Voice recording workflow

### Purpose

The recording workflow preserves the interview audio without blocking live turn latency or report navigation.

### Flow

```text
MediaRecorder chunk
  -> persist chunk in browser IndexedDB
  -> low-priority single-flight upload
  -> backend manifest and idempotent chunk storage
  -> finalize after all sequences are present
  -> durable conversion worker assembles and converts MP3
  -> report page polls status and offers retry or download
```

### Key behavior

- Report navigation waits for the final chunk to be locally durable, not for remote upload or conversion.
- Reload or temporary network failure can resume unacknowledged chunks from the same browser profile.
- Backend initialization, chunk upload, finalization, and retry are ownership-checked and idempotent.
- The legacy single-request recording upload remains supported, but the product path uses resumable upload.
- Report readiness and recording readiness are separate states.

## Report generation and QA workflow

### Purpose

The report workflow turns the completed interview into an evidence-grounded feedback artifact.

### Flow

```text
Interview completed
  -> session artifacts are indexed
  -> CV, JD, interview plan, prepared pool, and transcript evidence are retrieved
  -> countable interview questions are paired with accepted user answers
  -> report decision context is built
  -> deterministic rubric selection and scores are computed
  -> report is generated with claim evidence and transcript-risk warnings
  -> report QA checks grounding, consistency, rubric use, rewrites, and visible risk handling
  -> eligible wording failures may be repaired and re-grounded at most twice
  -> report version, repair history, QA attempts, and final status are persisted
```

### Key behavior

- The report is not only a transcript summary.
- It uses CV, JD, interview plan, question pool, and accepted transcript evidence.
- Repair, confirmation, clarification, repeat, acknowledgement, and system turns do not enter the scored report dataset.
- Root behavioural questions, targeted follow-ups, self-introduction, company motivation, and role-specific questions can use different assessment contracts.
- QA repair is bounded to two wording attempts and always re-grounds changed claims. Deterministic integrity flags are not hidden by a rewrite.
- Final statuses are `ready`, `ready_after_repair`, `needs_review`, or `repair_failed`.
- If report generation fails during interview completion, the interview flow may still finish. This is a resilience behavior.

## Diagnostics workflow

### Purpose

Diagnostics support debugging of the question pipeline and prepared question usage.

### Useful diagnostic questions

- Were CV seeds generated?
- Was a JD question filter built?
- How many prepared question pool items exist?
- Which questions were asked?
- Were prepared questions used, skipped, or replaced by generated follow-ups?
- What was the selected action and fallback action?
- What evidence was used for the next question?

Diagnostics are important because some preparation failures are fallback paths rather than hard failures.
