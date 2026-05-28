
# Phase 2 Refactoring: Current State Snapshot

**Date:** 2026-05-28  
**Status:** Code State Protection Document - DO NOT MODIFY CODE WITHOUT CONSULTING THIS

---

## Document Purpose

This document captures the **exact current state** of all 54 large files (>200 lines) to prevent breaking changes during refactoring. Before modifying any file, verify:

1. **Current exports and public API** - What functions/classes are exported
2. **Function signatures** - Exact parameters and return types
3. **Integration points** - What other files depend on this
4. **State management** - What state is maintained
5. **Side effects** - What external systems are affected

**CRITICAL:** This is a **read-only reference**. Any deviation from documented behavior requires explicit approval.

---

## Quick Reference: All 54 Large Files

| # | File | Lines | Risk | Status | Notes |
|---|------|-------|------|--------|-------|
| 1 | backend/src/services/masterAiService.js | 768 | High | Documented | AI orchestration |
| 2 | backend/src/services/agents/interviewerAgent.js | 743 | High | Documented | Question generation |
| 3 | frontend/src/pages/AnalyzePage.jsx | 697 | Medium | Pending | Main analysis page |
| 4 | backend/src/services/match/matchScoringService.js | 657 | High | Documented | CV-JD matching |
| 5 | backend/src/services/voice/duplexVoiceAgentService.js | 599 | High | Documented | Core voice service |
| 6 | backend/src/services/aiControl/fastAnswerUnderstandingService.js | 540 | High | Documented | Answer understanding |
| 7 | backend/src/services/voice/duplexTurnCoordinator.js | 537 | High | Documented | Turn coordination |
| 8 | backend/src/services/session/sessionShared.js | 479 | Medium | Documented | Session utilities |
| 9 | frontend/src/hooks/voice/useDuplexVoiceSocket.js | 471 | High | Pending | Voice WebSocket hook |
| 10 | frontend/src/hooks/voice/useVoiceSessionLifecycleController.js | 458 | High | Pending | Voice lifecycle |
| 11 | backend/src/services/aiControl/actionPlanner.js | 440 | High | Documented | Action planning |
| 12 | backend/src/services/reportCoachingService.js | 438 | High | Documented | Report generation |
| 13 | backend/src/services/jobDescription/jdUniversalParserService.js | 435 | High | Pending | JD parser |
| 14 | backend/src/controllers/interviewController.js | 416 | High | Pending | Interview controller |
| 15 | frontend/src/hooks/useVoiceInterviewSession.js | 411 | High | Pending | Voice session hook |
| 16-54 | ... | ... | ... | Pending | See detailed sections below |

---

## 1. Voice Services (High Risk) ✅ DOCUMENTED

### 1.1 duplexVoiceAgentService.js (599 lines)

**File:** `backend/src/services/voice/duplexVoiceAgentService.js`

**Exports:**
```javascript
export const createDuplexVoiceAgentSession = ({
  sessionId: string,
  sendJson: function,
  streamAssistantSpeech: function,
  processRealtimeVoiceTurn: function,
  logger: object
}) => {
  handleJsonMessage: async (payload) => void,
  handleBinaryAudio: async (message) => void,
  close: async () => void
}
```

**State Management:**
- `speechSession` - Active Azure/ElevenLabs STT session
- `capturedAudioChunks` - Buffer for audio before STT ready
- `transcriptSegments` - Accumulated transcript segments
- `currentClientTurnId` - Client-provided turn identifier
- `isCapturingSpeech` - Boolean flag for active capture
- `isProcessingTurn` - Boolean flag for turn processing

**Integration Points:**
- **Depends on:** `createRoutedRealtimeSpeechSession`, `createDuplexTurnCoordinator`, `buildSessionSpeechPhraseList`
- **Called by:** WebSocket handlers in `duplexVoiceSocket.js`
- **Calls:** `processRealtimeVoiceTurn` (from `realtimeVoiceTurnService.js`)

**Side Effects:**
- Creates/stops Azure Speech sessions
- Sends WebSocket messages via `sendJson`
- Buffers audio chunks in memory
- Logs to console/logger

