# Compound AI Architecture: Kiwi AI Interview Agent

## 1. Executive Summary

This document describes the **Compound AI System** architecture of the Kiwi AI Interview Agent as it exists in the current codebase. The system goes beyond simple "prompt-in / prompt-out" wrappers by orchestrating parsing, retrieval, interview planning, voice transport, report generation, report QA, and usage-cost tracking across multiple services.

The implementation integrates four major AI/Data components:
1. **Large Language Model (LLM)**: DeepSeek handles structured JSON generation, bounded question naturalization and optional decision support, report drafting/rewriting, and safeguard critic/reparse paths. Deterministic services own the core action, scoring, and integrity rules.
2. **Vector/Retrieval Store**: PostgreSQL with `pgvector` stores runtime `document_chunks` and supports session/global retrieval.
3. **Flexible AI Artifact Store**: MongoDB stores AI logs, reports, transcripts, plans, match records, normalized CV/JD artifacts, and usage events.
4. **External Speech APIs**: Azure is the default realtime STT/TTS provider, with independently configurable ElevenLabs STT and TTS fallback.

By combining an LLM planner, deterministic service-layer guards, pgvector retrieval, MongoDB AI artifacts, and routed speech transport, the system creates a stateful interview workflow rather than a generic chatbot.

---

## 2. Component Integration Details

### A. Vector Database (pgvector on PostgreSQL)
Instead of relying purely on an LLM's finite context window, the system uses PostgreSQL `document_chunks` for runtime retrieval over CV, JD, session, and imported interview knowledge chunks.

**Implementation Strategy:**
- **Schema**: `backend/src/db/initPostgresSchema.js` creates `document_chunks` with `embedding vector(256)`.
- **Embedding**: `backend/src/services/embeddingService.js` uses a deterministic 256-dimensional weighted hash embedding. This is appropriate for an MVP retrieval experiment, but should not be described as equivalent to a production semantic embedding model.
- **Retrieval Mechanism**: `backend/src/services/ragRetrievalService.js` and the newer retrieval services use PostgreSQL cosine distance plus keyword/source-quality logic to retrieve relevant context.
- **Code Reference**: Runtime vector retrieval uses SQL shaped like:
  ```sql
  SELECT id, text_content, 1 - (embedding <=> $1) AS semantic
  FROM document_chunks
  ORDER BY embedding <=> $1
  LIMIT 100
  ```

### B. LLM & Custom Agentic Framework (DeepSeek)
The codebase uses a custom service-layer agentic framework rather than depending on LangChain or AutoGen as the primary control layer. This keeps latency-sensitive interview behavior, ownership checks, persistence, and deterministic product rules close to the application code.

Our Custom Agentic Framework features:
- **Master task coordination**: `backend/src/services/masterAiService.js` routes high-level tasks such as next interview turn, report generation, and report QA.
- **AI control layer**: `backend/src/services/aiControl/` contains action planning, evidence bundle construction, trajectory tracking, reflection, memory, mode guards, and action execution.
- **Specialized agents**: `backend/src/services/agents/` contains interviewer, retrieval, report generator, and report QA agents.
- **JD safeguard loop**: `backend/src/services/jobDescription/` implements critic/gate/reparse safeguards for structured JD parsing.
- **Match safeguard loop**: `backend/src/services/match/` contains guarded matching, scoring, explanation, validation target building, and critic support.

### C. External speech APIs (Azure and ElevenLabs)
To simulate a real interview, the product-wired voice mode routes listening and speaking through configurable speech providers.
- **Live STT WebSocket**: `backend/src/api/realtimeVoiceSocket.js` exposes `/api/interview/:sessionId/voice/live`.
- **Duplex Voice WebSocket**: `backend/src/api/duplexVoiceSocket.js` exposes `/api/interview/:sessionId/voice/duplex` and delegates STT, adaptive turn processing, TTS, and barge-in behavior to `backend/src/services/voice/`.
- **STT provider router**: `backend/src/services/voice/realtimeSpeechProviderRouter.js` uses Azure by default and can fall back to ElevenLabs while the session starts. It does not switch an active turn mid-recording.
- **TTS provider router**: `backend/src/services/voice/ttsProviderRouter.js` resolves TTS independently from STT and supports Azure and ElevenLabs.
- **Frontend voice shell**: `frontend/src/hooks/useVoiceInterviewSession.js` combines microphone permission, realtime PCM streaming, VAD, duplex socket control, TTS playback queue, network-quality checks, latency trace summaries, and session recording upload.
- **Current status**: voice is product-wired, but full proof still depends on live configured-provider credentials, authenticated WebSocket access, browser microphone permission, and an in-progress interview session.

### D. Resumable recording pipeline

