# 数据持久化与 retention

项目使用 PostgreSQL、MongoDB、local file storage 和 browser IndexedDB。理解数据层时要分清：业务状态、AI artifacts、文件/录音、浏览器本地队列和保留清理是不同责任。

## 一个代表 case

```text
输入: voice session recording chunks
动作: browser IndexedDB durable queue -> backend recording_uploads/chunks -> local file storage -> conversion worker
输出: report page recording status 和可下载 MP3
边界: report ready 不代表 MP3 ready；retention cleanup 不等于 account-wide deletion guarantee
```

## 数据家族

| 数据 | 主要位置 | 用途 |
| --- | --- | --- |
| Users/sessions/files/responses | [Postgres schema](../../backend/src/config/postgresSchemaStatements.js) | ownership、session lifecycle、uploads、responses、recording uploads |
| AI artifacts | [Mongo models](../../backend/src/db/models) | session analysis、reports、question pool、usage events、coaching memory |
| Document content | [document repository](../../backend/src/repositories/documentRepository.js) | raw/normalized/redacted text |
| RAG chunks | [document_chunks schema](../../backend/src/config/postgresSchemaStatements.js) | retrieval index |
| Recording chunks | [recording repository](../../backend/src/repositories/recordingUploadRepository.js) | resumable upload manifest |
| Browser queue | [IndexedDB chunk store](../../frontend/src/runtime/recording/indexedDbRecordingChunkStore.js) | 本地 durable chunk recovery |
| Retention | [retention services](../../backend/src/services/retention) | audit、dry run、backup/quarantine、cleanup、worker |

Role-Fit 的 Company profile、match record、interview plan、prepared question、session analysis 和 report 都以 user/session/match ID 維持 ownership，敏感 Mongo artifacts 使用 `retentionUntil`、`deletedAt`、`containsSensitiveData`、`accessScope=private`，並已在 `mongoRetentionModelRegistry` 登記。寫入 Company Role-Fit draft/review 或 report 時沿用既有 7-day policy 更新 retention，不另造期限。Role-Fit release gate 目前只宣稱 local source/model/registry contract passed；它明確標記 `productionTelemetryAvailable=false`，不把本地 contract 冒充成 production 14-day telemetry。

## 保守边界

当前 schema 有 `is_encrypted`、virus scan status、retention fields、audit logs 和 deletion requests，但不能把它们写成完整合规保证。是否启用 worker、如何部署存储、是否完成 account-wide deletion、是否有 encryption-at-rest enforcement，都需要独立验证。pre-cutover evidence/question/report readers 也必须等 production retention/resume gate 后才可删除，不能提前清掉仍可访问的用户资料。

继续读 [验证与保护层](validations-and-guards.md)，看数据访问如何先经过 auth、ownership 和 route guards。

证据状态：除特别标注外，本页基于当前源码已确认。
