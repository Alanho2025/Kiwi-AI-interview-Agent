# Voice Latency Optimization Architecture

> Status: historical target architecture. Parts are implemented, but this file is not a current component inventory. Use `docs/implementation-workflows.md`, `docs/voice-latency-trace-markers.md`, and runtime code for present behavior.

## Current Architecture (Synchronous Pipeline)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant WebSocket
    participant Controller
    participant Services
    participant DeepSeek
    participant TTS

    User->>Frontend: Finishes speaking
    Frontend->>WebSocket: speech_end
    WebSocket->>Controller: Process turn
    
    Note over Controller,Services: ~1.3s: Context Preparation
    Controller->>Services: ensureArtifactsIndexed()
    Controller->>Services: retrieval()
    Controller->>Services: buildEnvironment()
    Controller->>Services: buildEvidenceBundle()
    
    Note over Controller,DeepSeek: ~2.9s: Answer Understanding
    Controller->>DeepSeek: resolveFastAnswerUnderstanding()
    DeepSeek-->>Controller: Understanding result
    
    Note over Controller,DeepSeek: ~1.9s: Action Selection
    Controller->>DeepSeek: selectActionWithModel()
    DeepSeek-->>Controller: Action plan
    
    Note over Controller,Services: ~6.2s: Execution
    Controller->>Services: executeAction()
    Services->>DeepSeek: Generate question
    DeepSeek-->>Services: Question text
    Services->>TTS: Convert to speech
    TTS-->>Services: Audio chunks
    
    Services-->>WebSocket: First audio chunk
    WebSocket-->>Frontend: Audio stream
    Frontend-->>User: Hears question (~12.3s total)
```

**Total Latency**: ~12.3 seconds
- Context preparation: 1.3s
- Answer understanding: 2.9s
- Action selection: 1.9s
- Execution (DB + LLM + TTS): 6.2s

---

## Optimized Architecture (Warm Context + Fast Path)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant WebSocket
    participant Coordinator
    participant WarmCache
    participant Controller
    participant FastPath
    participant Background
    participant DeepSeek
    participant TTS

    Note over User,Coordinator: Previous Turn Ends
    User->>Frontend: Hears previous question
    Frontend->>WebSocket: assistant_speech_done
    WebSocket->>Coordinator: Turn complete
    
    Note over Coordinator,WarmCache: Warmup Phase (Async)
    Coordinator->>WarmCache: prepareWarmContext()
    WarmCache->>WarmCache: ensureArtifactsIndexed()
    WarmCache->>WarmCache: retrieval()
    WarmCache->>WarmCache: buildEnvironment()
    WarmCache->>WarmCache: buildEvidenceBundle()
    WarmCache->>WarmCache: Cache ready (1.3s)
    
    Note over User,Frontend: Current Turn Starts
    User->>Frontend: Speaks answer
    User->>Frontend: Finishes speaking
    Frontend->>WebSocket: speech_end + turnId
    WebSocket->>Controller: Process turn
    
    Note over Controller,WarmCache: ~0s: Use Warm Context
    Controller->>WarmCache: getWarmContext(turnId)
    WarmCache-->>Controller: Cached context (validated)
    
    Note over Controller,FastPath: ~0.1s: Fast Understanding
    Controller->>FastPath: extractFastAnswerUnderstanding()
    FastPath-->>Controller: Local JS analysis
    
    Note over Controller,FastPath: ~0s: Rule Selection
    Controller->>FastPath: getFallbackPlan()
    FastPath-->>Controller: Rule-based action
    
    Note over Controller,TTS: ~6s: Fast Execution
    Controller->>DeepSeek: Generate question (fast)
    DeepSeek-->>Controller: Question text
    Controller->>TTS: Convert to speech
    TTS-->>WebSocket: First audio chunk
    WebSocket-->>Frontend: Audio stream
    Frontend-->>User: Hears question (~6-8s total)
    
    Note over Background,DeepSeek: Background Quality Path
    Controller->>Background: scheduleBackgroundQuality()
    Background->>DeepSeek: Semantic understanding
    Background->>DeepSeek: Model action selection
    Background->>Background: Update memory
    Background->>Background: Update trace
    Background->>Background: Update evaluators
    Background->>Background: Update report evidence
```

**Total Latency**: ~6-8 seconds (4-6s saved)
- Context preparation: 0s (pre-warmed)
- Answer understanding: 0.1s (local JS)
- Action selection: 0s (rule-based)
- Execution (DB + LLM + TTS): 6-8s

**Background Quality**: Completes within 10s for next turn

---

## Warm Context Cache Architecture