Live interview processing and recording delivery are deliberately separated.

- `frontend/src/runtime/recording/` persists MediaRecorder chunks and upload metadata in IndexedDB, performs single-flight resumable upload, and supports best-effort Background Sync.
- `backend/src/services/recording/recordingUploadService.js` validates ownership, manifests, sequence, checksum, limits, retry, and finalize operations.
- `backend/src/services/recording/recordingConversionWorker.js` claims finalized jobs and performs asynchronous MP3 conversion.
- The report page can open after local recording durability; it polls recording status without coupling report readiness to conversion readiness.

### E. Report integrity and QA repair

The report pipeline now uses one accepted-answer dataset rather than treating every raw user turn as scoreable evidence.

- `reportTurnDatasetService.js` pairs countable interview questions with accepted user answers and excludes repair, confirmation, clarification, repeat, and system turns.
- `questionAssessmentContractService.js`, `turnRubricService.js`, and `reportScoreService.js` keep question assessment and numeric scoring deterministic.
- `reportEvidenceReferenceService.js` and `reportTranscriptRiskService.js` expose claim-level evidence and transcript conflicts to the report UI and PDF.
- `reportQaAgent.js` checks grounding, metric consistency, rubric alignment, rewrite quality, evidence rows, and transcript-risk visibility.
- `reportQaRepairOrchestratorService.js` may run at most two wording repairs and re-grounds claims after each rewrite. Deterministic integrity failures skip wording repair.
- `SessionReport` persists versions, repair history, QA attempt count, and `ready`, `ready_after_repair`, `needs_review`, or `repair_failed` status.

### F. Usage Cost and Commercial Stress Test

The current codebase also tracks measured AI/service usage for report-ready commercial analysis.

- `backend/src/db/models/aiUsageEventModel.js` stores usage events for DeepSeek, speech providers, and local stages.
- `backend/src/services/aiUsageTrackingService.js` aggregates session/user cost, provider breakdown, stage breakdown, and commercial stress payloads.
- `backend/src/config/aiUsagePricing.js` centralizes DeepSeek and Azure Speech pricing assumptions. ElevenLabs usage events are recorded, but the current estimator assigns non-Azure speech providers zero cost until provider-specific pricing is added.
- `frontend/src/components/report/CommercialStressTestSection.jsx` displays the execution cost and human-time comparison in the report page.

This is implemented as an estimation layer based on recorded events. It should not be described as a full finance-grade billing system.

---

## 3. Prompt contracts

Prompt strings live beside the services that validate their output. The summaries below describe the current contracts; consult the referenced code for the exact text.

### 1. Bounded interview question micro-planner

`backend/src/services/questions/interviewMicroPlanningService.js` receives a controller-selected planning frame and fallback question. The model does not freely choose the next action. It returns strict JSON with:

```json
{
  "selectedAngle": "short grounded angle",
  "shortReason": "one short sentence",
  "finalSpokenQuestion": "one TTS-ready question",
  "evidenceUsed": ["source label"],
  "riskFlags": []
}
```

Deterministic validation enforces one question, mode safety, parent context for follow-ups, wording quality, and a usable fallback. The final interviewer-agent novelty guard can still reject the naturalized wording if it repeats transcript history.

### 2. JD parse critic and reparse safeguard

`backend/src/services/jobDescription/jdParseCriticAgent.js` compares raw JD text with parsed JSON and returns strict JSON shaped around:

```json
{
  "verdict": "pass | revise | reject",
  "confidence": 0.0,
  "blockOutput": true,
  "blockMatch": true,
  "issues": [],
  "reparseInstructions": [],
  "reasoning": ""
}
```

The critic checks field fidelity, section classification, technical-term preservation, and core-versus-bonus requirements. `jdParseReparseAgent.js` consumes targeted instructions. Heuristic fallbacks and bounded timeout/retry configuration remain part of the safeguard path.

## 4. Current Implementation Boundaries

- Text interview mode is the safest demo path.
- Voice mode is wired through frontend and backend, but still needs live E2E verification in the target deployment environment and with the selected speech-provider order.
- The retrieval embedding is deterministic and local; production-grade semantic retrieval would require a real embedding model migration plan.
- A retention audit/cleanup pipeline, backup/quarantine services, and queued-job worker exist, but the worker is disabled by default. Account-wide deletion, encryption-at-rest guarantees, and deployment policy remain incomplete.

## 5. Conclusion

Kiwi AI Interview Agent is best framed as a compound AI interview coaching workflow: it combines CV/JD parsing, retrieval, guarded matching, adaptive interview control, voice transport, report generation, QA, and cost tracking. The core product value is not "voice chatbot"; it is personalised, evidence-based interview practice grounded in the user's CV and target JD.
