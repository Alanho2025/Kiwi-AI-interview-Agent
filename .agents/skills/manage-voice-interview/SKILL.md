---
name: manage-voice-interview
description: |
  Acts as the state machine and logic controller for an active voice or text interview session.
  Use this skill when conducting a live interview, selecting the next question, or handling transcript updates.
  Do NOT use for post-interview report generation.
version: 1.0.0
license: MIT
allowed-tools: [Read, Bash, Write]
---
# Manage Voice Interview

## When to use
- Handling a live interview session turn (user speech end -> next question generation).
- Managing transcript confirmations and handling low-confidence STT.
- Enforcing the 3-second latency target for the next question.

## When NOT to use
- Do NOT use for planning the interview before it starts.
- Do NOT use for generating the final evaluation report after the session concludes.

## Workflow
1. **State Machine Execution**: Treat the interview as a state machine, not a collection of isolated flags.
2. **Transcript Handling**:
   - Evaluate Speech-to-Text (STT) confidence.
   - Low-confidence STT is a system understanding issue, not automatically a failed user answer. Contentful low-confidence transcripts MUST go through understanding confirmation instead of being silently discarded or directly scored.
3. **Question Selection**:
   - Preserve transparency: record *why* the next question was selected, *what* evidence supported it, and *what* it is expected to test.
   - The LLM should primarily naturalize selected questions into spoken text. Let the deterministic controller decide what should be asked.
4. **Accounting**: 
   - Repair prompts, transcript confirmations, clarification turns, repeat requests, system messages, and barge-in acknowledgements must NOT count as interview questions.
5. **Latency**:
   - Ensure the product latency target is met: `user speech end -> next question first audio <= 3 seconds`.
6. Refer to the project's `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` for extended logic regarding duplex WebSocket logic and VAD.