```mermaid
graph TB
    subgraph "Cache Structure"
        Cache[Warm Context Cache]
        Cache --> SessionId[sessionId]
        Cache --> QuestionId[questionId]
        Cache --> TurnId[clientTurnId]
        Cache --> Index[currentQuestionIndex]
        Cache --> Retrieval[retrievalBundle]
        Cache --> Environment[baseEnvironment]
        Cache --> Evidence[evidenceBundle]
        Cache --> Created[createdAt]
        Cache --> Expires[expiresAt]
    end
    
    subgraph "Cache Lifecycle"
        Trigger[Assistant Speech Done]
        Trigger --> Prepare[prepareWarmContext]
        Prepare --> Store[Store in Cache]
        Store --> TTL[TTL: 60-90s]
        
        UserSpeech[User Speech End]
        UserSpeech --> Get[getWarmContext]
        Get --> Validate{Validate Cache}
        Validate -->|Valid| Use[Use Cached Context]
        Validate -->|Invalid| Fallback[Use Original Flow]
        
        SessionEnd[Session End/Pause]
        SessionEnd --> Clear[clearWarmContext]
    end
    
    subgraph "Validation Rules"
        Validate --> CheckSession{sessionId matches?}
        CheckSession -->|No| Invalid1[Invalid]
        CheckSession -->|Yes| CheckQuestion{questionId matches?}
        CheckQuestion -->|No| Invalid2[Invalid]
        CheckQuestion -->|Yes| CheckTurn{turnId matches?}
        CheckTurn -->|No| Invalid3[Invalid]
        CheckTurn -->|Yes| CheckIndex{index matches?}
        CheckIndex -->|No| Invalid4[Invalid]
        CheckIndex -->|Yes| CheckExpiry{not expired?}
        CheckExpiry -->|No| Invalid5[Invalid]
        CheckExpiry -->|Yes| CheckStatus{session active?}
        CheckStatus -->|No| Invalid6[Invalid]
        CheckStatus -->|Yes| Valid[Valid]
    end
```

---

## Turn Identity Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant WebSocket
    participant Coordinator
    participant Cache
    participant Controller

    Note over Frontend: Generate Turn ID
    Frontend->>Frontend: turnId = 'voice-turn-3'
    
    Frontend->>WebSocket: speech_start { turnId }
    WebSocket->>Coordinator: Register turn
    Coordinator->>Coordinator: Store turnId in state
    
    Note over Coordinator,Cache: Warmup with Turn ID
    Coordinator->>Cache: prepareWarmContext({ turnId })
    Cache->>Cache: Cache binds to turnId
    
    Frontend->>WebSocket: speech_end { turnId }
    WebSocket->>Controller: Process turn { turnId }
    
    Note over Controller,Cache: Validate Turn ID
    Controller->>Cache: getWarmContext({ turnId })
    Cache->>Cache: Validate turnId matches
    
    alt Turn ID Matches
        Cache-->>Controller: Return cached context
        Controller->>Controller: Use warm context
    else Turn ID Mismatch
        Cache-->>Controller: Return null
        Controller->>Controller: Use original flow
    end
```

---

## Fast Path vs Quality Path

```mermaid
graph TB
    subgraph "User-Facing Fast Path"
        Start[User Speech End]
        Start --> GetCache[Get Warm Context]
        GetCache --> FastUnderstand[Local Fast Understanding<br/>~0.1s]
        FastUnderstand --> RuleSelect[Rule-Based Action<br/>~0s]
        RuleSelect --> Execute[Execute Action<br/>~6s]
        Execute --> Response[Send Audio to User<br/>Total: 6-8s]
    end
    
    subgraph "Background Quality Path"
        Schedule[Schedule Background Job]
        Schedule --> Semantic[Semantic Understanding<br/>DeepSeek ~3s]
        Semantic --> ModelSelect[Model Action Selection<br/>DeepSeek ~2s]
        ModelSelect --> Memory[Update Memory<br/>~0.5s]
        Memory --> Trace[Update Trace<br/>~0.5s]
        Trace --> Evaluator[Run Evaluators<br/>~2s]
        Evaluator --> Report[Update Report Evidence<br/>~1s]
        Report --> Complete[Background Complete<br/>Total: ~10s]
    end
    
    Execute --> Schedule
    
    Complete --> NextTurn[Available for Next Turn]
