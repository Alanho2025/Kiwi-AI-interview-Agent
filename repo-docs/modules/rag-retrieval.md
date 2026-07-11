# 当前 RAG 检索层

当前 RAG 是一个 MVP retrieval layer。它把 session artifacts 和 global question banks 写入 PostgreSQL `document_chunks`，用 deterministic 256 维 weighted hash embedding 配合 pgvector、keyword overlap 和 metadata boost 返回 evidence bundle。

## 读者应该先记住什么

这里的 embedding model 是 `weighted_hash_ngram_v2`，不是外部 semantic embedding provider。它对本地、可重复、mock-safe 检索实验有用，但不能被描述成 production-grade semantic retrieval。

## 一个代表 case

```text
输入: session analysis、plan、transcript、prepared question pool
动作: splitTextIntoChunks -> embedBatch -> INSERT document_chunks
查询: embedText(query) -> pgvector top 100 -> semantic/keyword/metadata fusion
输出: topK items + scores + source metadata
边界: low quality/no result 会触发 quality assessor 和 corrective retry
```

## 代码怎么追

| 机制 | 源码入口 | 说明 |
| --- | --- | --- |
| Indexing | [RAG index service](../../backend/src/services/ragIndexService.js) | 构建 CV/JD/match/decision/plan/pool/transcript index payload |
| Embedding | [embedding service](../../backend/src/services/embeddingService.js) | `EMBEDDING_DIMENSION = 256`，`EMBEDDING_MODEL = weighted_hash_ngram_v2` |
| Storage schema | [Postgres schema](../../backend/src/config/postgresSchemaStatements.js) | `document_chunks`、`embedding vector(256)`、HNSW/IVFFLAT index |
| Retrieval | [RAG retrieval service](../../backend/src/services/ragRetrievalService.js) | semantic、keyword、metadata fusion score |
| Retrieval agent | [retrieval agent](../../backend/src/services/agents/retrievalAgent.js) | source selection、session/global split、quality assessment、retry |
| Source policy | [source selector](../../backend/src/services/retrieval/retrievalSourceSelector.js) | 不同 objective 选择不同 sourceTypes |

## Fusion score 怎么理解

| 分数 | 来源 | 当前权重 |
| --- | --- | --- |
| semantic | pgvector cosine similarity | 0.55 |
| keyword | query token overlap | 0.35 |
| metadata | session/source boost | 0.10 |

## 怎么检查

相关 tests 在 `backend/tests/robustness/retrieval`。`npm run eval:retrieval` 会让 synthetic corpus 走与 PostgreSQL runtime 共用的 `rankRetrievalCandidates`，输出 precision@K、recall@K、MRR、nDCG、forbidden rate、source policy 和 claim grounding；旧 phrase fixture 已改为 `npm run eval:retrieval-safety`。

当前 latest runtime 报告是 5 个 retrieval + 5 个 grounding cases，local average 1.00。Role-Fit v2 另有 12-case mock-safe adversarial gate；human calibration dataset 已完成 12/12 人工校準，Release Threshold 設為 0.85 且狀態解鎖為 calibrated。這些只證明簡化的本地 deterministic contracts，不代表 production semantic retrieval 或真實 AI 評測。如果以後接入真實 embedding model，需要更新 schema/embedding contract、config fingerprint、eval baseline 和本頁 caveat。

继续读 [retrieval agent](agent-retrieval.md)，看 objective 如何决定取哪些 evidence。

证据状态：除特别标注外，本页基于当前源码已确认。
