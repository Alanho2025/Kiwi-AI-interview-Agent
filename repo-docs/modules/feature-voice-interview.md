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

## 代码怎么追

| 机制 | 源码入口 | 说明 |
| --- | --- | --- |
| 产品契约 | [voice behavior spec](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md) | 定义 state machine、confidence、counting、latency target |
| WebSocket transport | [duplex voice socket](../../backend/src/api/duplexVoiceSocket.js) | 认证、session load、JSON/binary audio event routing |
| Voice agent session | [duplex voice agent service](../../backend/src/services/voice/duplexVoiceAgentService.js) | STT session、barge-in、turn coordinator、TTS streaming |
| Turn coordination | [duplex turn coordinator](../../backend/src/services/voice/duplexTurnCoordinator.js) | transcript gate、pending confirmation、adaptive turn |
| Confidence gate | [speech confidence gate](../../backend/src/services/voice/speechConfidenceGate.js) | accepted、rejected、needs confirmation |
| Frontend hook | [voice session hook](../../frontend/src/hooks/useVoiceInterviewSession.js) | UI-facing state、VAD、socket、audio queue |
| Role-Fit latency marker | [turn orchestrator](../../backend/src/services/questions/interviewTurnOrchestratorService.js) | 预计算 metadata 在既有 ranker 中使用；记录 `roleFitQuestionRankingMs`，不新增 fetch 或 model lane |

## 怎么检查

mock-safe tests 在 `backend/tests/robustness/voice`、`backend/tests/integration/voice`、`backend/tests/robustness/questions/interviewTurnOrchestratorService.test.js` 和 frontend voice hook tests。Role-Fit 保持 confirmation/counting/no-hint 与 single-blocking-LLM policy；Live provider E2E 只能在 Azure/ElevenLabs credentials、browser mic 和 authenticated session 都明确时运行。

继续读 [duplex voice agent](agent-duplex-voice.md)，看 WebSocket conversation 如何拥有一次 voice turn。

证据状态：除特别标注外，本页基于当前源码已确认。