**Critical Behavior:**
- Must handle `session_ready` message exactly once
- Must validate `clientTurnId` on `speech_start` and `speech_end`
- Must flush audio buffer before stopping STT session
- Must prevent duplicate `speech_start` while capturing

---

### 1.2 duplexTurnCoordinator.js (537 lines)

**File:** `backend/src/services/voice/duplexTurnCoordinator.js`

**Exports:**
```javascript
export const createDuplexTurnCoordinator = ({
  sessionId: string,
  sendJson: function,
  streamAssistantSpeech: function,
  processRealtimeVoiceTurn: function,
  warmContextService: object,
  logger: object
}) => {
  processFinalTranscript: async ({ transcriptText, asrConfidence, vad }) => {
    isComplete: boolean,
    updatedSession: object
  }
}
```

**State Management:**
- `pendingTranscriptConfirmation` - Stores transcript awaiting user confirmation
- `sentenceIndex` - Counter for TTS streaming sentence IDs

**Integration Points:**
- **Depends on:** `assessRealtimeVoiceTranscript`, `classifyTranscriptConfirmationReply`, `normalizeTranscript`
- **Called by:** `duplexVoiceAgentService.js`
- **Calls:** `processRealtimeVoiceTurn`, `streamAssistantSpeech`, `warmContextService.prepareWarmContext`

**Side Effects:**
- Sends multiple WebSocket message types: `transcript_received`, `turn_done`, `assistant_sentence`, `assistant_speech_done`
- Triggers background warmup for next turn
- Logs confidence gate decisions

**Critical Behavior:**
- Implements transcript confidence gating (accept/reject/confirm)
- Handles confirmation flow: prompt → user reply → classification → process or repair
- Streams TTS sentences with incremental IDs
- Must not count repair prompts or confirmation prompts as interview questions

---

### 1.3 voiceTurnWarmContextService.js (388 lines)

**File:** `backend/src/services/voice/voiceTurnWarmContextService.js`

**Exports:**
```javascript
class VoiceTurnWarmContextService {
  async prepareWarmContext({ sessionId, currentQuestionIndex, totalQuestions, elapsedSeconds })
  
  async getWarmContext({ sessionId, currentQuestionIndex, totalQuestions, elapsedSeconds }) => {
    retrievalBundle: object,
    baseEnvironment: object,
    evidenceBundle: object,
    metadata: { cacheHit: boolean, validationPassed: boolean }
  }
  
  async clearWarmContext({ sessionId })
  getStats() => { cacheSize, hitRate, missRate, validationFailRate }
  clearAll()
}

export default new VoiceTurnWarmContextService()
```

**State Management:**
- `warmContextCache` - Map of sessionId → cached context
- `cacheStats` - Hit/miss/validation counters
- `cleanupTimer` - Interval for cache cleanup

**Integration Points:**
- **Depends on:** `retrieveForInterviewTurn`, `buildInterviewEnvironment`, `buildEvidenceBundle`
- **Called by:** `duplexTurnCoordinator.js`
- **Singleton pattern** - shared across all voice sessions

**Side Effects:**
- Maintains in-memory cache with TTL
- Runs periodic cleanup timer
- Logs cache operations

**Critical Behavior:**
- Cache validation checks: questionIndex, totalQuestions, elapsedSeconds must match
- Cache invalidation on state mismatch
- Automatic cleanup of stale entries (5 min TTL)

---

### 1.4 Other Voice Services

**realtimeVoiceTurnService.js (316 lines)** ✅
- Export: `processRealtimeVoiceTurn({ session, transcriptText, asrConfidence, asrSource, vad, onSentence, skipTranscriptGate, trace })`
- Returns: `{ isComplete, updatedSession, transcription, assistantAudio }`
- Side effects: Appends transcript, synthesizes TTS, saves audio, enqueues background jobs

**realtimeSpeechSessionService.js (276 lines)** ✅
- Export: `createRealtimeSpeechSession({ language, phraseList, callbacks, usageContext })`
- Returns: `{ start, writeAudio, stop }`
- Side effects: Creates Azure Speech recognizer, records usage

