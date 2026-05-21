# Compound AI Architecture: Kiwi AI Interview Agent

## 1. Executive Summary

This document describes the **Compound AI System** architecture of the Kiwi AI Interview Agent as it exists in the current codebase. The system goes beyond simple "prompt-in / prompt-out" wrappers by orchestrating parsing, retrieval, interview planning, voice transport, report generation, report QA, and usage-cost tracking across multiple services.

The implementation integrates four major AI/Data components:
1. **Large Language Model (LLM)**: DeepSeek handles structured JSON generation, interview turn planning, report drafting, report QA, and safeguard critic/reparse paths.
2. **Vector/Retrieval Store**: PostgreSQL with `pgvector` stores runtime `document_chunks` and supports session/global retrieval.
3. **Flexible AI Artifact Store**: MongoDB stores AI logs, reports, transcripts, plans, match records, normalized CV/JD artifacts, and usage events.
4. **External Speech API**: Azure Speech Services provide realtime STT and TTS for the product-wired voice flow.

By combining an LLM planner, deterministic service-layer guards, pgvector retrieval, MongoDB AI artifacts, and Azure voice transport, the system creates a stateful interview workflow rather than a generic chatbot.

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

### C. External API (Azure Speech Services)
To simulate a real interview, the product-wired voice mode lets the system listen and speak through Azure Speech.
- **Live STT WebSocket**: `backend/src/api/realtimeVoiceSocket.js` exposes `/api/interview/:sessionId/voice/live`.
- **Duplex Voice WebSocket**: `backend/src/api/duplexVoiceSocket.js` exposes `/api/interview/:sessionId/voice/duplex` and delegates STT, adaptive turn processing, TTS, and barge-in behavior to `backend/src/services/voice/`.
- **Frontend voice shell**: `frontend/src/hooks/useVoiceInterviewSession.js` combines microphone permission, realtime PCM streaming, VAD, duplex socket control, TTS playback queue, network-quality checks, latency trace summaries, and session recording upload.
- **Current status**: voice is product-wired, but full proof still depends on live Azure Speech credentials, authenticated WebSocket access, browser microphone permission, and an in-progress interview session.

### D. Usage Cost and Commercial Stress Test

The current codebase also tracks measured AI/service usage for report-ready commercial analysis.

- `backend/src/db/models/aiUsageEventModel.js` stores usage events for DeepSeek, Azure Speech, and local stages.
- `backend/src/services/aiUsageTrackingService.js` aggregates session/user cost, provider breakdown, stage breakdown, and commercial stress payloads.
- `backend/src/config/aiUsagePricing.js` centralizes DeepSeek and Azure Speech pricing assumptions.
- `frontend/src/components/report/CommercialStressTestSection.jsx` displays the execution cost and human-time comparison in the report page.

This is implemented as an estimation layer based on recorded events. It should not be described as a full finance-grade billing system.

---

## 3. Core Prompts

The following prompts drive the primary Agentic loops in the system:

### 1. The Interviewer Agent (Conversation Planner)
This prompt orchestrates the state machine of the interview, determining when to ask a new question, when to probe deeper, and when to conclude.

```text
You are KiwiCoach, a senior HR interviewer conducting a structured technical interview.
Your goal is to evaluate the candidate against the Job Description while maintaining a highly professional, encouraging, yet probing tone.

Current Interview State:
- Focus Area: {{focusArea}}
- Completed Questions: {{questionCount}}
- Candidate Last Input: {{userTranscript}}

Relevant Knowledge Retrieved (RAG):
{{ragContext}}

Instructions:
1. Analyze the candidate's answer against the RAG knowledge.
2. Decide your next action: 'acknowledge_and_probe', 'move_to_next_topic', or 'conclude_interview'.
3. Formulate your response in a natural conversational tone, suitable for Text-to-Speech playback.
4. Output your decision and response strictly as a JSON object.
```

### 2. The Critic Agent (Self-Correction Safeguard)
This prompt powers the autonomous error-correction loop, ensuring that the system does not silently accept hallucinated parsing results.

```text
You are an objective QA Assessor evaluating an AI's attempt to extract structured skills from a Job Description.
Review the extracted output against the original raw text.

Raw Job Description:
{{rawJdText}}

AI Extracted Output:
{{extractedJson}}

Instructions:
Identify if any of the following failures occurred:
1. Hallucination: Are there skills listed that DO NOT exist in the raw text?
2. Omission: Did the AI miss critical "must-have" requirements?

Provide a JSON response with:
- "passed": boolean (true if flawless, false if errors found)
- "failure_reasons": array of strings explaining exactly what went wrong.
```

## 4. Current Implementation Boundaries

- Text interview mode is the safest demo path.
- Voice mode is wired through frontend and backend, but still needs live E2E verification in the target deployment environment.
- The retrieval embedding is deterministic and local; production-grade semantic retrieval would require a real embedding model migration plan.
- Privacy and compliance claims must stay conservative because retention workers, account-wide deletion, and encryption-at-rest guarantees are not fully implemented.

## 5. Conclusion

Kiwi AI Interview Agent is best framed as a compound AI interview coaching workflow: it combines CV/JD parsing, retrieval, guarded matching, adaptive interview control, voice transport, report generation, QA, and cost tracking. The core product value is not "voice chatbot"; it is personalised, evidence-based interview practice grounded in the user's CV and target JD.
