# Voice Interview Product Behavior Specification

This document defines the expected product behavior for the Kiwi AI Voice Interview flow.

Any agent or developer working on voice interview behavior must read this document before changing voice interview code, tests, prompts, latency handling, transcript handling, question planning, or question selection.

## Product goal

Kiwi AI Voice Interview should behave like a live interviewer, not like a raw speech-to-text tool.

The intended loop is:

1. The assistant asks a question using the configured TTS provider. Azure is the default; ElevenLabs can be configured independently as the fallback.
2. The user answers naturally for about 1 to 2 minutes.
3. The system listens, transcribes, and interprets the answer.
4. The system handles speech uncertainty through repair or confirmation.
5. The system evaluates the answer and selects the next useful question.
6. The next question starts speaking within 3 seconds after the user stops speaking.
7. The loop continues until the interview time or question limit ends.

## Voice turn state machine

The voice flow must be treated as a state machine. Avoid patching isolated flags without checking the whole turn lifecycle.

Required states:

- `assistant_speaking`: the selected TTS provider is playing the interviewer question.
- `waiting_for_user`: TTS has ended and VAD is waiting for the user.
- `user_speaking`: VAD has detected the user and audio is being streamed.
- `stt_finalizing`: frontend has sent speech end and backend is waiting for final STT output.
- `transcript_rejected`: transcript is empty, too short, filler, or unusable.
- `transcript_needs_confirmation`: transcript is contentful but ASR confidence is low.
- `transcript_confirmed`: the user confirmed the system's understanding.
- `answer_processing`: answer is saved, evaluated, and used to select the next question.
- `next_question_speaking`: the next question is generated and sent to the selected TTS provider.

Every voice change must define whether the state should:

- send microphone audio
- run VAD
- save transcript
- save interview answer
- run scoring or evaluator logic
- update `currentQuestionIndex`
- count as a question
- allow barge-in
- trigger next question warmup

## STT confidence behavior

Speech confidence is system understanding quality. It is not the same as user answer quality.

### Empty, too short, filler, or no final STT segment

Behavior:

- Do not save as an interview answer.
- Do not score.
- Do not update `currentQuestionIndex`.
- Do not count as a question.
- Ask the user to repeat or give a fuller answer.

Example response:

> I did not catch that clearly. Could you repeat your answer?

### Contentful but low-confidence transcript

A long answer with low ASR confidence must not be dropped.

Example case:

- user spoke for 40 seconds to 2 minutes
- transcript has meaningful content
- word count is substantial
- ASR confidence is low

Behavior:

- Do not directly score.
- Do not directly ask the next interview question.
- Do not discard the answer.
- Do not count this repair step as a question.
- Store the original transcript as a pending confirmation item.
- Ask a short understanding confirmation question.

Example response:

> I heard that you were comparing MongoDB and PostgreSQL. It sounds like you said MongoDB fits flexible CV and JD data, while PostgreSQL fits structured relational data. Did I understand that correctly?

If the user confirms:

- process the original pending answer
- save it as the answer to the current interview question
- run answer evaluation
- select and generate the next question

If the user corrects or rejects the understanding:

- ask the user to clarify or repeat
- keep the interview on the same question
- do not score the rejected transcript

## Turn counting rules

Only real interview questions count toward the interview question count.

Count these:

- root interview question
- follow-up interview question
- validation question
- deep-dive question
- section shift question
- closing question

Do not count these:

- repair prompt
- transcript confirmation
- transcript clarification
- repeat request
- system status message
- barge-in acknowledgement

Use explicit turn types where possible:

```js
turnType:
  | 'interview_question'
  | 'user_answer'
  | 'repair_prompt'
  | 'transcript_confirmation'
  | 'clarification'
  | 'system'
```

## Latency target

The product latency target is:

```text
user speech end -> next question first audio <= 3 seconds
```

Do not measure only backend completion. The user feels latency when they stop talking and wait for the assistant to start speaking.

Trace these milestones:

- `speech_end_received`
- `stt_final_ready`
- `confidence_gate_done`
- `confirmation_needed_or_not`
- `answer_saved`
- `evaluator_done`
- `action_selected`
- `question_ranked`
- `first_sentence_ready`
- `tts_first_audio`
- `frontend_playback_started`

If latency exceeds the target, identify the slow stage before changing behavior.

## Noise handling expectation

The system should reduce background noise and ignore short accidental speech where possible.

Supported target behavior:

- adaptive noise floor
- speech start confirmation
- barge-in confirmation
- minimum speech duration
- silence duration tuning
- short noise rejection

Do not claim full speaker isolation in browser voice mode unless speaker verification or diarization is implemented.

The current realistic product claim is:

