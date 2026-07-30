# Voice Clarification and Candidate Report Integrity Evidence Matrix

狀態：Local automated verification complete；audit findings remediated；follow-up audit 由 owner 明確免除  
日期：2026-07-30 Pacific/Auckland  
Goal：[Voice Clarification and Candidate Report Integrity Goal](voice-clarification-report-integrity-goal.md)  
Spec：[Voice Clarification and Candidate Report Integrity Spec](voice-clarification-report-integrity-spec.md)

> **實作狀態 (Implementation Status)**：Implemented locally
>
> **校驗測試路徑 (Verified by Tests)**：Rows below record fresh 2026-07-30 task evidence. Human/live/production evidence remains explicitly separate.

| ID | Requirement | Real entry and data flow | Positive proof | Negative/adversarial proof | Human/external proof | Status |
| --- | --- | --- | --- | --- | --- | --- |
| E-01 | Match-gap questions never speak internal rationale | question pool composer -> micro-planner -> interviewer/TTS | question composer + micro-planner focused tests passed | raw gap、forbidden preamble、model failure fallback covered | Human listening not run | PASS (automated) |
| E-02 | Deterministic classifier covers natural clarification families | realtime/duplex transcript -> scope clarification service | 14 required intent families、reported transcript and 48-case paraphrase holdout covered | 44-case substantive-answer corpus includes clarification-like and mixed-turn vocabulary；0 false positives | Human microphone not run；corpus is reviewed local evidence, not a claim of unlimited language understanding | PASS (100% local holdout recall；0% local FPR) |
| E-03 | Clarification is same-root and non-score | classifier -> request metadata -> scope controller -> transcript | controller + realtime voice persistence tests passed | repeated/general help、missing-root recovery、third-help skip and substantive-answer negatives covered | Browser voice flow not run | PASS (automated) |
| E-04 | Clarification never creates formal response or evaluator work | realtime/duplex voice service -> response repository -> task runner | realtime voice spies prove no formal answer persistence and repair lane selection | exact reported transcript、missing active root and no-prepared-scope fallback covered | Harness manual timeline review not run | PASS (automated) |
| E-05 | Report uses one accepted-answer dataset | report turn dataset -> metrics -> breakdown/score | existing report dataset/full report robustness group passed | legacy clarification receives visible limitation without transcript rewrite | Candidate Product Owner review pending | PASS (automated) |
| E-06 | Shared candidate report is concise | ReportPage -> candidate summary/coaching/turn/rewrite components | candidate surface component tests + full frontend suite passed | Commercial Stress、Evidence Sources、reflection form、QA controls and duplicate sections absent | Desktop/mobile visual review not run | PASS (automated) |
| E-07 | Developer diagnostics is non-production and owner-scoped | toggle -> separate API -> diagnostics controller -> owned session | lazy fetch/component、selection/match-gap refs、harness timelines and owner-scope controller tests passed | production deny and PII masking tests passed | Local authenticated browser not run | PASS (automated) |
| E-08 | Candidate projection/export removes internal fields and PII | report controllers -> projection -> JSON/TXT/PDF | projection、QA rewrite、TXT、frontend helper、PDF tests passed | Role-Fit/unavailable noise、nested email/phone/street address、cost/token、QA/evidence/trace sentinels covered | PDF visual/search review not run | PASS (automated) |
| E-09 | Legacy reports show an honest limitation | report read -> legacy assessment -> view model | projection and view-model legacy fixtures passed | raw legacy transcript unchanged；candidate sees regenerate warning | Product Owner review pending | PASS (automated) |
| E-10 | Text interview runtime remains unchanged | text route remains outside voice classifier; shared report projection is mode-agnostic | backend complete robustness groups and HTTP route integration passed | no text turn service/controller was changed for clarification | None | PASS (source + regression) |
| E-11 | Voice latency target remains observable | speech end -> deterministic clarification -> same-root response | no new LLM/network dependency; voice robustness and duplex integration passed | classifier/fallback are synchronous bounded policies | Live provider/microphone latency not run | PASS (architecture); HUMAN REQUIRED for production latency |
| E-12 | Documentation matches shipped behavior | changed source -> Feature RFCs -> repo-docs/change log | auto-docs sync and repo-docs validator | planned/runtime status corrected; external gates remain labeled unverified | Initial independent audit findings remediated；owner waived follow-up audit | PASS (automated docs gate) |

## Fresh verification record

- Backend focused VCRI slice：11 files / 82 tests passed.
- Backend full suite：3 integration files / 4 tests，加上 14 robustness groups；合計 810 tests passed.
- Backend lint：passed.
- Post-audit remediation focused slice：5 files / 56 tests passed；涵蓋 48-case clarification holdout、unsafe legacy skip、DB latest-question context 和 missing-root substantive speech。
- Frontend focused VCRI slice：5 files / 15 tests passed.
- Frontend `npm run quality:all`：63 test files / 335 tests passed；ESLint passed；Vite production build passed.
- `git diff --check`：passed before docs sync；final rerun required after docs edits.
- No real AI/provider eval、browser microphone/listening、desktop/mobile visual review、PDF manual inspection、production deployment or production diagnostics test was run.

## Approved scope clarification

- Voice clarification and question delivery changes are voice-only.
- Candidate report simplification is shared across voice and text reports.
- Text interview turn behavior remains out of scope.
- Developer diagnostics remains non-production only.
- No dependency install、schema migration、production deployment、git push or paid provider eval is authorized by this Goal.

## Completion rule

Every non-human row must be `PASS`. Human/live rows may remain `HUMAN REQUIRED` or `NOT RUN`, but their absence must remain explicit and cannot be replaced by local tests. An independent audit found three blocking edge cases; all three received regression fixes. The owner explicitly waived a follow-up subagent audit after focused tests passed.