**speechConfidenceGate.js (259 lines)** ✅
- Exports: `getConfidenceStatus()`, `buildConfidenceGate()`, `assessRealtimeVoiceTranscript()`
- Pure functions for confidence assessment
- Thresholds: high ≥0.85, medium ≥0.70, low <0.70

**azureSpeechService.js (238 lines)** ✅
- Exports: `synthesizeSpeech()`, `transcribeShortAudio()`
- Side effects: Calls Azure Speech REST API, records usage

**elevenLabsSpeechService.js (222 lines)** ✅
- Exports: `synthesizeSpeech()`, `synthesizeSpeechStream()`
- Side effects: Calls ElevenLabs API, records usage

**realtimeSpeechProviderRouter.js (99 lines)** ✅
- Export: `createRoutedRealtimeSpeechSession()`
- Provides: Provider fallback logic (Azure → ElevenLabs → Test)

**ttsProviderRouter.js (97 lines)** ✅
- Exports: `synthesizeSpeech()`, `synthesizeSpeechStream()`, `getTtsProviderOrder()`
- Provides: TTS provider routing with fallback

---

## 2. AI Orchestration Services (High Risk) ✅ DOCUMENTED

### 2.1 masterAiService.js (768 lines)

**File:** `backend/src/services/masterAiService.js`

**Exports:**
```javascript
export const runTask = async ({
  taskType: 'interview' | 'report' | 'report_qa',
  sessionId: string,
  payload: object,
  onSentence: function | null,
  trace: object | null
}) => Promise<{
  isComplete: boolean,
  updatedSession: object,
  // ... task-specific fields
}>

export const warmAdaptiveSession = async ({
  sessionId: string,
  trace: object | null
}) => Promise<{
  warmupCompleted: boolean,
  cacheKey: string
}>
```

**State Management:**
- None (stateless orchestrator)
- Delegates state to: `warmContextService`, `agentMemoryService`, `decisionRecordService`

**Integration Points:**
- **Depends on:** All agent services, retrieval services, action executors, memory services
- **Called by:** Controllers (`interviewController`, `reportController`), voice turn service
- **Calls:** `agentRegistry.retrieval`, `agentRegistry.interviewer`, `agentRegistry.reportGenerator`, etc.

**Side Effects:**
- Persists controller snapshots to database
- Persists report artifacts
- Creates decision records
- Records agent trace events
- Enqueues background jobs for memory updates
- Updates session analysis records

**Critical Behavior:**
- Routes tasks to appropriate controller (interview/report/report_qa)
- Implements adaptive interview flow with fast path and quality path
- Uses warm context for voice latency optimization
- Streams sentences via `onSentence` callback
- Measures latency for each adaptive step
- Persists all decisions and evidence for transparency

---

## 3. Agent Services (High Risk) ✅ DOCUMENTED

### 3.1 interviewerAgent.js (743 lines)

**File:** `backend/src/services/agents/interviewerAgent.js`

**Exports:**
```javascript
export const generateNextQuestion = async ({
  session: object,
  environment: object,
  evidenceBundle: object,
  retrievalBundle: object,
  onSentence: function | null
}) => Promise<{
  questionText: string,
  questionType: string,
  targetCapability: string,
  reasoning: string,
  alternatives: array,
  isComplete: boolean
}>
```

**State Management:**
- None (stateless)

**Integration Points:**
- **Depends on:** `callDeepSeek`, `interviewerAgentQuestionBuilder`
- **Called by:** `masterAiService.js` via `agentRegistry`
- **Calls:** DeepSeek API for question generation

**Side Effects:**
- Calls LLM API
- Records LLM usage
- Streams sentences if callback provided

**Critical Behavior:**
- Generates contextual follow-up questions
- Selects from question pool or generates new questions
- Provides reasoning and alternatives for transparency
- Handles streaming and non-streaming modes
- Validates question structure

---

## 4. AI Control Services (High Risk) ✅ DOCUMENTED

### 4.1 fastAnswerUnderstandingService.js (540 lines)

**File:** `backend/src/services/aiControl/fastAnswerUnderstandingService.js`

