# Master Semantic Bugs & AI Logic Audit Report

**Project**: Kiwi AI Interview Agent  
**Audit Scope**: 100% Codebase Coverage — `backend/src` (456 files) & `frontend/src` (222 files) — Total **678 files**  
**Audit Framework**: Dual-Track Semantic Inspection  
  - 🤖 **Track A: AI & Domain Semantics** (Prompt design, LLM evaluators, scoring rubrics, product behavior rules)  
  - ⚙️ **Track B: Code & Data Logic** (State machines, data flow truncation, calculations, API protocol boundaries)  
**Date**: August 2026  

---

## Executive Summary & Vulnerability Statistics

A complete, file-by-file audit has been performed across all **678 files** in the codebase. Every single file is explicitly cataloged and accounted for across the batch documentation tables.

### Dual-Track Vulnerability Distribution

| Track | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | Total Vulnerabilities |
| :--- | :---: | :---: | :---: | :---: | :---: |
| 🤖 **Track A: AI & Domain Semantics** | **1** | **2** | **1** | **0** | **4** |
| ⚙️ **Track B: Code & Data Logic** | **3** | **4** | **4** | **2** | **13** |
| **Total Verified Vulnerabilities** | **4** | **6** | **5** | **2** | **17** |

- **Backend Audited Files (Batches 1–3)**: 64 + 136 + 256 = **456 Files** (100% of `backend/src`)
- **Frontend Audited Files (Batches 4–6)**: **222 Files** (100% of `frontend/src`)
- **Grand Total Accounted Files**: **678 Files** (100% Codebase Coverage)
- **Passed Files (0 Issues)**: 661 Files
- **Files with Verified/Fixed Issues**: 17 Vulnerabilities across 15 Files

---

## Master Vulnerability Matrix & Categorized Index

### 🤖 Track A: AI & Domain Semantics Vulnerabilities

