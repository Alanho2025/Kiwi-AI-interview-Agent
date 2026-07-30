# Kiwi 症狀 ↔ 模組對照矩陣 (Symptom-Owner Matrix)

本矩陣列出使用者在 UI 或訪談中可能看到的具體故障現象，並直接對照到 100% 真實的後端檔案、關鍵參數以及免 Token 驗證測試指令。

---

## 🎯 症狀 ➔ 模組對照表

| 使用者看到的症狀 | 第一檢查點 (真實檔案路徑) | 關鍵參數 / 狀態 | 免 Token 單指令驗證 |
| :--- | :--- | :--- | :--- |
| **候選人說澄清問題（如「可否說明這題是什麼意思？」）被當成回答評分並跳下一題** | [questionScopeClarificationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/questionScopeClarificationService.js)<br>[speechConfidenceGate.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/speechConfidenceGate.js) | `turnType`, `countsAsAnswer`, `isClarificationTurn` | `npm run test:voice` |
| **語音 AI 朗讀問題時，把內部思考過程/Gap 分析講了出來 (Rationale Leakage)** | [voiceAcknowledgementService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/voiceAcknowledgementService.js)<br>[interviewDisplayTurnBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interview/interviewDisplayTurnBuilder.js) | `transcriptText`, `cleanAcknowledgement`, `resolveFeedbackMode`, `actionType` | `npm run test:questions` |
| **Live 面試卡在同一個主題無限追問 (Follow-up Loop)，無法切換到下一題** | [interviewTurnPolicy.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interview/interviewTurnPolicy.js)<br>[questionScopeControllerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/questionScopeControllerService.js) | `followUpDepth`, `maxFollowUpsPerTopic`, `topicProgress` | `npm run test:contracts` |
| **Live 面試中 AI 把 Plan/Reasoning 與要問的問題混在同一句唸出來** | [voiceAcknowledgementService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/voiceAcknowledgementService.js)<br>[masterAiService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/masterAiService.js) | `cleanAcknowledgement`, `isBadAcknowledgement`, `masterAiService` | `npm run test:questions` |
| **Candidate Report 包含內部 Token Cost、評分器診斷或過度批評文案** | [reportPublicationSummaryService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportPublicationSummaryService.js)<br>[candidateReportReflectionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/candidateReportReflectionService.js) | `candidateProjection` | `npm run test:report` |
| **面試過程連續跳題，或 Question Index 錯亂** | [interviewTurnPolicy.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interview/interviewTurnPolicy.js)<br>[interviewPlanService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interviewPlanService.js) | `currentQuestionIndex`, `rootQuestionId` | `npm run test:contracts` |
| **CV 或 JD 解析失敗、欄位缺失或文字不全** | [cvAnalysisService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvAnalysisService.js)<br>[jdUniversalParserService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdUniversalParserService.js) | `cvSchemaNormalizer`, `jdSafeguardHeuristics` | `npm run test:cv`<br>`npm run test:jd` |
| **匹配分數異常或缺口檢索 (RAG Evidence) 不相關** | [matchService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/matchService.js)<br>[ragRetrievalService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/ragRetrievalService.js) | `fusionScore`, `weighted_hash_ngram_v2` | `npm run test:match`<br>`npm run test:retrieval` |
| **語音連線中斷或 Azure TTS 沒發出聲音** | [duplexVoiceAgentService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/duplexVoiceAgentService.js)<br>[azureSpeechService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/azureSpeechService.js) | `wsState`, `ttsStreamQueue` | `npm run test:voice` |
| **輸入 JD 網址抓取失敗、私有 IP 被封鎖或提取內容為空** | [urlCaptureService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/urlCaptureService.js) | `Blocked Source`, `Fetch Failed`, `Extraction Failed` | `npm run test:jd` |
| **超長或雜亂 JD 觸發 AI 預算上限，降級為 Heuristics 啟發式解析** | [jdSafeguardAiBudget.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdSafeguardAiBudget.js)<br>[jdSafeguardHeuristics.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdSafeguardHeuristics.js) | `aiBudgetExceeded`, `heuristicFallback` | `npm run test:jd` |
| **報告評分出現虛構證據 (Hallucination Guard 觸發)** | [claimGroundingService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/claimGroundingService.js) | `evidenceMatchConfidence`, `claimGrounding` | `npm run test:report` |
| **未完成或結構異常的報告被阻止發布與索引 (Report Indexing Guard)** | [reportIndexingGuardService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/reportIndexingGuardService.js) | `reportIndexingGuard` | `npm run test:report` |
| **面試 Session 已經 Pause 或是併發修改衝突 (Interview State Conflict)** | [interviewSessionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interview/interviewSessionService.js)<br>[companyValuesRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/company/companyValuesRepository.js) | `invalidState`, `role-fit review conflict` | `npm run test:contracts` |

---

## 🛠️ 排查 3 步驟

1. 當畫面出現故障時，在此表中搜尋符合的**「症狀」**。
2. 開啟對應的**「第一檢查點」**檔案，檢查關鍵參數的判斷分支。
3. 在終端機執行對應的**「免 Token 單指令驗證」**，確認測試是否重現故障或全綠通過。
