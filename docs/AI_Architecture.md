# Compound AI Architecture: Kiwi AI Interview Agent

## 1. Executive Summary

This document describes the **Compound AI System** architecture of the Kiwi AI Interview Agent. The system goes beyond simple "prompt-in / prompt-out" wrappers by orchestrating multiple distinct AI components to form an autonomous, agentic interview experience.

Our solution integrates three major AI/Data components:
1. **Large Language Model (LLM)**: DeepSeek (via direct JSON API) handles complex reasoning, conversation flow planning, question generation, and candidate evaluation.
2. **Vector Database**: PostgreSQL with the `pgvector` extension (hosted on Neon) provides persistent semantic memory and fast Retrieval-Augmented Generation (RAG).
3. **External Cognitive APIs**: Azure Speech Services provide real-time duplex Speech-to-Text (STT) and Text-to-Speech (TTS) to interface with users in a highly natural, voice-driven way.

By combining an LLM planner with a dedicated Vector Database and real-time sensory inputs (Azure Voice), the system creates a deeply integrated, stateful, and "hard-to-replicate" technical architecture.

---

## 2. Component Integration Details

### A. Vector Database (pgvector on PostgreSQL)
Instead of relying purely on an LLM's finite context window, we employ a true Vector Database to store and retrieve contextual knowledge (CVs, Job Descriptions, past interview turns). 

**Implementation Strategy:**
- **Schema**: A dedicated `document_chunks` table using the `vector(32)` type.
- **Embedding**: Text features are embedded and mapped to a 32-dimensional vector space (designed to be highly localized and fast).
- **Retrieval Mechanism**: We use PostgreSQL's native cosine distance operator (`<=>`) to semantically match the candidate's speech to the rubric in real time.
- **Code Reference**: See `backend/src/services/ragRetrievalService.js` for the exact SQL querying mechanism:
  ```sql
  SELECT id, text_content, 1 - (embedding <=> $1) AS semantic
  FROM document_chunks ORDER BY embedding <=> $1 LIMIT 100
  ```

### B. LLM & Custom Agentic Framework (DeepSeek)
While off-the-shelf frameworks like LangChain or AutoGen exist, we have developed our own **Custom Agentic Framework** to maintain strict control over latency, determinism, and business logic. As approved by the course requirements, our customized LLM-based agentic approach focuses on *true need* rather than framework lock-in.

Our Custom Agentic Framework features:
- **Master-Sub Agent Orchestration**: A Master Planner (`actionPlanner.js`) controls specialized sub-agents (`interviewerAgent.js`, `reportQaAgent.js`).
- **ReAct-style Reasoning**: Agents use thought-action-observation loops to decide whether to probe, move on, or correct the transcript.
- **Agentic Self-Correction (Safeguards)**: We implement a strict Critic-Gate-Reparse pattern. When a Job Description is parsed, a `CriticAgent` evaluates the output against heuristic rules. If it detects hallucinations, a `GateService` rejects the output and triggers a `ReparseAgent` to correct the errors autonomously.

### C. External API (Azure Speech Services)
To simulate a real interview, the LLM must "hear" and "speak". 
- **Duplex Voice WebSocket**: We integrate `Azure Speech SDK` via a custom WebSocket (`duplexVoiceSocket.js`) that streams raw PCM audio.
- **Latency Control**: Azure provides <500ms TTFB (Time to First Byte) audio streaming, keeping the conversation fluid and realistic.

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

## 4. Conclusion
By strictly enforcing the separation between Memory (`pgvector`), Logic (`DeepSeek LLM`), and Senses (`Azure Speech`), Kiwi AI Interview Agent demonstrates a robust, enterprise-grade Compound AI Architecture that acts autonomously and self-corrects based on predefined guardrails.
