# 验证与保护层

这个项目的安全感来自很多小门，而不是一个总开关。验证层覆盖 HTTP auth、CSRF、rate limit、body field、file/audio type、schema normalization、human review gates、agentic safeguards、question dedupe、voice confidence、report QA、recording idempotency 和 retention/privacy caveat。

## 一个代表 case

```text
输入: 用户请求生成报告 sessionId
动作: require auth -> require body field -> getOwnedSessionById -> runTask(generate_report)
输出: report 或 access denied/not found
边界: 不能只凭 sessionId 存在就允许读取或导出报告
```

## 验证分类

| 类别 | 源码入口 | 保护什么 |
| --- | --- | --- |
| Auth | [auth middleware](../../backend/src/middleware/authMiddleware.js) | cookie/Bearer token 转成 `req.user` |
| CSRF | [CSRF middleware](../../backend/src/middleware/csrfMiddleware.js) | cookie-auth unsafe request 需要 double-submit token |
| Rate limit | [rate limit middleware](../../backend/src/middleware/rateLimitMiddleware.js) | auth/upload/AI/export route abuse |
| WebSocket security | [WebSocket security helpers](../../backend/src/api/webSocketSecurity.js) | socket cookie auth、origin、upgrade limit |
| Body field | [controller helpers](../../backend/src/utils/controllerHelpers.js) | 缺少必需字段时给一致错误 |
| Schema normalization | [schema validation service](../../backend/src/services/schemaValidationService.js) | report、analysis、prepared question pool 输出形状 |
| Human review gates | [Analyze page](../../frontend/src/pages/AnalyzePage.jsx) | CV/JD 进入 match 前的用户确认 |
| Role-fit review ownership | [company values repository](../../backend/src/services/company/companyValuesRepository.js) 和 [CV analysis service](../../backend/src/services/cv/cvAnalysisService.js) | owner-scoped persisted review、profile identity、optimistic version 与 stale 409；缺少 Role-Fit 的新 match 直接 400，client-only legacy marker 無效 |
| Evidence source trace | [CV evidence builder](../../backend/src/services/cv/cvEvidenceProfileBuilder.js) 和 [Role Evidence Map](../../backend/src/services/match/roleEvidenceMapService.js) | 没有 stable evidence ID、section、source type、chunk 的结果不能宣称 direct/adjacent |
| JD/match safeguards | [JD safeguard](../../backend/src/services/jobDescription/guardedJobDescriptionService.js), [match safeguard](../../backend/src/services/match/guardedMatchService.js) | critic/gate/reparse/recompare |
| Question dedupe/counting | [question dedupe service](../../backend/src/services/questions/questionDeduplicationService.js) | 避免重复 assessment-equivalent root questions |
| Voice transcript gate | [speech confidence gate](../../backend/src/services/voice/speechConfidenceGate.js) | rejected/confirmation/accepted transcript |
| Report QA | [report QA agent](../../backend/src/services/agents/reportQaAgent.js) | blocking flags、visible risks、score consistency |
| Recording idempotency | [recording upload service](../../backend/src/services/recording/recordingUploadService.js) | chunk sequence、checksum、missing chunk、ownership |

## 仍要保守表达的地方

隐私和 compliance copy 不能写成已完全满足。Role-fit review 与 match 已加入 owner/version gate，CV evidence profile 标记为 private；当前代码也有 auth、CSRF、rate limits、audit logs、redaction helpers 和 retention pipeline，但 account-wide deletion、encryption-at-rest guarantees、route-complete ownership tests 和 deployment policy 仍是 hardening area。

继续读 [测试与 eval 版图](testing-and-evaluation.md)，看哪些 guards 已被自动测试。

证据状态：除特别标注外，本页基于当前源码已确认。