```

---

## Cache Validation Decision Tree

```mermaid
graph TD
    Start[getWarmContext Request]
    Start --> HasCache{Cache Exists?}
    
    HasCache -->|No| NoCache[Return null<br/>Use Original Flow]
    HasCache -->|Yes| CheckSession{sessionId<br/>Matches?}
    
    CheckSession -->|No| InvalidSession[Invalid: Session Mismatch<br/>Return null]
    CheckSession -->|Yes| CheckQuestion{questionId<br/>Matches?}
    
    CheckQuestion -->|No| InvalidQuestion[Invalid: Question Changed<br/>Return null]
    CheckQuestion -->|Yes| CheckTurn{clientTurnId<br/>Matches?}
    
    CheckTurn -->|No| InvalidTurn[Invalid: Turn Mismatch<br/>Return null]
    CheckTurn -->|Yes| CheckIndex{currentQuestionIndex<br/>Matches?}
    
    CheckIndex -->|No| InvalidIndex[Invalid: Index Changed<br/>Return null]
    CheckIndex -->|Yes| CheckAge{Cache Age<br/>< 90s?}
    
    CheckAge -->|No| Expired[Invalid: Cache Expired<br/>Return null]
    CheckAge -->|Yes| CheckStatus{Session<br/>Active?}
    
    CheckStatus -->|No| InvalidStatus[Invalid: Session Ended/Paused<br/>Return null]
    CheckStatus -->|Yes| Valid[Valid Cache<br/>Return Context]
    
    Valid --> UseCache[Use Warm Context<br/>Save 4-6s]
    
    NoCache --> Fallback[Original Flow]
    InvalidSession --> Fallback
    InvalidQuestion --> Fallback
    InvalidTurn --> Fallback
    InvalidIndex --> Fallback
    Expired --> Fallback
    InvalidStatus --> Fallback
```

---

## Error Handling & Fallback Strategy

```mermaid
graph TB
    subgraph "Warmup Phase"
        Trigger[Trigger Warmup]
        Trigger --> TryWarmup{Try Warmup}
        TryWarmup -->|Success| CacheReady[Cache Ready]
        TryWarmup -->|Error| LogError[Log Error]
        LogError --> NoCache[No Cache Available]
    end
    
    subgraph "Usage Phase"
        Request[Request Warm Context]
        Request --> GetCache{Get Cache}
        GetCache -->|Found| Validate{Validate}
        GetCache -->|Not Found| UseFallback1[Use Original Flow]
        
        Validate -->|Valid| UseCache[Use Warm Context]
        Validate -->|Invalid| LogInvalid[Log Invalidation]
        LogInvalid --> UseFallback2[Use Original Flow]
    end
    
    subgraph "Background Phase"
        Schedule[Schedule Background]
        Schedule --> TryBackground{Try Background}
        TryBackground -->|Success| QualityComplete[Quality Complete]
        TryBackground -->|Error| LogBgError[Log Error]
        LogBgError --> Retry{Retry?}
        Retry -->|Yes| TryBackground
        Retry -->|No| BgFailed[Background Failed<br/>Continue Anyway]
    end
    
    CacheReady --> GetCache
    NoCache --> UseFallback1
    
    UseCache --> Schedule
    UseFallback1 --> Schedule
    UseFallback2 --> Schedule
    
    QualityComplete --> NextTurn[Ready for Next Turn]
    BgFailed --> NextTurn
```

---

## Monitoring & Observability

```mermaid
graph TB
    subgraph "Latency Metrics"
        L1[voice_turn_total_latency]
        L2[voice_turn_warmup_latency]
        L3[voice_turn_cache_validation_latency]
        L4[voice_turn_fast_understanding_latency]
        L5[voice_turn_rule_selection_latency]
        L6[voice_turn_background_quality_latency]
        L7[voice_turn_first_audio_sent]
    end
    
    subgraph "Quality Metrics"
        Q1[voice_turn_cache_hit_rate]
        Q2[voice_turn_cache_invalidation_rate]
        Q3[voice_turn_fallback_rate]
        Q4[voice_turn_background_failure_rate]
        Q5[voice_turn_background_lag]
        Q6[voice_turn_quality_score]
    end
    
    subgraph "Error Metrics"
        E1[voice_turn_warmup_error]
        E2[voice_turn_cache_error]
        E3[voice_turn_validation_error]
        E4[voice_turn_background_error]
    end
    
    subgraph "Alerts"
        A1[Cache validation failure > 10%]
        A2[Background failure > 5%]
        A3[Latency regression > 20%]
        A4[Error rate increase > 5%]
    end
    
    Q2 --> A1
    Q4 --> A2
    L1 --> A3
    E1 --> A4
    E2 --> A4
    E3 --> A4
    E4 --> A4
