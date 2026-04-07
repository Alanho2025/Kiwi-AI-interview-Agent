# Schema Gap Map

| Area | Target schema / capability | Current status | Notes |
|---|---|---:|---|
| JD rubric | `macroCriteria`, `microCriteria`, `requirements`, `weights` | Done | Implemented in the v3 rubric flow |
| Analysis output | `macroScores`, `microScores`, `requirementChecks`, `decision`, `confidence`, `explanation` | Done | Used by matching and session persistence |
| Explanation object | `strengths`, `gaps`, `risks`, `summary` | Done | Standardized in analysis output |
| Analyze validation | strict validator | Done | `schemaValidationService.js` |
| Interview plan validation | strict validator | Done | `schemaValidationService.js` |
| Report output validation | strict validator | Done | `schemaValidationService.js` |
| Report QA validation | strict validator | Done | `schemaValidationService.js` |
| Benchmark normalization | normalized files for all dataset cases | Done | 1031 cases already transformed |
| Benchmark DB import | profiles, rubrics, ground truth, chunks, benchmark cases | Done in code | Requires live Mongo connection to execute |
| Session artifact indexing | CV profile, JD rubric, plan, transcript | Done in code | Triggered through RAG indexing service |
| Retrieval service | query chunks with score fusion | Done | semantic + keyword + metadata boost |
| Master orchestration | runtime task routing | Partial but usable | Added for interview next-turn and report tasks |
| Interviewer agent | only handles interviewer task | Done for current flow | Retrieval and question selection split |
| Report generator agent | generate report artifact | Done | Stored in `SessionReport` and `SessionAnalysis.reportArtifacts` |
| Report QA agent | QA report against evidence | Done | Produces coverage and quality flags |
| Report API | generate, QA, fetch | Done | Backend routes added |
| RAG utility API | import benchmark, rebuild session index, retrieve | Done | Backend routes added |
| Frontend report consumption | report page and API | Done | Added `/report/:sessionId` |
| Frontend deep report UX | rich review UI | Partial | Functional but still simple |
| Live retrieval benchmarking UI | visible benchmark dashboard | Pending | Not implemented in this round |
| Actual live embedding provider | external embedding model | Pending by design | Current implementation uses deterministic local embeddings |
