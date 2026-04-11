# Clean Code Rules for Kiwi AI Interview Agent

This file is the mandatory rule set for every future code change.

## 1. Core Standard

A change is acceptable only when it keeps the code:
- easy to read
- easy to extend
- easy to test
- easy to review
- low-risk to modify later

The goal is not clever code. The goal is low change cost.

## 2. Duplication Rule

- Repeated structure or repeated logic must not appear more than 3 times.
- When a pattern appears for the 3rd time, extract it.
- Extraction options include:
  - helper
  - mapper
  - formatter
  - builder
  - shared component
  - shared service

Do not keep copy-paste variants with small text changes.

## 3. Single Responsibility Rule

### Function level
- One function should do one job.
- If a function both fetches, transforms, validates, and formats, split it.
- If a function name needs `and`, it is usually too broad.

### Module level
- One file should own one clear responsibility group.
- Do not mix:
  - persistence and formatting
  - business rules and HTTP response control
  - page orchestration and large display transformation logic

## 4. Boundary Rule

### Backend
- route: route registration only
- controller: request and response orchestration only
- service: business logic only
- repository or model access layer: persistence only
- utility: pure reusable helper logic only

### Frontend
- page: page orchestration and layout composition
- section component: section-level rendering
- reusable component: display reuse only
- formatter or builder: display data transformation only
- api layer: network calls only

Do not cross boundaries unless there is a strong reason.

## 5. Naming Rule

Names must show intent.

Good examples:
- `buildInterviewQuestionPlan`
- `mapSessionHistoryItem`
- `formatReportScoreBand`
- `persistSessionTranscript`

Bad examples:
- `handleData`
- `processThing`
- `doReport`
- `fixInfo`

## 6. Predictable Data Flow Rule

- Input shape should be clear.
- Output shape should be clear.
- Side effects should be obvious.
- Avoid hidden mutation.
- Avoid functions that silently depend on unrelated external state.

Prefer:
- mapper for shape conversion
- formatter for text or display conversion
- builder for higher-level view model assembly
- factory for domain object creation

## 7. Change-Friendly Design Rule

When adding a feature, prefer adding a new module over modifying a large old module.

Target pattern:
- new feature = new route/controller/service/component/helper
- not new feature = keep stuffing logic into one existing big file

A good change should affect the fewest files possible.

## 8. Readability First Rule

Readable code beats clever code.

- prefer direct logic
- avoid dense nesting when a guard clause works
- avoid mixing high-level strategy and low-level string cleanup in the same function
- keep abstraction level consistent inside one function

## 9. Error Handling Rule

Error handling must be consistent.

### Backend
- expected errors should use shared error classes or shared error pattern
- unexpected errors should bubble to the global handler
- do not mix `throw`, `return null`, `return { ok:false }`, and direct response sending for the same kind of failure without a reason

### Frontend
- loading state pattern should be consistent
- empty state pattern should be consistent
- error state pattern should be consistent

## 10. Testability Rule

Code should be structured so important logic can be tested in isolation.

Prefer extracting:
- pure functions
- builders
- formatters
- mappers
- narrow services

Avoid burying core logic inside:
- giant page components
- controller-only flows
- mixed persistence + formatting functions

## 11. Size Warning Rule

These are warning thresholds, not hard blockers. Hitting them means review is needed.

### Backend
- controller file: review when above 150 lines
- service file: review when above 200 lines
- function: review when above 40 lines

### Frontend
- page file: review when above 250 lines
- component file: review when above 180 lines
- hook or utility file: review when above 150 lines

If a file grows past the threshold, stop and check whether responsibility has started to blur.

## 12. Collaboration Rule

This project is built for multi-person work.

Every change should reduce these risks:
- merge conflict risk
- unclear ownership
- broad side effects
- hard-to-review diffs

Prefer:
- smaller focused files
- stable calling patterns
- clean shared utilities
- versioned delivery packages after each major safe change batch

## 13. Required Workflow for Future Changes

For every future feature or refactor:

1. Read this file first.
2. Read the relevant code area.
3. Identify duplication, boundary leaks, and oversized modules.
4. Make the largest safe batch of changes possible.
5. Produce a versioned zip package after each completed batch.
6. Do not wait until every phase is finished before packaging.

## 14. Packaging and Versioning Rule

Every delivered package must:
- use version naming
- exclude `.git`
- exclude `node_modules`
- exclude `.env`
- exclude build noise when possible

Version examples:
- `kiwi-clean-code-v1.0.0.zip`
- `kiwi-clean-code-v1.1.0.zip`
- `kiwi-clean-code-v1.2.0.zip`

## 15. Definition of Done for Clean Code in This Project

A code area is considered aligned with this standard when:
- duplication is controlled
- responsibilities are separated
- names are clear
- data flow is predictable
- changes are low-impact
- file size is reasonable
- future features can be added by extension, not by large invasive edits
