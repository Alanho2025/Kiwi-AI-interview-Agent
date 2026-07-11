# Research Report: High-Speed, High-Accuracy CV-JD Matching Architectures

This document analyzes the current CV-JD matching architecture within the Kiwi AI Interview Agent and explores industry-standard methodologies to optimize matching latency while maintaining high precision.

---

## 1. Current Architecture Analysis

The Kiwi AI Agent implements a semantic-focused scoring engine to match candidate resumes (CVs) with parsed job descriptions (JDs). Under the hood, this process is sequential:

```
[CV Document] ---> (Local Text / Profile Parse) 
                                                \
                                                 ---> [compareCvToJobDescription] ---> [Output Match Result]
                                                /
[Raw JD / URL] -> (paraphraseJD / Rubric Parse) 
```

### Sequential Bottlenecks
When the semantic match engine is enabled (`MATCH_ENGINE=semantic`), the pipeline runs two consecutive DeepSeek LLM tasks:
1. **Universal Job Profile Parsing (`buildUniversalRoleProfile`)**: DeepSeek parses the raw JD to extract requirements, industry domain, assessment focus, etc.
2. **Evidence Judging (`judgeRequirementEvidenceBatch`)**: DeepSeek evaluates candidate evidence retrieved from the CV against each parsed JD requirement.

Because these tasks run sequentially, the total latency is the sum of both LLM API response times plus any network transport overhead ($T_{total} = T_{parse\_llm} + T_{judge\_llm} \approx 6s - 15s$).

---

## 2. Industry-Standard Paradigms (Speed & Accuracy)

Modern industrial applicant tracking systems (ATS) and talent matching systems utilize multi-stage hybrid architectures to deliver sub-second responses with LLM-level precision.

### Paradigm A: Two-Stage Retrieval (Bi-Encoder + Cross-Encoder)
- **Stage 1 (Retrieval - Bi-Encoder)**: 
  - Converts JDs and CVs independently into dense vector representations (embeddings) using models like `sentence-transformers` or `BGE`.
  - Performs vector cosine similarity calculations locally. 
  - **Latency**: $<10\text{ms}$.
  - **Limitation**: Ignores fine-grained logical matches (e.g., negative statements, complex multi-experience constraints).
- **Stage 2 (Re-ranking - Cross-Encoder / LLM)**:
  - Takes the top $N$ candidates or top $K$ ambiguous requirements and feeds them into a full cross-attention transformer (or LLM) to get the final score.
  - **Latency**: $1\text{s} - 3\text{s}$.
  - **Benefit**: Ensures 95%+ precision on the final cohort.

### Paradigm B: Hybrid Search (Lexical BM25 + Dense Vectors)
- Combines keyword search (BM25) for strict technical requirements (e.g., "Python", "Kubernetes") with semantic vector similarity for responsibilities and leadership context.
- Merges ranks using **Reciprocal Rank Fusion (RRF)**.
- Highly effective at blocking candidates who lack hard technical constraints before wasting computing budget on semantic evaluation.

---

## 3. Recommended Optimization Strategies for Kiwi AI Agent

To significantly speed up matching in the Kiwi system without sacrificing accuracy, we can implement the following strategies:

### Strategy 1: Local Embedding-Based LLM Bypass (Dynamic Routing)
Using the local HuggingFace embedding engine already configured in the system (`HF_EMBEDDING_MODEL=BAAI/bge-large-en-v1.5`), we can bypass LLM evaluation for clearly matched or unmatched requirements:

1. **Calculate Cosine Similarity**: For each requirement, compute the cosine similarity between the requirement text and the candidate's CV sentence embeddings.
2. **Dynamic Routing**:
   - **Similarity $\ge 0.82$**: Mark as **Met (Strong)** automatically. (Bypass LLM)
   - **Similarity $\le 0.45$**: Mark as **Unmet (Missing)** automatically. (Bypass LLM)
   - **Similarity between $0.46$ and $0.81$**: Forward only these ambiguous items to the LLM (`evidenceJudgeService`) to perform the final reasoning.
3. **Speedup**: Cuts LLM token load and processing time by **60% - 80%** since only a fraction of requirements need LLM inspection.

```
                  [Requirement & CV Sentence Embeddings]
                                   |
                       [Compute Cosine Similarity]
                                   |
             ---------------------------------------------
            |                      |                      |
      Sim >= 0.82             0.45 < Sim < 0.82        Sim <= 0.45
            |                      |                      |
      [Auto-Approve]          [Route to LLM]         [Auto-Reject]
```

### Strategy 2: Parallel Request Pipeline
Instead of sequential operations, we can trigger concurrent operations using JavaScript's `Promise.all`:
- Parse the CV profile and load/parse the JD rubric concurrently.
- Fetch company background context in parallel with the matching engine initialization.

### Strategy 3: Persistent Embedding Caching
- Store CV sentence embeddings in the database (Mongoose/PostgreSQL) upon upload.
- Avoid re-calculating embeddings for the same CV across different match requests.
- Caching reduces prep time to almost zero milliseconds.

---

## 4. Academic and Industry References

1. **Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks**  
   *Reimers & Gurevych (2019)* - Describes Siamese network structures for fast semantic similarity search (Bi-Encoders), which forms the foundation of modern high-speed vector retrieval.
2. **Dense Passage Retrieval for Open-Domain Question Answering**  
   *Karpukhin et al. (2020)* - Shows how dual-encoders outperform classical BM25 and highlights how hybrid search preserves both keyword precision and semantic context.
3. **ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT**  
   *Khattab & Zaharia (2020)* - Proposes a late-interaction mechanism to balance cross-encoder precision with bi-encoder speed.