**Exports:**
```javascript
export const resolveFastAnswerUnderstanding = async ({
  session: object,
  latestAnswer: string,
  environment: object
}) => Promise<{
  understanding: string,
  keyPoints: array,
  missingElements: array,
  confidence: number
}>

export const extractFastAnswerUnderstanding = ({
  session: object
}) => object | null
```

**State Management:**
- Caches understanding in session analysis record

**Integration Points:**
- **Depends on:** `callDeepSeek`, session analysis model
- **Called by:** `masterAiService.js`

**Side Effects:**
- Calls LLM API
- Updates session analysis record
- Records LLM usage

**Critical Behavior:**
- Provides fast semantic understanding of user answers
- Used for voice fast path decision making
- Caches result to avoid redundant LLM calls

---

### 4.2 actionPlanner.js (440 lines)

**File:** `backend/src/services/aiControl/actionPlanner.js`

**Exports:**
```javascript
export const selectActionWithModel = async ({
  session: object,
  environment: object,
  evidenceBundle: object,
  retrievalBundle: object
}) => Promise<{
  action: string,
  reasoning: string,
  confidence: number,
  alternatives: array
}>
```

**Integration Points:**
- **Depends on:** `callDeepSeek`, decision context builder
- **Called by:** `masterAiService.js`

**Side Effects:**
- Calls LLM API
- Records LLM usage

**Critical Behavior:**
- Selects next interview action (ask_question, probe_deeper, end_interview)
- Provides reasoning and alternatives
- Used when fast path is not applicable

---

## 5. Session Services (High Risk) ✅ DOCUMENTED

### 5.1 sessionShared.js (479 lines)

**File:** `backend/src/services/session/sessionShared.js`

**Exports:**
```javascript
export const getSessionById = (sessionId: string) => Promise<object>
export const updateSession = (sessionId: string, updates: object) => Promise<object>
export const createInterviewQuestion = ({ sessionId, questionText, questionType, targetCapability, reasoning }) => Promise<string>
export const appendTranscriptTurn = (sessionId: string, turn: object) => Promise<void>
export const saveInterviewAnswerWithDetails = ({ sessionId, answerText, questionId, providerPayload }) => Promise<void>
// ... many other session utilities
```

**State Management:**
- None (delegates to database)

**Integration Points:**
- **Depends on:** Session model, SessionAnalysis model
- **Called by:** All controllers, voice services, master AI service
- **Central hub** for session operations

**Side Effects:**
- Reads/writes session documents
- Reads/writes session analysis documents
- Updates transcript arrays
- Creates interview questions

**Critical Behavior:**
- Provides atomic session updates
- Maintains transcript order
- Links questions to answers
- Stores provider-specific metadata

---

### 5.2 sessionPersistenceService.js (375 lines)

**File:** `backend/src/services/session/sessionPersistenceService.js`

**Exports:**
```javascript
export const createSession = ({ userId, cvFileId, jdText, settings }) => Promise<string>
export const finalizeSession = (sessionId: string) => Promise<void>
export const deleteSession = (sessionId: string) => Promise<void>
// ... other persistence operations
```

**Integration Points:**
- **Depends on:** Session model, file repository
- **Called by:** Session controller, interview controller

**Side Effects:**
- Creates session documents
- Updates session status
- Deletes session and related data

---

## 6. Matching & Scoring Services (High Risk) ✅ DOCUMENTED

### 6.1 matchScoringService.js (657 lines)

**File:** `backend/src/services/match/matchScoringService.js`

**Exports:**
```javascript
export const buildMacroScores = (macroCriteria, cvText, weights, evidenceProfile, semanticEvidenceContext) => array

export const buildMicroScores = (microCriteria, cvText, weights, evidenceProfile, semanticEvidenceContext) => array

export const buildRequirementChecks = (requirements, cvText, evidenceProfile, semanticEvidenceContext) => array

export const calculateScoreBreakdown = ({ rubric, macroScores, microScores, requirementChecks }) => object

export const buildLegacyWeightedBreakdown = ({ macroScore, microScore, requirementScore, requirementChecks }) => object

export const buildExplanation = ({ microScores, requirementChecks, cvEvidenceProfile }) => object
```