1. 🔴 **Critical**: [claimGroundingService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/claimGroundingService.js#L27) — **Stopword Overlap Causes False Positive Feedback Grounding**
   - **Impact**: `overlapScore` includes English stopwords ("you", "should", "in"). Generic hallucinated LLM feedback gets `overlapScore >= 0.18` and is falsely verified as `confirmed_feedback` (`supported_by_answer`).
   - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md#1-claimgroundingservicejs)

2. 🟠 **High**: [interviewEvaluatorService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/interviewEvaluatorService.js#L68) — **Concise Valid Answers Falsely Flagged as Misunderstanding**
   - **Impact**: `detectMisunderstanding` flags any answer <= 8 tokens as a misunderstanding if it lacks the exact topic word, forcing unnecessary rephrase turns on valid concise answers.
   - **Report**: [batch-2-ai-services.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-2-ai-services.md#2-interviewevaluatorservicejs)

3. 🟠 **High**: [speechConfidenceConfig.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/config/speechConfidenceConfig.js#L27) — **Single-Word Confirmation Answers Falsely Rejected as Filler Speech**
   - **Impact**: `FILLER_TRANSCRIPTS` includes valid single-word responses (`'yes'`, `'no'`, `'okay'`), causing transcript confirmation turns to be falsely rejected as filler speech.
   - **Report**: [batch-1-infra-config.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-1-infra-config.md#1-speechconfidenceconfigjs)

4. 🟡 **Medium**: [jobDescriptionAiService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionAiService.js#L24) — **IT Role Restriction Prompt Drops Non-IT JD Skills**
   - **Impact**: System prompt instructs LLM *"You are a strict job-description parser for IT roles..."*, causing non-IT role JDs to miss domain-specific requirements.
   - **Report**: [batch-2-ai-services.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-2-ai-services.md#3-jobdescriptionaiservicejs)

---

### ⚙️ Track B: Code & Data Logic Vulnerabilities

5. 🔴 **Critical**: [cvProfileBuilderService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvProfileBuilderService.js#L111) — **CV Experience Text Silently Truncated at 1,200 Characters (FIXED)**
   - **Impact**: `experience` was hardcoded to `.slice(0, 1200)`. Fixed using `getSafeSectionText(8000)` with regression tests.
   - **Report**: [batch-2-ai-services.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-2-ai-services.md#1-cvprofilebuilderservicejs)

6. 🔴 **Critical**: [duplexTurnCoordinator.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/duplexTurnCoordinator.js#L43) — **Duplex Warmup Targets Previously Asked Question**
   - **Impact**: `resolveWarmupQuestionId` warms up the *already completed* question instead of pre-warming the *upcoming* question.
   - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md)

7. 🔴 **Critical**: [realtimeVoiceTurnService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/realtimeVoiceTurnService.js#L372) — **Realtime Voice TTS Metadata Overwrites Previous AI Turn**
   - **Impact**: Transcript snapshot taken before new AI turn is appended.
   - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md)

8. 🟠 **High**: [interviewStateService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interviewStateService.js#L96) — **`Math.max` Overrides User-Configured Question Limit (FIXED)**
   - **Impact**: `getResolvedTotalQuestions` used `Math.max`, causing user-selected 8-question limit to be overridden by blueprint defaults (12-15). Fixed to prioritize user settings with vitest unit tests.
   - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md)

9. 🟠 **High**: [interviewStateService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interviewStateService.js#L148) — **Time-Limited Mode Fails to Wrap Up on Q1 Expiration (FIXED)**
   - **Impact**: `hasReachedTimeLimit` blocked wrap-up if `answeredQuestionCount < 2`. Fixed to require `>= 1` user turn.
   - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md)

10. 🟡 **Medium**: [interviewStateService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interviewStateService.js#L205) — **Opening Question Order Miscalculated as 2 (FIXED)**
    - **Impact**: `getNextQuestionOrder` returned 2 on opening turn when `countableQuestionCount` was 0. Fixed to return 1.
    - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md)

11. 🟠 **High**: [matchScoringService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/matchScoringService.js#L253) — **False Negative Match Scoring Without Semantic Embeddings**
    - **Impact**: `applyEvidenceStrengthPolicy` forces status to `not_met` for hard requirements when `semanticMatches` is empty.
    - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md)

12. 🟠 **High**: [ttsStreamQueue.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/ttsStreamQueue.js#L31) — **Sentence Audio Chunk Index Collision in Streaming TTS**
    - **Impact**: `index: index + offset` causes sentence sequence index collision across multi-sentence audio streams.
    - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md)

13. 🟡 **Medium**: [sessionRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/repositories/sessionRepository.js#L311) — **Response Record Hardcodes `contains_sensitive_data = true`**
    - **Impact**: Hardcodes `contains_sensitive_data = true` for every response without checking if PII was present.
    - **Report**: [batch-1-infra-config.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-1-infra-config.md#2-sessionrepositoryjs)

14. 🟡 **Medium**: [interviewController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/interviewController.js#L254) — **SSE Error Triggers HTTP Headers Sent Node Crash**
    - **Impact**: `res.writeHead(200)` called before turn processing.
    - **Report**: [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md)

15. 🟡 **Medium**: [useDuplexVoiceSocket.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/hooks/voice/useDuplexVoiceSocket.js#L30) — **Auth Token Transmitted in WebSocket URL Query String**
    - **Impact**: JWT token appended to `?token=...` query param.
    - **Report**: [batch-4-5-6-frontend.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-4-5-6-frontend.md#1-useduplexvoicesocketjs)

16. 🟢 **Low**: [azureSpeechService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/azureSpeechService.js#L169) — **Azure TTS Hardcodes MP3 Content Type Header**
17. 🟢 **Low**: [speechConfidenceGate.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/speechConfidenceGate.js#L104) — **Null VAD Segment Count Check Bypass**

---

## Detailed Batch Subsystem Reports

- 📘 [batch-1-infra-config.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-1-infra-config.md) — 64 files
- 📘 [batch-2-ai-services.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-2-ai-services.md) — 136 files
- 📘 [batch-3-services-controllers.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-3-services-controllers.md) — 256 files
- 📘 [batch-4-5-6-frontend.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/semantic_bugs/batch-4-5-6-frontend.md) — 222 files
