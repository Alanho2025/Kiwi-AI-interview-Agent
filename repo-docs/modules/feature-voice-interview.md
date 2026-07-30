# Voice interview

voice interview 是 product-wired，但它不是最稳的低依赖路径。它依赖浏览器麦克风权限、authenticated WebSocket、有效 STT/TTS provider 配置、live session，以及 `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` 定义的产品状态机。

## 读者应该先记住什么

voice 的核心不是“把音频转文字”。它要在 assistant speaking、waiting for user、user speaking、STT finalizing、confidence gate、answer processing、TTS streaming 之间保持状态一致。低置信 transcript 是系统理解问题，不是用户答错；contentful low-confidence transcript 必须进入 confirmation path。

WebSocket `open` 只代表 transport 已连接。前端必须等 backend 完成认证、session load 和 duplex session 建立并送出 `session_ready`，才能启动 VAD。初始化期间收到的 ordered messages 会被保留；无法匹配 active turn 的 `speech_end` 会回传 retryable `turn_rejected`，前端离开 processing、留在同一题并提示重答。

## 一个代表 case

```text
输入: WebSocket open -> session_start -> session_ready -> speech_start + PCM audio chunks + speech_end
动作: STT final -> confidence gate -> accepted/confirmation/rejected
输出: accepted answer 进入 adaptive turn，或 repair/confirmation prompt
边界: transport rejection、repair prompt 和 transcript confirmation 都不保存/评分/计入 interview question count
```

## 转写校准现在怎么守边界

voice STT session start 会先从已存在的 session analysis、parsed CV profile、parsed JD rubric 和 interview plan 产生 source-aware contextual glossary，再把 bounded phrase list 传给 provider。这个 glossary 只能帮助 STT 识别专有名词和技术词，不能把 CV/JD 事实补成用户已经说过的答案。

final transcript 回来后，后端会保留 raw transcript，并只做两类保守处理：现有 static normalization，以及 provider N-best 中近似置信、文字差异 bounded、且命中 glossary term 的 rerank。accepted turn metadata 会保存 `transcriptCalibration` 和 `transcriptNBest`，让后续 scoring/report 能追溯 raw text、calibrated text、decision type 和 guardrail flags。

## 转写 review policy 现在怎么决定要不要打断

校准之后，`transcriptReviewPolicyService` 会把 uncertainty 分成 `auto_accept`、`deferred_review`、`immediate_confirmation`、`reject_unusable`。低风险 term surface correction 可以继续面试；CV/JD-only 的专业词不会被静默写成用户说过的话，而是进入 deferred review；数字、否定、ownership、结果、technical choice 或 contentful low-confidence 这类 scoring-impacting uncertainty 会进入 immediate confirmation。

backend voice turn 会保存 `transcriptReviewDecision` 和 `transcriptReviewItems`。未确认 high-risk transcript 不会进入 report scoring dataset；deferred review 会在 report transcript risk 中显示。前端 report 的 `TranscriptRiskSection` 会显示 raw/proposed snippets、risk/reason label 和“只能修正系统听错，不要新增答案内容”的边界提醒。

目前没有可持久化的 interactive review action API；report UI 只显示 review evidence，还不能真正执行 `Accept correction`、`Keep raw` 或 `Clarify what I said`。也没有宣称 live Azure/ElevenLabs production SLO 已验证。

## 问题 scope clarification 怎么处理

CP3 在 accepted Voice transcript 进入一般 evaluator 前加入 deterministic clarification resolver。它按 intent family 识别 repeat、slower、shorter、rephrase、meaning、scope、example、timeframe、understanding confirmation、too long/complex/ambiguous 和 uncertain help。一般重述/求助即使题目 `ambiguityMode=none` 也会走 bounded help；需要 role-specific scope 的问题才读取 versioned prepared context。命中后选择 `ANSWER_QUESTION_SCOPE`，沿用同一个 root question，并把 request/response 保存为 non-countable turn。它不会另建 PostgreSQL `interview_responses` answer row，不会增加 evaluator、next-question selector 或 heavy model/retrieval call。

缺少 prepared context 时会 fail closed 到通用 bounded rephrase；同一 root 重复询问会进入 scaffold，避免无限 clarification loop。候选人用 `I'll assume ...` 开始并继续给出实质答案时，答案照常评分；实质答案尾端附带小确认，或叙述自己曾经 clarified requirements，也不会被关键字误吞。runtime 会用 PostgreSQL latest question 补足 transcript context；两者皆找不到 active root 时，任何 accepted voice speech 都按 non-answer repair 处理，不会建立正式 answer 或评分。低置信或听不清的 transcript 仍由 STT confirmation path 优先。

