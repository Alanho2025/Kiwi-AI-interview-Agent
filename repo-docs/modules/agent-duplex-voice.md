# Duplex voice agent

duplex voice agent 拥有一条 WebSocket conversation：它启动 STT session，接收音频，处理 barge-in，合并 transcript segments，把 final transcript 交给 turn coordinator，再把 assistant speech 通过 TTS stream 回前端。

## 它在哪里被调用

WebSocket server 在 [duplex voice socket](../../backend/src/api/duplexVoiceSocket.js) 加载 [duplex voice agent service](../../backend/src/services/voice/duplexVoiceAgentService.js)，并为每个连接创建 voice agent session。

## 一个代表 case

```text
输入: session_start -> speech_start -> binary PCM chunks -> speech_end
动作: createRoutedRealtimeSpeechSession -> collect final transcript -> createDuplexTurnCoordinator -> streamAssistantSpeech
输出: stt_partial/stt_final/tts chunks/turn_done/session_ready events
边界: speech_start 前的 audio chunks 会被忽略或缓冲受限；pending confirmation 会改变下一步处理
```

## 它做什么决策

它主要做 runtime orchestration：选择 STT provider session、维护 active capture id、估算 audio duration、处理 provider events、控制 barge-in 和 pending transcript confirmation。具体下一问仍交给 turn coordinator 和 interview controller。

## 输出和持久化

它通过 socket 发 JSON/binary events，并通过 coordinator 触发 transcript save、adaptive turn、agent trace events。它记录的 tool name 来自 [agent tool names](../../backend/src/constants/agentToolNames.js)。

## 怎么检查

相关 tests 在 `backend/tests/integration/voice/duplexVoiceSocket.integration.test.js` 和 `backend/tests/robustness/voice/duplexVoiceRobustness.test.js`。

继续读 [voice interview](feature-voice-interview.md) 或 [voice decision fast path](agent-voice-decision-fast-path.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