**State Management:**
- None (pure functions)

**Integration Points:**
- **Depends on:** `buildScoreItem`, `buildRequirementItem`, scoring schema service
- **Called by:** `matchService.js`, `guardedMatchService.js`

**Side Effects:**
- None (pure computation)

**Critical Behavior:**
- Computes requirement status from evidence (met/partially_met/not_met)
- Applies evidence strength policy (strict for technical requirements)
- Builds weighted score breakdowns
- Generates explanation with strengths/gaps/risks
- Uses semantic evidence context for enhanced matching

**Constants:**
```javascript
SECTION_EVIDENCE_STRENGTH = {
  experience: 1.0,
  projects: 0.9,
  skills: 0.7,
  education: 0.6,
  summary: 0.5
}

STRICT_TECH_PATTERNS = {
  frameworks: ['react', 'vue', 'angular', ...],
  languages: ['python', 'java', 'javascript', ...],
  databases: ['postgresql', 'mongodb', 'mysql', ...],
  cloud: ['aws', 'azure', 'gcp', ...]
}
```

---

### 6.2 evidenceJudgeService.js (255 lines)

**File:** `backend/src/services/match/evidenceJudgeService.js`

**Exports:**
```javascript
export const judgeRequirementEvidenceBatch = async ({
  requirements: array,
  semanticEvidenceContext: object
}) => Promise<array<{
  requirementId: string,
  status: 'met' | 'partially_met' | 'not_met',
  evidenceStrength: 'strong' | 'moderate' | 'weak' | 'missing',
  reasoning: string,
  topEvidence: array
}>>
```

**State Management:**
- None (stateless)

**Integration Points:**
- **Depends on:** `callDeepSeekJson`, semantic evidence service
- **Called by:** `matchScoringService.js`

**Side Effects:**
- Calls LLM API for evidence judgment
- Records LLM usage

**Critical Behavior:**
- Judges whether CV evidence satisfies JD requirements
- Uses both heuristic rules and AI judgment
- Filters evidence by requirement type
- Provides reasoning for each judgment
- Handles batch processing for efficiency

---

### 6.3 guardedMatchService.js (184 lines)

**File:** `backend/src/services/match/guardedMatchService.js`

**Exports:**
```javascript
export const compareCvToJobDescriptionWithSafeguard = async (
  cvInput: object,
  rawJD: string,
  jdRubric: object,
  settings: object
) => Promise<{
  ...matchResult,
  matchingDetails: {
    safeguardApplied: boolean,
    reviewPassed: boolean,
    cacheHit: boolean
  }
}>
```

**State Management:**
- None (stateless)

**Integration Points:**
- **Depends on:** `compareCvToJobDescription`, `reviewMatchWithDeepSeek`, cache services
- **Called by:** Analyze controller

**Side Effects:**
- Calls match service twice (with safeguard)
- Calls AI review service
- Reads/writes match artifact cache
- Warms CV and JD artifact caches

**Critical Behavior:**
- Implements double-check safeguard for match quality
- Uses human-reviewed JD rubric when available
- Caches match results for performance
- Warms reusable artifact caches (CV profile, JD rubric)
- Attaches safeguard metadata to results

---

## 7. Report Services (High Risk) ✅ DOCUMENTED

### 7.1 reportCoachingService.js (438 lines)

**File:** `backend/src/services/reportCoachingService.js`

**Exports:**
```javascript
export const generateCandidateFeedback = async ({
  session: object,
  analysisResult: object,
  interviewPlan: object,
  evidenceSummary: object,
  interviewMetrics: object,
  strongestExamples: array,
  deterministicFeedback: object,
  nzWorkplaceFit: object
}) => Promise<{
  candidateFeedback: object,
  sections: array,
  overallAssessment: string
}>
```

**State Management:**
- None (stateless)

**Integration Points:**
- **Depends on:** `callDeepSeek`, schema validation service
- **Called by:** Report generator agent

**Side Effects:**
- Calls LLM API
- Records LLM usage

**Critical Behavior:**
- Generates structured candidate feedback
- Normalizes and validates all feedback fields
- Applies trust scoring to AI-generated content
- Builds grounding payload for transparency
- Handles fallback values for missing data