`2026.1` source catalog 全部使用 `ambiguityMode=none`；`2026.2` source catalog 已有 versioned `clarificationContextVersion`。运行时只会优先加载数据库中 lifecycle 为 `approved` 的 `2026.2`，没有时再回退至 `2026.1` 或既有安全路径。source manifest 不等于数据库实际已启用，因此 valid-scope 的真人 Voice/browser/listen evidence 仍待执行，不能直接改写 `2026.1`。

## 代码怎么追

| 机制 | 源码入口 | 说明 |
| --- | --- | --- |
| 产品契约 | [voice behavior spec](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md) | 定义 state machine、confidence、counting、latency target |
| WebSocket transport | [duplex voice socket](../../backend/src/api/duplexVoiceSocket.js) | 认证、session load、JSON/binary audio event routing |
| Voice agent session | [duplex voice agent service](../../backend/src/services/voice/duplexVoiceAgentService.js) | STT session、barge-in、turn coordinator、TTS streaming |
| Frontend readiness/recovery | [duplex socket hook](../../frontend/src/hooks/voice/useDuplexVoiceSocket.js)、[socket controller](../../frontend/src/hooks/voice/useDuplexSocketController.js) | `session_ready` handshake、`turn_rejected` recovery、processing reset |
| Recording recovery | [recording upload manager](../../frontend/src/runtime/recording/recordingUploadManager.js) | IndexedDB local-first durability、remote status sync、pending sequence rebase |
| Turn coordination | [duplex turn coordinator](../../backend/src/services/voice/duplexTurnCoordinator.js) | transcript gate、pending confirmation、adaptive turn |
| Confidence gate | [speech confidence gate](../../backend/src/services/voice/speechConfidenceGate.js) | accepted、rejected、needs confirmation |
| Transcript calibration | [phrase hint service](../../backend/src/services/voice/speechPhraseHintService.js)、[calibration service](../../backend/src/services/voice/transcriptCalibrationService.js) | dynamic glossary、phrase hints、static normalization metadata、bounded N-best rerank |
| Transcript review policy | [review policy service](../../backend/src/services/voice/transcriptReviewPolicyService.js) | auto/deferred/immediate/reject 分类、scoring policy、evidence boundary |
| Scope clarification | [scope resolver](../../backend/src/services/voice/questionScopeClarificationService.js)、[scope controller](../../backend/src/services/voice/questionScopeControllerService.js)、[realtime turn service](../../backend/src/services/voice/realtimeVoiceTurnService.js) | deterministic intent families、same-root non-countable persistence、intent-specific response、substantive-answer guard |
| Report transcript risk | [report transcript risk service](../../backend/src/services/report/reportTranscriptRiskService.js)、[turn dataset](../../backend/src/services/report/reportTurnDatasetService.js)、[report UI](../../frontend/src/components/report/TranscriptRiskSection.jsx) | deferred review visible in report；unconfirmed high-risk transcript 不进入 scoring |
| Frontend hook | [voice session hook](../../frontend/src/hooks/useVoiceInterviewSession.js) | UI-facing state、VAD、socket、audio queue |
| Role-Fit latency marker | [turn orchestrator](../../backend/src/services/questions/interviewTurnOrchestratorService.js) | 预计算 metadata 在既有 ranker 中使用；记录 `roleFitQuestionRankingMs`，不新增 fetch 或 model lane |

## 怎么检查

mock-safe tests 在 `backend/tests/robustness/voice`、`backend/tests/integration/voice`、`backend/tests/robustness/questions/interviewTurnOrchestratorService.test.js` 和 frontend voice hook tests。`questionScopeClarificationService.test.js` 覆盖 required intent families、使用者实际长句、mixed substantive answers、missing-root recovery、bounded skip、legacy unsafe next-root sanitization 与 ASR-like wording；独立 `questionScopeClarificationCorpus.test.js` 的 48-case local paraphrase holdout recall 为 100%，44-case substantive-answer corpus false-positive 为 0%。`questionScopeControllerService.test.js` 和 `realtimeVoiceTurnMocked.test.js` 锁定 same-root、non-answer、no formal persistence、DB latest-question fallback、fresh-root skip 行为。2026-07-30 完整 voice robustness group 为 128 tests，duplex integration 2 tests；post-audit remediation focused slice 为 5 files / 56 tests。真人 microphone/listening 与 live-provider latency 尚未执行。

M5 automated browser H1 使用真实 frontend/backend/WebSocket、mock AI 和 test STT/TTS，已完成 2/2 turns、正式结束、report 载入和 durable harness diagnostics。下一问 first-audio 是 `3390 ms`、`2089 ms`，只有 1/2 达到 `<=3000 ms`，所以当前结论是 local functional pass，不是 latency release pass。真人 browser microphone、live provider、reconnect/timeout SLO 与 production observe 仍需另外执行。

继续读 [duplex voice agent](agent-duplex-voice.md)，看 WebSocket conversation 如何拥有一次 voice turn。

证据状态：除特别标注外，本页基于当前源码已确认。
