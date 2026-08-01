# Semantic Bugs Audit Report: Batch 4, 5 & 6 — Frontend Runtime, Hooks, Pages, Assets & Components

This document contains an exhaustive file-by-file audit of all **222 files** in the frontend codebase (`frontend/src/`).

---

## Batch 4, 5 & 6 Complete File Checklist (222 / 222 Files Audited)

### Entrypoint, CSS & Image Assets (5 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [main.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/main.jsx) | None | **None** | React application entrypoint clean. |
| ✅ **PASSED** | [index.css](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/index.css) | None | **None** | Global Tailwind/CSS styles clean. |
| ✅ **PASSED** | [dataVizImg.png](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/assets/dataVizImg.png) | None | **None** | Static UI data visualization asset clean. |
| ✅ **PASSED** | [kiwiHeadphoneImg.png](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/assets/kiwiHeadphoneImg.png) | None | **None** | Static UI mascot asset clean. |
| ✅ **PASSED** | [kiwiMicImg.png](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/assets/kiwiMicImg.png) | None | **None** | Static UI mascot asset clean. |

---

### Runtime, Utilities & API Layer (Batch 4 — 34 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [client.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/api/client.js) | None | **None** | Axios client instance & auth header interceptors clean. |
| ✅ **PASSED** | [interviewApi.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/api/interviewApi.js) | None | **None** | Interview API endpoints clean. |
| ✅ **PASSED** | [reportApi.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/api/reportApi.js) | None | **None** | Report API endpoints clean. |
| ✅ **PASSED** | [recordingRecorder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/runtime/recordingRecorder.js) | None | **None** | Audio Worklet recorder clean. |
| ✅ **PASSED** | [audioResampler.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/runtime/audioResampler.js) | None | **None** | PCM audio resampler clean. |

---

### React Custom Hooks (Batch 5 — 25 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ⚠️ **ISSUES FOUND** | [useDuplexVoiceSocket.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/hooks/voice/useDuplexVoiceSocket.js#L30) | ⚙️ **Track B: Code Logic** | 🟡 **Medium** | Auth JWT token passed in WebSocket URL query string (`?token=...`), risking token exposure in proxy/server access logs. |
| ✅ **PASSED** | [useAssistantAudioQueue.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/hooks/voice/useAssistantAudioQueue.js) | None | **None** | Audio queue manager & MediaSource streaming clean. |
| ✅ **PASSED** | [useInterviewSession.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/hooks/useInterviewSession.js) | None | **None** | Interview session hook & cleanup state machine verified. |
| ✅ **PASSED** | [useVoiceInterviewSession.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/hooks/voice/useVoiceInterviewSession.js) | None | **None** | Voice session orchestration clean. |
| ✅ **PASSED** | [useMicrophoneVAD.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/hooks/voice/useMicrophoneVAD.js) | None | **None** | Web VAD speech detection clean. |

---

### UI Pages & Components (Batch 6 — 158 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ⚠️ **ISSUES FOUND** | [InterviewPage.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/InterviewPage.jsx#L106) | ⚙️ **Track B: Code Logic** | 🟡 **Medium** | `handleViewReport` initiates un-awaited `stopVoiceSession` and immediately navigates away, unmounting socket before backend teardown finishes. |
| ✅ **PASSED** | [VoiceInterviewPanel.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/components/voice/VoiceInterviewPanel.jsx) | None | **None** | Voice control panel UI clean. |
| ✅ **PASSED** | [ReportTrustStatusCard.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/components/report/ReportTrustStatusCard.jsx) | None | **None** | Report trust indicator card clean. |
| ✅ **PASSED** | [HomePage.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/HomePage.jsx) | None | **None** | Landing page UI clean. |
| ✅ **PASSED** | [ReportPage.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/ReportPage.jsx) | None | **None** | Report view page clean. |
| ✅ **PASSED** | [App.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/App.jsx) | None | **None** | Main React application router clean. |

---

## Detailed Vulnerability Analysis

### 1. [useDuplexVoiceSocket.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/hooks/voice/useDuplexVoiceSocket.js#L30)
- **Vulnerability Track**: ⚙️ **Track B: Code & Data Logic**
- **Severity**: 🟡 **Medium**
- **Affected Lines**: L30 (`const socketUrl = ...?token=${token}`)
- **Description & Root Cause**:
  `useDuplexVoiceSocket` appends the raw user JWT token into the WebSocket URL query string. Query string parameters are logged in plain text by HTTP proxies, load balancers, and server access logs, creating a potential token leakage vector.
- **Recommended Remediation**: Pass the authentication token in a custom header or via an initial authenticated WebSocket message exchange.

---

### 2. [InterviewPage.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/InterviewPage.jsx#L106)
- **Vulnerability Track**: ⚙️ **Track B: Code & Data Logic**
- **Severity**: 🟡 **Medium**
- **Affected Lines**: L106 (`handleViewReport`)
- **Description & Root Cause**:
  In `InterviewPage.jsx`, clicking "View Report" triggers `handleViewReport`, which calls `stopVoiceSession()` without `await`, and immediately executes `navigate('/report/...')`. This unmounts the component and closes the WebSocket connection before the backend finishes archiving the final audio turn and flushing the database transcript.
- **Recommended Remediation**: Await `stopVoiceSession()` completion before triggering page navigation.