```

---

## Deployment Strategy

```mermaid
graph LR
    subgraph "Week 1"
        W1[Deploy with 10% Rollout]
        W1 --> M1[Monitor Closely]
        M1 --> D1{Metrics Good?}
        D1 -->|No| R1[Rollback]
        D1 -->|Yes| W2
    end
    
    subgraph "Week 2"
        W2[Increase to 25%]
        W2 --> M2[Monitor]
        M2 --> D2{Metrics Good?}
        D2 -->|No| R2[Rollback to 10%]
        D2 -->|Yes| W3
    end
    
    subgraph "Week 3"
        W3[Increase to 50%]
        W3 --> M3[Monitor]
        M3 --> D3{Metrics Good?}
        D3 -->|No| R3[Rollback to 25%]
        D3 -->|Yes| W4
    end
    
    subgraph "Week 4"
        W4[Increase to 100%]
        W4 --> M4[Monitor]
        M4 --> D4{Metrics Good?}
        D4 -->|No| R4[Rollback to 50%]
        D4 -->|Yes| Success[Full Deployment]
    end
```

---

## Feature Flag Architecture

```mermaid
graph TB
    subgraph "Feature Flags"
        F1[VOICE_WARM_CONTEXT_ENABLED]
        F2[VOICE_FAST_PATH_ENABLED]
        F3[VOICE_BACKGROUND_QUALITY_ENABLED]
        F4[WARM_CONTEXT_ROLLOUT_PERCENTAGE]
    end
    
    subgraph "Runtime Decision"
        Request[Voice Turn Request]
        Request --> CheckEnabled{Warm Context<br/>Enabled?}
        CheckEnabled -->|No| Original[Use Original Flow]
        CheckEnabled -->|Yes| CheckRollout{Session in<br/>Rollout %?}
        CheckRollout -->|No| Original
        CheckRollout -->|Yes| CheckFastPath{Fast Path<br/>Enabled?}
        CheckFastPath -->|No| WarmOnly[Warm Context Only]
        CheckFastPath -->|Yes| CheckBg{Background<br/>Enabled?}
        CheckBg -->|No| FastOnly[Fast Path Only]
        CheckBg -->|Yes| FullOptimization[Full Optimization]
    end
    
    subgraph "Rollback Options"
        R1[Disable All<br/>Set all flags to false]
        R2[Disable Fast Path<br/>Keep warm context]
        R3[Reduce Rollout<br/>Lower percentage]
    end
    
    F1 --> CheckEnabled
    F4 --> CheckRollout
    F2 --> CheckFastPath
    F3 --> CheckBg
```

---

## Data Flow Comparison

### Before Optimization
```
User Speech End
    ↓
[1.3s] Context Preparation (blocking)
    ↓
[2.9s] Semantic Understanding (blocking)
    ↓
[1.9s] Model Action Selection (blocking)
    ↓
[6.2s] Question Generation + TTS (blocking)
    ↓
User Hears Response (12.3s total)
```

### After Optimization
```
Previous Turn Ends
    ↓
[1.3s] Context Preparation (async warmup)
    ↓
User Speech End
    ↓
[0s] Use Warm Context (cached)
    ↓
[0.1s] Fast Understanding (local JS)
    ↓
[0s] Rule Selection (local)
    ↓
[6s] Question Generation + TTS (blocking)
    ↓
User Hears Response (6-8s total)
    ↓
[10s] Background Quality Path (async)
```

**Savings**: 4-6 seconds per turn

---

## Risk Mitigation Summary

| Risk | Impact | Mitigation | Fallback |
|------|--------|------------|----------|
| Stale Cache | Wrong context used | Validate before use | Discard, use original flow |
| Partial Transcript | Premature decisions | Only use for local analysis | Wait for final transcript |
| Turn Mismatch | Cache used by wrong turn | Bind cache to turnId | Validation fails, use original |
| Warmup Waste | Resource waste | Only warmup after assistant done | Low cost, acceptable |
| Rate Limits | DeepSeek throttling | No DeepSeek in warmup/partial | Background only |
| Quality Loss | Poor follow-ups | Background quality path | Maintain full quality async |
| Session Changes | Cache invalidated | Check session status | Validation fails, use original |
| Background Failure | Missing quality data | Retry with backoff | Continue, log error |

---

## Success Criteria

### Latency
- ✅ Total latency reduced from 12.3s to 6-8s
- ✅ Cache hit rate > 80%
- ✅ Cache validation overhead < 50ms
- ✅ Background quality completes within 10s

### Quality
- ✅ Report quality maintained (no degradation)
- ✅ Memory updates complete successfully
- ✅ Trace records complete
- ✅ Follow-up questions remain relevant

### Reliability
- ✅ Cache invalidation rate < 10%
- ✅ Fallback rate < 20%
- ✅ Background failure rate < 5%
- ✅ No increase in error rates

### User Experience
- ✅ User satisfaction maintained or improved
- ✅ No complaints about question quality
- ✅ Perceived responsiveness improved
