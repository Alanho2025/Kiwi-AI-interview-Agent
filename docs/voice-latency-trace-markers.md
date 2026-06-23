# Voice Latency Trace Markers

## Purpose

This document explains the current voice latency observability path. It should be treated as an implementation alignment note, not as a claim that all latency targets are always met.

The trace layer measures the path from user speech ending to the next assistant audio becoming available. It does not change interview decision logic, prompts, retrieval scope, VAD threshold, or TTS workflow.

## Code References

- Backend trace utility: `backend/src/utils/latencyTrace.js`
- Backend latency summary service: `backend/src/services/latency/voiceLatencySummaryService.js`
- Realtime voice turn processing: `backend/src/services/voice/realtimeVoiceTurnService.js`
- Duplex turn coordination: `backend/src/services/voice/duplexTurnCoordinator.js`
- Frontend trace helper: `frontend/src/utils/voiceLatencyTrace.js`
- Frontend summary helper: `frontend/src/utils/voiceLatencySummary.js`
- Frontend voice shell: `frontend/src/hooks/useVoiceInterviewSession.js`

## Adaptive Markers

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

## Existing Duration Steps Kept

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

## Frontend Runtime Markers

The frontend voice shell records:

- `vad_config`
- `vad_speech_end`
- `first_audio_chunk_received`
- `tts_audio_chunk_received`
- `assistant_audio_play_start`
- `assistant_audio_play_end`

The browser also tracks socket/network health through `useDuplexVoiceSocket`, including socket-open time, RTT, jitter, first partial transcript timing, and final transcript timing.

## Targets

`backend/src/services/latency/voiceLatencySummaryService.js` currently defines these latency targets:

| Target | Current value |
| --- | --- |
| VAD silence | 1600ms |
| ASR finalise | 1200ms |
| Adaptive processing | 3000ms |
| TTS | 1500ms |
| Speech stop to next audio | 5500ms |

These are diagnostic thresholds. They are useful for warnings and bottleneck analysis, not formal service-level guarantees.

## Where To Check After Testing

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

## Current Status

Status: implemented as observability; live E2E validation still required.

The code can trace latency across backend and frontend voice flows, but a final report should still say that full voice latency validation depends on credentials for the configured Azure/ElevenLabs STT and TTS order, authenticated WebSocket access, browser microphone permission, network conditions, and a live interview session.