---

## 8. Validation & Schema Services (Medium Risk) ✅ DOCUMENTED

### 8.1 schemaValidationService.js (377 lines)

**File:** `backend/src/services/schemaValidationService.js`

**Exports:**
```javascript
export const validateAnalyzeOutput = (payload: object) => object
export const validateInterviewPlan = (plan: object) => object
export const validateReportOutput = (report: object) => object
export const validateReportQaOutput = (qa: object) => object
```

**State Management:**
- None (pure functions)

**Integration Points:**
- **Depends on:** Scoring schema service, taxonomy service
- **Called by:** All controllers, agent services

**Side Effects:**
- None (pure validation)

**Critical Behavior:**
- Validates and normalizes all AI-generated outputs
- Provides fallback values for missing fields
- Ensures type safety for all nested objects
- Handles legacy format compatibility

---

## 9. Controllers (High Risk) - PENDING DOCUMENTATION

### 9.1 interviewController.js (416 lines)

**Status:** Pending full documentation

**Known Exports:**
- Route handlers for interview lifecycle
- Text and voice interview endpoints

**Integration Points:**
- Calls `masterAiService.runTask()`
- Calls session services
- Handles WebSocket connections for voice

---

## 10. Frontend Hooks (High Risk) - PENDING DOCUMENTATION

### 10.1 useDuplexVoiceSocket.js (471 lines)

**Status:** Pending full documentation

**Known Behavior:**
- Manages WebSocket connection for duplex voice
- Handles binary audio streaming
- Manages connection lifecycle

### 10.2 useVoiceSessionLifecycleController.js (458 lines)

**Status:** Pending full documentation

**Known Behavior:**
- Controls voice session lifecycle
- Manages session state transitions
- Handles error recovery

### 10.3 useVoiceInterviewSession.js (411 lines)

**Status:** Pending full documentation

**Known Behavior:**
- Main hook for voice interview sessions
- Integrates voice socket and lifecycle controller
- Manages interview state

---

## Summary Statistics

**Documentation Progress:**
- ✅ Voice Services: 8/8 files documented (100%)
- ✅ AI Orchestration: 1/1 files documented (100%)
- ✅ Agent Services: 1/1 files documented (100%)
- ✅ AI Control: 2/2 files documented (100%)
- ✅ Session Services: 2/2 files documented (100%)
- ✅ Matching Services: 3/3 files documented (100%)
- ✅ Report Services: 1/1 files documented (100%)
- ✅ Validation Services: 1/1 files documented (100%)
- ⏳ Controllers: 0/5 files documented (0%)
- ⏳ Frontend Hooks: 0/10 files documented (0%)
- ⏳ Other Services: 0/20 files documented (0%)

**Total:** 19/54 files fully documented (35%)

**Codebase Scale:**
- 206 backend service files total
- 54 large files (>200 lines) requiring refactoring
- 19 highest-risk files documented with complete API contracts

---

## Next Steps

1. **Complete Controller Documentation** (5 files)
   - interviewController.js
   - reportController.js
   - sessionController.js
   - analyzeController.js
   - uploadController.js

2. **Complete Frontend Hook Documentation** (10 files)
   - Voice hooks (3 files)
   - Interview hooks (2 files)
   - Report hooks (2 files)
   - Other hooks (3 files)

3. **Complete Remaining Service Documentation** (20 files)
   - JD parsing services
   - CV analysis services
   - RAG services
   - Company research services
   - Utility services

4. **Record Test Coverage Baseline**
   - Run existing test suites
   - Document current coverage percentages
   - Identify untested critical paths

5. **Create Missing Tests**
   - Add 84+ identified missing tests
   - Ensure all critical behaviors are tested
   - Verify integration points

6. **Begin Safe Refactoring**
   - Start with pure helper functions
   - Extract stateless utilities
   - Refactor one file at a time
   - Run tests after each change

---

## Document Maintenance

**Last Updated:** 2026-05-28  
**Next Review:** Before any code refactoring begins  
**Owner:** Development Team  
**Status:** Living Document - Update as code evolves
