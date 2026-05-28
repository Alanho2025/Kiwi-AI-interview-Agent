# Voice Interview Next Question Pause Bug Analysis

## Issue Summary

**Symptom**: Next interview question only appears after user clicks pause button, not automatically after answering.

**Date Observed**: 2026-05-28  
**Session ID**: `330b9a01-618a-4daf-85ba-1de75ee2631b`  
**Actual Latency**: 34.2 seconds (user speech end → backend completion)  
**Target Latency**: ≤3 seconds (per `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`)  
**Latency Violation**: **11.4x over target**

## Root Cause

The LLM call to naturalize the next interview question into conversational text **timed out after 30+ seconds**, blocking the entire voice turn flow. The DeepSeek API returned "Service Unavailable" errors, causing multiple retries and eventual timeout.

### Timeline from Logs

```
11:19:49.418Z - User speech ends, transcript accepted (medium confidence, 134 words)
11:19:50.520Z - Answer evaluation starts
11:19:51.891Z - Action selection: PROBE_FRICTION
11:19:52.169Z - Action execution starts (calls interviewerAgent)
             ↓
             [30 seconds of DeepSeek API failures]
             ↓
11:20:23.623Z - Backend completes (34.2s total latency)
11:20:23.625Z - warmup_skipped_no_next_question logged
11:20:25.515Z - User clicks pause
             ↓
             Question finally appears in UI
```

### Key Log Evidence

1. **DeepSeek API Failures**:
```
DeepSeek API Error: Error: DeepSeek API error: Service Unavailable
Failed to generate conversational turn via LLM, falling back to base template
DOMException [TimeoutError]: The operation was aborted due to timeout
```

2. **Action Execution Bottleneck**:
```
step: adaptive.action_execution
durationMs: 30007  ← 30 seconds blocked here
ok: true
```

3. **Total Turn Latency**:
```
name: realtime_voice_turn
totalMs: 34203
```

4. **Warmup Skipped**:
```
[DUPLEX-TURN-TRACE] warmup_skipped_no_next_question
nextQuestionOrder: 3
```

## Technical Analysis

### Blocking Call Chain

```
processRealtimeVoiceTurn()
  → runTask('interview_next_turn')
    → runInterviewController()
      → executeInterviewAction()
        → agentRegistry.interviewer()  ← BLOCKS HERE
          → callDeepSeek() or callDeepSeekStream()
            → DeepSeek API timeout (30s)
            → Falls back to template
          → Returns question text
        → Returns to voice turn service
      → Updates session state
    → Attempts TTS synthesis
  → Returns to duplex coordinator
```

### Why Question Didn't Appear Until Pause

1. **Backend completed** at 11:20:23 (34s after speech end)
2. **Frontend had already timed out** or was in wrong state after 34s wait
3. **Pause button click** triggered state refresh/re-fetch
4. **State refresh** found the completed question and displayed it

### Product Behavior Violation

From `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` line 140-144:

> The product latency target is:
> ```
> user speech end -> next question first audio <= 3 seconds
> ```

**Actual**: 34.2 seconds  
**Target**: ≤3 seconds  
**Violation**: 11.4x over target

## Affected Components

### Backend Services
- [`backend/src/services/agents/interviewerAgent.js`](../backend/src/services/agents/interviewerAgent.js) - Question naturalization with LLM
- [`backend/src/services/aiControl/interviewActionExecutor.js`](../backend/src/services/aiControl/interviewActionExecutor.js) - Action execution orchestration
- [`backend/src/services/deepseekService.js`](../backend/src/services/deepseekService.js) - LLM API client (no aggressive timeout)
- [`backend/src/services/voice/realtimeVoiceTurnService.js`](../backend/src/services/voice/realtimeVoiceTurnService.js) - Voice turn orchestration
- [`backend/src/services/voice/duplexTurnCoordinator.js`](../backend/src/services/voice/duplexTurnCoordinator.js) - Duplex coordination

### Frontend Components
- Frontend voice session hook (state management)
- WebSocket message handling
- UI state refresh on pause

