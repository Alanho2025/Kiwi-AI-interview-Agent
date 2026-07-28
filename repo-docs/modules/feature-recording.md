# Voice recording

recording 路径保存整段面试音频，但它不应该阻塞 live STT 或下一题生成。产品规则是：报告导航等待本地最后一块录音 durable，不等待远端上传或 MP3 conversion 完成。

## 读者应该先记住什么

前端先用 IndexedDB 保存 chunk，再用 upload manager 做低优先级、single-flight、可恢复上传；初始化 API 离线时也不能阻止本地保存。恢复时 manager 会读取 backend `receivedChunks`，把与远端已确认 sequence 重叠的 local pending chunks 重新编号后再上传。后端用 manifest、sequence、checksum、idempotent chunk storage 和 conversion worker 处理最终 MP3。

## 一个代表 case

```text
输入: MediaRecorder 产生 audio/webm chunks
动作: IndexedDB enqueue -> initialize/status sync -> pending sequence rebase -> PUT chunk -> finalize -> worker converts MP3
输出: report page 显示 uploading/processing/ready/retryable failure
边界: 关闭原浏览器 profile 会延迟恢复；远端已接收的 sequence 不可用不同 checksum 覆盖
```

## 代码怎么追

| 层 | 源码入口 | 说明 |
| --- | --- | --- |
| Backend routes | [recording routes](../../backend/src/api/routes/recordingRoutes.js) | file type、chunk size、session-audio endpoints |
| Controller | [recording controller](../../backend/src/controllers/recordingController.js) | initialize、chunk upload、finalize、retry、status、download |
| Upload service | [recording upload service](../../backend/src/services/recording/recordingUploadService.js) | ownership、idempotency、checksum、missing chunk handling |
| Worker | [recording conversion worker](../../backend/src/services/recording/recordingConversionWorker.js) | async MP3 conversion；start helper 回傳可停止 instance，shutdown 時會等 active conversion 完成 |
| Frontend runtime | [recording upload manager](../../frontend/src/runtime/recording/recordingUploadManager.js) | background upload/recovery |
| Recorder hook | [session audio recorder](../../frontend/src/hooks/voice/useSessionAudioRecorder.js) | voice session recording lifecycle |

## 怎么检查

后端重点测试在 `backend/tests/robustness/recording`，前端 runtime tests 在 `frontend/src/runtime/recording/__tests__`；其中 `recordingUploadManager.test.js` 覆盖 API 初始化離線時仍保留 chunk，以及 remote sequence 衝突時的 rebase。Worker lifecycle test 也確認 `stop()` 不會在 active conversion 結束前提早 resolve。瀏覽器恢復路徑由 `frontend/e2e/recording-recovery.playwright.mjs` 覆蓋，但 H1 首次失敗後的真人 browser profile recovery 仍待重跑。

继续读 [数据持久化与保留](data-persistence-retention.md)，看 recording 与 PostgreSQL、MongoDB、local files 的关系。

证据状态：除特别标注外，本页基于当前源码已确认。