> The system reduces background noise and ignores short accidental speech where possible, but full speaker isolation is not guaranteed in browser-based voice mode.

## Speech provider routing

STT and TTS routing are independent product concerns.

- Azure is the default STT and TTS provider.
- ElevenLabs can be configured as the fallback for either path without forcing the other path to use ElevenLabs.
- STT fallback is allowed while a speech session is starting. Do not switch the provider in the middle of an active recording turn.
- A frontend microphone/speaker readiness check does not prove that either external speech provider is healthy.
- Provider selection and fallback must preserve transcript-confidence handling, question counting, barge-in behavior, and latency traces.

The relevant runtime configuration is `VOICE_STT_PROVIDER`, `VOICE_STT_FALLBACK_PROVIDER`, `VOICE_STT_PROVIDER_ORDER`, `VOICE_TTS_PROVIDER`, `VOICE_TTS_FALLBACK_PROVIDER`, and `VOICE_TTS_PROVIDER_ORDER`.

## Session recording behavior

Voice recording is a separate, non-latency-critical path from live STT and next-question generation.

- Audio chunks are persisted in browser IndexedDB before upload acknowledgement.
- Chunk upload is resumable and idempotent.
- Report navigation waits only for local recording durability, not for full upload or MP3 conversion.
- Backend assembly and MP3 conversion run asynchronously through the recording worker.
- The report page must show recording progress, retryable failure, ready, or unavailable state separately from report readiness.
- Closing the browser before all chunks are uploaded can delay completion; recovery resumes when the same browser profile opens the application again.

## Interview question sources

The interview plan should consider five question sources:

1. `culture_fit`
2. `cv_template`
3. `jd_requirement`
4. `match_gap`
5. `common_template`

Questions should include metadata when possible:

```js
{
  id,
  sourceType,
  category,
  topic,
  competency,
  questionText,
  linkedCvEvidence,
  linkedJdRequirement,
  matchGapId,
  cultureFitDimension,
  expectedSignal,
  followUpStrategy,
  priorityWeight
}
```

## Next question behavior

The system must not simply do `questionIndex + 1` without reasoning.

After each accepted answer, the system should consider:

- whether the answer is complete
- whether STAR evidence is complete where relevant
- whether personal action is clear
- whether result or impact is clear
- whether the answer addresses JD requirements
- whether a match gap remains unresolved
- whether there is a culture-fit signal to test
- whether the topic is still worth probing
- whether it should switch topic
- whether there is enough time for another deep follow-up

The controller may choose actions such as:

- ask follow-up
- ask deep-dive
- ask validation question
- switch topic
- ask fresh pool question
- wrap up

## Question ranking and transparency

The product must be able to explain why a question was asked.

It is not enough to know the selected action. The system should also record question-level ranking and reasoning.

Expected metadata:

```js
questionDecision: {
  selectedAction,
  selectedQuestionId,
  sourceType,
  whyThisQuestion,
  evidenceUsed,
  expectedSignal,
  ranking,
  alternativesConsidered,
  confidence,
  selectionSource
}
```

Expected ranking shape:

```js
questionRanking: {
  selectedQuestionId: 'q_database_validation_001',
  selectedScore: 1.42,
  rankingReason: 'Selected because the candidate mentioned MongoDB/PostgreSQL, the JD requires database experience, and database evidence is still partial.',
  topCandidates: [
    {
      questionId: 'q_database_validation_001',
      sourceType: 'match_gap',
      score: 1.42,
      reasons: [
        'match_gap_unresolved',
        'linked_to_latest_answer',
        'jd_requirement_database',
        'needs_validation_evidence'
      ]
    }
  ]
}
```

This ranking does not need to replace the existing action planner. It should make the existing behavior more transparent and evidence-backed.

Preferred architecture:

```text
user answer
-> evaluator
-> action planner selects intent
-> question ranker ranks concrete candidate questions
-> interviewer agent converts selected question into spoken text
-> transcript metadata stores question decision and ranking trace
```

## Role of the LLM

The LLM should not freely decide the next question without traceability.

Preferred split:

- deterministic controller and ranking logic decide what should be asked and why
- LLM converts the selected question into short, natural spoken interviewer text

This keeps latency, transparency, and product control stronger.

## Time ending behavior

When interview time ends:

- If the assistant is speaking, do not open a new question chain.
- If the user is answering, allow the current answer to finish where possible.
- If the system is in transcript confirmation, do not open a new question.
- Process the last usable answer or clearly explain that time has ended.
- Move to closing or report generation without breaking the voice state machine.

## Non-negotiable product rule

Low-confidence STT must not silently discard a contentful answer.

If the transcript is contentful but uncertain, the product must confirm understanding instead of treating the user as if they failed to answer.