## Potential Solutions

### Option 1: Aggressive Timeout + Template Fallback (Immediate Fix)
**Effort**: Low  
**Impact**: High  
**Risk**: Low

- Add 2-second max timeout to LLM naturalization in voice mode
- Fall back to deterministic template immediately on timeout
- Don't retry DeepSeek on 503 errors during voice turns

**Pros**:
- Quick to implement
- Guarantees latency target
- Maintains product quality with templates

**Cons**:
- Less natural question phrasing when LLM fails
- Doesn't address underlying API reliability

### Option 2: Template-First Architecture (Medium Fix)
**Effort**: Medium  
**Impact**: High  
**Risk**: Low

- Generate question from template immediately
- Stream template to frontend (meets 3s target)
- Optionally enhance with LLM in background (non-blocking)
- Use enhanced version for transcript/report only

**Pros**:
- Always meets latency target
- Still gets LLM enhancement when available
- Graceful degradation

**Cons**:
- More complex state management
- User might hear template, transcript shows enhanced

### Option 3: Circuit Breaker Pattern (Reliability Fix)
**Effort**: Medium  
**Impact**: Medium  
**Risk**: Low

- Track DeepSeek failures per session
- After 2+ consecutive failures, skip LLM naturalization
- Use templates only for remainder of session
- Reset circuit on successful call

**Pros**:
- Prevents cascading failures
- Self-healing behavior
- Maintains quality when API is healthy

**Cons**:
- Requires session-level state tracking
- May skip LLM unnecessarily after transient errors

### Option 4: Streaming Question Generation (Advanced Fix)
**Effort**: High  
**Impact**: High  
**Risk**: Medium

- Start with deterministic template sentence
- Stream first sentence immediately (<1s)
- Let LLM enhance remaining sentences if time permits
- Cancel LLM if it exceeds budget

**Pros**:
- Best user experience
- Optimal latency
- Graceful degradation

**Cons**:
- Complex implementation
- Requires streaming infrastructure changes
- Risk of inconsistent question quality

## Recommended Approach

**Phase 1 (Immediate)**: Implement Option 1 (Aggressive Timeout)
- Add 2s timeout to `callDeepSeek()` in voice mode
- Add `skipLLMNaturalization` flag for voice turns
- Fall back to template on timeout or 503 error

**Phase 2 (Short-term)**: Add Option 3 (Circuit Breaker)
- Track API health per session
- Skip LLM after repeated failures
- Log circuit breaker state for monitoring

**Phase 3 (Long-term)**: Consider Option 2 or 4
- Evaluate template-first vs streaming based on:
  - User feedback on question quality
  - API reliability improvements
  - Engineering capacity

## Testing Requirements

Before implementing any fix:

1. **Reproduce the issue**:
   - Simulate DeepSeek API timeout
   - Verify 30s+ latency
   - Confirm pause-to-show behavior

2. **Test timeout fix**:
   - Mock DeepSeek timeout
   - Verify <3s fallback to template
   - Confirm question quality acceptable

3. **Test circuit breaker**:
   - Simulate repeated API failures
   - Verify circuit opens after threshold
   - Verify circuit closes on success

4. **Load test**:
   - Run multiple concurrent voice sessions
   - Verify latency under load
   - Monitor API error rates

## Monitoring Recommendations

Add metrics for:
- `voice_turn_latency_p50`, `p95`, `p99`
- `deepseek_api_timeout_rate`
- `question_naturalization_fallback_rate`
- `circuit_breaker_open_count`
- `template_vs_llm_question_ratio`

## Related Documents

- [`VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`](../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md) - Product behavior specification
- [`docs/voice-latency-optimization-plan.md`](voice-latency-optimization-plan.md) - Latency optimization plan
- [`docs/voice-latency-optimization-architecture.md`](voice-latency-optimization-architecture.md) - Architecture design

## Status

**Status**: Documented, awaiting decision on implementation approach  
**Priority**: High (11x latency violation)  
**Assigned**: TBD  
**Target**: TBD