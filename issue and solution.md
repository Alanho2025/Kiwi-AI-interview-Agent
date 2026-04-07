# Issue and Solution

## 1. The project still lacked a real RAG retrieval layer
### Issue
Earlier work produced normalized dataset files and chunk records, but the runtime project still did not have a clean retrieval service for session artifacts and benchmark chunks.

### Solution
Added:
- `embeddingService.js`
- `ragRetrievalService.js`
- `ragIndexService.js`

Result:
- session artifacts can now be indexed
- chunk retrieval can now be tested with hybrid score fusion
- the benchmark dataset can support RAG retrieval experiments more directly

---

## 2. The normalized dataset was not fully imported into DB-ready collections
### Issue
The previous import script only covered chunk and benchmark collections. That was not enough if you wanted the dataset to support broader calibration and inspection.

### Solution
Expanded the import pipeline so it now imports:
- normalized CV profiles
- normalized JD rubrics
- normalized evaluation ground truth
- normalized chunks
- normalized benchmark cases

Added models:
- `NormalizedCvProfile`
- `NormalizedJdRubric`
- `EvaluationGroundTruth`

Result:
- the dataset now covers more than just chunk storage
- calibration data is easier to inspect and reuse

---

## 3. Interview flow still depended on a single generic generation path
### Issue
The interview reply flow still acted like one direct generation step. That did not fit the target architecture of master AI plus single-purpose agents.

### Solution
Added orchestration through:
- `masterAiService.js`
- `agentRegistryService.js`
- `retrievalAgent.js`
- `interviewerAgent.js`

Updated:
- `interviewController.js`

Result:
- reply handling now goes through task orchestration
- interviewer logic is separated from retrieval logic
- the code is easier to extend later

---

## 4. Report generation and QA were still missing as real features
### Issue
The project previously discussed report generation and report quality checking, but these did not exist as an actual backend flow.

### Solution
Added:
- `reportGeneratorAgent.js`
- `reportQaAgent.js`
- `SessionReport` model
- report controller and routes

Result:
- reports can now be generated for a session
- QA output can be stored and refreshed
- reporting is no longer just a future note in documentation

---

## 5. No RAG utility routes existed for runtime use
### Issue
Even with dataset normalization, there was still no practical API route to:
- import benchmark data
- rebuild a session index
- inspect retrieval output

### Solution
Added:
- `ragController.js`
- `ragRoutes.js`

Routes now support:
- benchmark import
- session re-index
- retrieval

Result:
- easier debugging
- easier retrieval inspection
- easier future benchmarking

---

## 6. Frontend had no path to consume reports
### Issue
The frontend still ended at analysis and interview. There was no report page or report API layer.

### Solution
Added:
- `frontend/src/api/reportApi.js`
- `frontend/src/pages/ReportPage.jsx`
- route wiring in `App.jsx`
- report entry point from `InterviewPage.jsx`

Result:
- the new backend report flow now has a frontend consumer
- report and QA output can be reviewed without manual DB inspection

---

## 7. Clean-code pressure increased as features expanded
### Issue
Phase 4 to 6 work could easily have turned into one large service file with mixed responsibilities.

### Solution
Kept responsibilities split across:
- indexing
- retrieval
- orchestration
- interview agent
- report generator
- report QA
- controllers
- routes

Result:
- lower duplication
- more maintainable code paths
- easier future replacement of retrieval or generation logic

---

## 8. What remains runtime-dependent
### Issue
Some steps still depend on environment setup and cannot be guaranteed just from code changes alone.

### Solution
The code is now prepared, but these still depend on runtime:
- Mongo connection availability
- actual session data existing before session indexing
- dependency installation for frontend build
- environment-specific PDF parsing compatibility

Result:
- the implementation is materially further along
- remaining blockers are environment/runtime issues, not missing architecture pieces
