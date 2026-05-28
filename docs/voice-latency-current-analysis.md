# Voice Interview Latency Analysis - Current State

**Date**: 2026-05-28  
**Measured Latency**: 7148ms (user speech end → AI speech start)  
**Target Latency**: 3000ms (per VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md)  
**Gap**: +4148ms (138% over target)

## Latency Breakdown

### Backend Processing: 7626ms total

| Step | Duration | % of Total | Status |
|------|----------|------------|--------|
| Load latest question | 267ms | 3.5% | ✓ Acceptable |
| Save realtime user turn | 282ms | 3.7% | ✓ Acceptable |
| **Adaptive next question** | **6014ms** | **78.9%** | ⚠️ **CRITICAL BOTTLENECK** |
| Update session state | 1059ms | 13.9% | ⚠️ Optimization needed |

### Adaptive Next Question Pipeline: 6014ms

| Sub-step | Duration | % of Pipeline | Status |
|----------|----------|---------------|--------|
| Indexing check | 40ms | 0.7% | ✓ Fast |
| Retrieval | 309ms | 5.1% | ✓ Acceptable |
| Environment build | 0ms | 0% | ✓ Fast |
| Turn evaluation | 2ms | 0% | ✓ Fast |
| Evidence bundle | 3ms | 0% | ✓ Fast |
| **Decision context** | **1734ms** | **28.8%** | ⚠️ **Major bottleneck** |
| Action selection | 0ms | 0% | ✓ Fast |
| **Action execution** | **3348ms** | **55.7%** | ⚠️ **Major bottleneck** |
| └─ LLM first sentence | 1722ms | 28.6% | ⚠️ LLM latency |
| └─ TTS first audio | 1625ms | 27.0% | ⚠️ TTS latency |

### Frontend Metrics

- Frontend speech end sent: `1779968830566`
- Frontend first TTS audio received: `1779968837714` 
- **Frontend measured latency**: 7148ms
- Backend reports first audio sent: 6320ms from request received
- Network + streaming overhead: ~828ms

## Root Causes

### 1. Decision Context Building (1734ms)
**Location**: [`backend/src/services/aiControl/decisionContextBuilder.js`](backend/src/services/aiControl/decisionContextBuilder.js)

**Issue**: Building comprehensive context for AI decision-making
- Gathering interview history
- Analyzing answer quality
- Building evidence bundles
- Preparing retrieval results

**Impact**: 23% of total latency

### 2. LLM Generation (1722ms)
**Location**: [`backend/src/services/aiControl/interviewActionExecutor.js`](backend/src/services/aiControl/interviewActionExecutor.js)

**Issue**: Waiting for LLM to generate first sentence
- Streaming mode enabled but still slow
- Large context being sent to LLM
- Model inference time

**Impact**: 23% of total latency

### 3. TTS Synthesis (1625ms)
**Location**: [`backend/src/services/voice/azureSpeechService.js`](backend/src/services/voice/azureSpeechService.js)

**Issue**: Azure Speech TTS synthesis time
- Waiting for first audio chunk
- Network latency to Azure
- Synthesis processing time

**Impact**: 21% of total latency

### 4. Session State Update (1059ms)
**Location**: [`backend/src/services/aiControl/sessionStateService.js`](backend/src/services/aiControl/sessionStateService.js)

**Issue**: Persisting state after decision
- Database writes
- State serialization
- Multiple update operations

**Impact**: 14% of total latency

## Optimization Opportunities

### High Impact (Target: -3000ms)

1. **Parallel Processing** (-1500ms estimated)
   - Run decision context building in parallel with TTS warmup
   - Start TTS synthesis before full context is ready
   - Use cached/pre-computed context where possible

2. **Reduce Decision Context Scope** (-500ms estimated)
   - Limit history depth for real-time decisions
   - Use lightweight context for voice mode
   - Cache frequently accessed data

3. **Optimize LLM Prompts** (-500ms estimated)
   - Reduce prompt size for voice mode
   - Use faster model for question naturalization
   - Pre-generate question templates

4. **TTS Optimization** (-300ms estimated)
   - Use lower latency TTS voice
   - Implement TTS warmup/pre-synthesis
   - Consider streaming TTS earlier

5. **Defer Session State Updates** (-200ms estimated)
   - Move to background job queue
   - Only persist critical state synchronously
   - Batch updates

### Medium Impact (Target: -500ms)

6. **Retrieval Optimization** (-150ms)
   - Cache recent retrievals
   - Reduce retrieval depth for voice mode
   - Use approximate search

7. **Database Query Optimization** (-150ms)
   - Add indexes for frequent queries
   - Use projection to reduce data transfer
   - Implement query result caching

8. **Network Optimization** (-200ms)
   - Use regional Azure endpoints
   - Implement connection pooling
   - Optimize WebSocket frame size

## Product Behavior Compliance

Per [`VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`](VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md:18):

> The next question starts speaking within 3 seconds after the user stops speaking.

**Current Status**: ❌ **NOT COMPLIANT** (7.1s vs 3.0s target)

**Priority**: 🔴 **CRITICAL** - User experience severely impacted

## Next Steps

1. ✅ Document current latency breakdown (this file)
2. ⬜ Implement parallel processing architecture
3. ⬜ Optimize decision context building
4. ⬜ Reduce LLM prompt size for voice mode
5. ⬜ Implement TTS warmup/pre-synthesis
6. ⬜ Move session state updates to background
7. ⬜ Add latency monitoring and alerts
8. ⬜ Re-measure and validate improvements

## References

- Product behavior spec: [`VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`](VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md)
- Latency trace markers: [`docs/voice-latency-trace-markers.md`](docs/voice-latency-trace-markers.md)
- Optimization plan: [`docs/voice-latency-optimization-plan.md`](docs/voice-latency-optimization-plan.md)