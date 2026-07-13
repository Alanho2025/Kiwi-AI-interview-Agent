# Voice interview

voice interview 是 product-wired，但它不是最稳的低依赖路径。它依赖浏览器麦克风权限、authenticated WebSocket、有效 STT/TTS provider 配置、live session，以及 `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` 定义的产品状态机。

## 读者应该先记住什么

voice 的核心不是“把音频转文字”。它要在 assistant speaking、waiting for user、user speaking、STT finalizing、confidence gate、answer processing、TTS streaming 之间保持状态一致。低置信 transcript 是系统理解问题，不是用户答错；contentful low-confidence transcript 必须进入 confirmation path。

## 一个代表 case

```text
输入: WebSocket session_start + PCM audio chunks + speech_end
动作: STT final -> confidence gate -> accepted/confirmation/rejected
输出: accepted answer 进入 adaptive turn，或 repair/confirmation prompt
边界: repair prompt 和 transcript confirmation 不计入 interview question count
```

## 转写校准现在怎么守边界

voice STT session start 会先从已存在的 session analysis、parsed CV profile、parsed JD rubric 和 interview plan 产生 source-aware contextual glossary，再把 bounded phrase list 传给 provider。这个 glossary 只能帮助 STT 识别专有名词和技术词，不能把 CV/JD 事实补成用户已经说过的答案。

final transcript 回来后，后端会保留 raw transcript，并只做两类保守处理：现有 static normalization，以及 provider N-best 中近似置信、文字差异 bounded、且命中 glossary term 的 rerank。accepted turn metadata 会保存 `transcriptCalibration` 和 `transcriptNBest`，让后续 scoring/report 能追溯 raw text、calibrated text、decision type 和 guardrail flags。

## 转写 review policy 现在怎么决定要不要打断

校准之后，`transcriptReviewPolicyService` 会把 uncertainty 分成 `auto_accept`、`deferred_review`、`immediate_confirmation`、`reject_unusable`。低风险 term surface correction 可以继续面试；CV/JD-only 的专业词不会被静默写成用户说过的话，而是进入 deferred review；数字、否定、ownership、结果、technical choice 或 contentful low-confidence 这类 scoring-impacting uncertainty 会进入 immediate confirmation。

backend voice turn 会保存 `transcriptReviewDecision` 和 `transcriptReviewItems`。未确认 high-risk transcript 不会进入 report scoring dataset；deferred review 会在 report transcript risk 中显示。前端 report 的 `TranscriptRiskSection` 会显示 raw/proposed snippets、risk/reason label 和“只能修正系统听错，不要新增答案内容”的边界提醒。

目前没有可持久化的 interactive review action API；report UI 只显示 review evidence，还不能真正执行 `Accept correction`、`Keep raw` 或 `Clarify what I said`。也没有宣称 live Azure/ElevenLabs production SLO 已验证。

## 代码怎么追

| 机制 | 源码入口 | 说明 |
| --- | --- | --- |
| 产品契约 | [voice behavior spec](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md) | 定义 state machine、confidence、counting、latency target |
| WebSocket transport | [duplex voice socket](../../backend/src/api/duplexVoiceSocket.js) | 认证、session load、JSON/binary audio event routing |
| Voice agent session | [duplex voice agent service](../../backend/src/services/voice/duplexVoiceAgentService.js) | STT session、barge-in、turn coordinator、TTS streaming |
| Turn coordination | [duplex turn coordinator](../../backend/src/services/voice/duplexTurnCoordinator.js) | transcript gate、pending confirmation、adaptive turn |
| Confidence gate | [speech confidence gate](../../backend/src/services/voice/speechConfidenceGate.js) | accepted、rejected、needs confirmation |
| Transcript calibration | [phrase hint service](../../backend/src/services/voice/speechPhraseHintService.js)、[calibration service](../../backend/src/services/voice/transcriptCalibrationService.js) | dynamic glossary、phrase hints、static normalization metadata、bounded N-best rerank |
| Transcript review policy | [review policy service](../../backend/src/services/voice/transcriptReviewPolicyService.js) | auto/deferred/immediate/reject 分类、scoring policy、evidence boundary |
| Report transcript risk | [report transcript risk service](../../backend/src/services/report/reportTranscriptRiskService.js)、[turn dataset](../../backend/src/services/report/reportTurnDatasetService.js)、[report UI](../../frontend/src/components/report/TranscriptRiskSection.jsx) | deferred review visible in report；unconfirmed high-risk transcript 不进入 scoring |
| Frontend hook | [voice session hook](../../frontend/src/hooks/useVoiceInterviewSession.js) | UI-facing state、VAD、socket、audio queue |
| Role-Fit latency marker | [turn orchestrator](../../backend/src/services/questions/interviewTurnOrchestratorService.js) | 预计算 metadata 在既有 ranker 中使用；记录 `roleFitQuestionRankingMs`，不新增 fetch 或 model lane |

## 怎么检查

mock-safe tests 在 `backend/tests/robustness/voice`、`backend/tests/integration/voice`、`backend/tests/robustness/questions/interviewTurnOrchestratorService.test.js` 和 frontend voice hook tests。Transcript calibration 的 guardrail cases 在 `backend/tests/robustness/voice/voiceTranscriptCalibrationService.test.js`；transcript review policy 的 guardrail cases 在 `backend/tests/robustness/voice/transcriptReviewPolicyService.test.js`、`backend/tests/robustness/voice/duplexTurnCoordinator.transcriptConfirmation.test.js`、`backend/tests/robustness/report/transcriptReviewRiskRobustness.test.js` 和 frontend `TranscriptRiskSection` component test。Targeted real LLM policy judge 可用 `backend` 目录下的 `npm run eval:voice-transcript-review-policy` 运行。Role-Fit 保持 confirmation/counting/no-hint 与 single-blocking-LLM policy；Live provider E2E 只能在 Azure/ElevenLabs credentials、browser mic 和 authenticated session 都明确时运行。

继续读 [duplex voice agent](agent-duplex-voice.md)，看 WebSocket conversation 如何拥有一次 voice turn。

证据状态：除特别标注外，本页基于当前源码已确认。
