# Interview Question Deduplication V2 Implementation Plan

> Status: implemented by commit `363b224` on 2026-06-22. The unchecked checklist below is the original plan, not the current implementation state. Current behavior is documented in `docs/implementation-workflows.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before handoff.

**Goal:** Prevent text, realtime voice, and duplex voice from automatically asking exact or assessment-equivalent duplicate questions while preserving valid follow-ups, user-requested repeat, repair/confirmation counting, transparent ranking, and the three-second voice latency target.

**Architecture:** CV/JD preparation owns cross-source pool deduplication and readiness. Live interview selection treats the transcript as the source of truth, hard-filters previously asked assessment goals, and runs a final local novelty guard before streaming or TTS. No live reserve generation, external semantic API, new dependency, or destructive migration is introduced.

---

## Implementation checklist

- [ ] Add a pure question novelty service with transcript history, assessment keys, fingerprints, canonical aliases, and conservative lexical similarity.
- [ ] Deduplicate and merge prepared pool items by assessment key and fingerprint; persist novelty metadata and readiness diagnostics.
- [ ] Hard-filter prepared and legacy runtime candidates against the complete transcript while preserving distinct follow-up intents.
- [ ] Guard naturalized/fallback text before `onSentence` and TTS; close with `no_unique_question_remaining` when no legal candidate remains.
- [ ] Separate spoken/countable/repair histories; keep repair, confirmation, clarification, repeat, and system turns out of question counts.
- [ ] Rebuild legacy session novelty state from transcripts and expose non-sensitive diagnostics.
- [ ] Honor repetition-driven `switch` actions and enforce the 3000 ms voice first-audio gate.
- [ ] Run focused question, voice, and agent tests, lint, the full mock backend suite, and the mock voice robustness evaluation.

## Fixed product decisions

- Root key: `root:<canonicalTopic>:<questionFamily>`.
- Follow-up key: `follow_up:<rootQuestionId|rootTopic>:<followUpIntent>:<evidenceTarget>`.
- Repair key: `repair:<parentQuestionId>:<scenario>`.
- Fingerprints use Unicode NFKC, lowercase, behavioural spelling normalization, punctuation removal, and collapsed whitespace.
- Near duplicates require at least five meaningful tokens and either containment `>= 0.85` or Jaccard `>= 0.75`.
- User-requested repeat is an explicit exception and does not mutate the transcript or question count.
- Pool exhaustion ends safely rather than repeating a question.
- Transcript history is authoritative; Mongo prepared status is a repairable cache.
- Voice remains limited to one blocking LLM call and local novelty checks only.

## Acceptance criteria

- The supplied ownership and collaboration transcripts are regression fixtures and no longer permit the repeated root questions.
- Prepared and runtime pools cannot select duplicate fingerprints or root assessment keys.
- Distinct result, validation, trade-off, and reflection follow-ups remain legal.
- LLM naturalization and fallback cannot bypass the final spoken-question guard.
- Repair/confirmation/clarification turns do not increment the interview question index or overwrite the original persisted question.
- `speech_end -> first_audio` is gated at 3000 ms.
- No new dependency, PostgreSQL migration, or destructive historical backfill is required.
