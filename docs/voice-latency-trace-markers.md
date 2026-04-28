# Voice latency trace markers

This patch only adds observability. It does not change the voice interview decision logic, prompts, retrieval scope, VAD threshold, or TTS workflow.

## New adaptive markers

The realtime voice backend now emits these markers inside `Realtime voice turn latency` and the console summaries:

- `adaptive.indexing_check_start`
- `adaptive.indexing_check_end`
- `adaptive.retrieval_start`
- `adaptive.retrieval_end`
- `adaptive.environment_build_start`
- `adaptive.environment_build_end`
- `adaptive.turn_evaluation_start`
- `adaptive.turn_evaluation_end`
- `adaptive.decision_context_start`
- `adaptive.decision_context_end`
- `adaptive.action_selection_start`
- `adaptive.action_selection_end`
- `adaptive.action_execution_start`
- `adaptive.action_execution_end`
- `adaptive.llm_first_token`
- `adaptive.llm_first_sentence`
- `adaptive.tts_first_audio`

## Existing duration steps kept

The existing duration records are still preserved, such as:

- `adaptive_next_question`
- `adaptive.indexing_check`
- `adaptive.retrieval`
- `adaptive.environment_build`
- `adaptive.turn_evaluation`
- `adaptive.decision_context`
- `adaptive.action_selection`
- `adaptive.action_execution`
- `stream_sentence_tts_0`

## Where to check after testing

Backend terminal:

```txt
Realtime voice turn latency
Realtime voice turn latency summary
```

Frontend browser console:

```txt
[voice-latency-summary:first-audio]
[voice-latency-summary:playback-start]
[voice-latency-summary:backend-complete]
```

Use these values to identify whether the bottleneck is retrieval, decision context building, action execution, LLM first token, first sentence, or TTS first audio.
