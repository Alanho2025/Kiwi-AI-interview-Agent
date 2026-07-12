# Version History

## 2026-07-12 - E2E Refine Backend Gate

- Added interview-plan match usability guard so `manual_review` match analyses cannot be used to create a normal interview session.
- Added E2E refine release gate evaluator and runner for review-lock, retention/deletion, low-confidence voice, and weak-network/barge-in artifacts.
- Updated duplex voice WebSocket handling so interrupt control messages bypass the regular serialized queue and can stop active assistant speech during streaming.
- Added robustness coverage for the interrupt queue behavior.

## 2026-06-23 - Current Backend Alignment

- Added question novelty preparation/runtime guards and safe duplicate exhaustion.
- Added accepted-answer report datasets, question assessment contracts, deterministic scores, report evidence rows, transcript-risk checks, and stricter QA.
- Added at-most-two-attempt grounded report repair with version and repair-history persistence.
- Added resumable recording manifests/chunks, retry/finalize/status routes, durable worker conversion, and repository/schema coverage.
- Confirmed Azure-first STT/TTS routing with independently configured ElevenLabs fallback.
- Clarified that `npm run test:all` selects the package-script groups rather than every unit, retention, and interview test file.

## Current Backend Gap Closure
- Fixed backend safeguard test scripts so `npm run test:jd-safeguard` and `npm run test:match-safeguard` point to existing robustness tests.
- Confirmed `npm run eval:seek` runs the 10-case SEEK JD benchmark from `eval/datasets/jd-parse-seek-benchmark.json`.
- Added CV parse confidence and warning fields to recent and selected CV responses so frontend human review can evaluate parser quality before matching.
- Preserved blocked JD behavior for unreviewed JD rubrics while allowing human-reviewed blocked JD rubrics to proceed through normal CV-JD matching.
- Added recording upload type validation for browser audio files before ffmpeg conversion.
- Added recording upload guard robustness coverage.
- Upgraded local deterministic retrieval embeddings to 256-dimensional weighted hash embeddings with token, n-gram, character n-gram, signed hashing, and estimated IDF weighting.
- Added match analysis and controller decision payloads to session RAG indexing.
- Kept Mongo document chunks as a legacy mirror while runtime retrieval uses PostgreSQL pgvector.
- Added PostgreSQL duplicate cleanup for `document_chunks`.
- Added source/session/chunk/text uniqueness for idempotent RAG indexing.
- Added source/session and metadata `sourceId` indexes for retrieval filtering.
- Added pgvector ANN indexing with HNSW and IVFFlat fallback.
- Added retrieval robustness tests for embedding behavior and RAG index payloads.
- Latest validation: backend `npm run lint`, `npm run test:all`, `npm run test:jd-safeguard`, `npm run test:match-safeguard`, and `npm run eval:seek` pass.

## JD Parser Phase 2
- Added normalized bluepoint output for responsibilities, requirements, benefits, and application instructions.
- Added raw section preservation under `rawSections` so original JD evidence is still available.
- Added `evidenceMap` to link normalized points back to source text.
- Added bluepoint normalizers for responsibilities, requirements, benefits, soft skills, and application instructions.
- Updated rubric builder to return `sections` as normalized points and `normalized` as a mirrored structured view.
- Updated schema validator to preserve `rawSections`, `normalized`, and `evidenceMap`.
- Added normalization-focused tests and updated JD section tests to reflect bluepoint output.


## JD parser phase 3
- Fixed downstream JD contract builder to preserve normalized preferred skills and raw preferred evidence together.
- Added candidate ranking tests for header tokenization and labeled company extraction.
- Expanded metamorphic stability coverage with lowercase paragraph and reordered variants.
- Expanded adversarial coverage to ensure marketing noise stays out of company and skill extraction.
## JD Parser Phase 4
- Fixed malformed newline escaping in `tests/jobDescription/jobDescriptionMetamorphic.test.js` so Vitest and Vite import analysis can parse the file correctly.
- Preserved Phase 3 contract compatibility changes while keeping metamorphic stability coverage for lowercase paragraph and reordered variants.
