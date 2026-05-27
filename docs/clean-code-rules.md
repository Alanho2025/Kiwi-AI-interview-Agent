# Clean Code Rules for Kiwi AI Interview Agent

This file is the mandatory rule set for every future code change.

The goal is not clever code. The goal is low change cost.

A good change should make the system easier to read, easier to test, easier to extend, and safer to modify later.

## 1. Core Standard

A change is acceptable only when it keeps the code:
- easy to read
- easy to extend
- easy to test
- easy to review
- low-risk to modify later

Prefer clear code over smart code.

Avoid changes that solve the current task but make the next task harder.

## 2. Responsibility Rule

### Function level

One function should do one job.

Split a function when it does more than one of these jobs:
- fetch data
- validate input
- transform data
- format display text
- update state
- persist data
- send a response

If a function name needs `and`, it is usually too broad.

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

### Module level

One file should own one clear responsibility group.

Do not mix:
- persistence and formatting
- business rules and HTTP response control
- page layout and large display transformation logic
- React rendering and browser runtime control
- API calls and view model formatting

## 3. Backend Boundary Rule

Backend files must keep clear boundaries.

Use these roles:
- route: route registration only
- controller: request and response orchestration only
- service: business logic only
- repository or model access layer: persistence only
- utility: pure reusable helper logic only
- middleware: request pre-processing, auth, validation, rate limiting, or security checks only

Rules:
- A route should not contain business logic.
- A controller should not contain heavy domain logic.
- A service should not directly manage Express response objects.
- A repository should not format data for the frontend.
- A utility should not silently depend on database state, request state, or environment state.

## 4. Frontend Boundary Rule

Frontend files must keep clear boundaries.

Use these roles:
- page: page orchestration and layout composition
- section component: section-level rendering
- reusable UI component: display reuse only
- custom hook: UI-facing state and side-effect orchestration for one narrow feature
- runtime module: browser APIs, WebSocket, audio streams, timers, storage, or device APIs
- formatter: text or display conversion only
- mapper: shape conversion only
- builder: higher-level view model assembly only
- api module: network calls and response normalization only
- constants module: shared strings, route names, statuses, modes, and keys only

Rules:
- A page should not contain large transformation logic.
- A component should not own business rules.
- A custom hook should not become a full service layer.
- An api module should not render UI or manage React state.
- A runtime module should not format user-facing text.

Do not cross boundaries unless there is a strong reason.

If a boundary is crossed, the reason should be obvious from the code.

## 5. React Component Rule

Components should primarily render UI.

A component may contain:
- simple event handlers
- simple conditional rendering
- simple local UI state
- simple mapping over already-prepared display data

A component should not contain:
- large data transformation logic
- business rules
- network request implementation
- WebSocket lifecycle logic
- audio stream lifecycle logic
- repeated response normalization logic
- complex scoring, matching, or report-generation logic

When a component starts managing feature flow, extract a custom hook.

When a component starts transforming data heavily, extract a mapper or builder.

When a component repeats UI with stable behavior and a clear name, extract a reusable component.

Do not extract repeated JSX only because it looks similar. Small JSX duplication is acceptable when extraction would create unclear props or reduce readability.

## 6. React Hook Rule

Custom hooks should own one feature-level behavior.

Good examples:
- `useVoiceInterviewSession`
- `useCvUpload`
- `useMatchAnalysis`
- `useSessionReport`

A hook should not mix unrelated responsibilities.

Avoid hooks that manage all of these in one file:
- UI state
- API calls
- large response transformation
- browser APIs
- timers
- WebSocket lifecycle
- display text formatting

If a hook grows too broad, split it into:
- runtime hook
- state hook
- API helper
- pure mapper
- UI formatter

A hook should expose a small and clear interface to components.

Avoid returning large bags of unrelated state and handlers.

## 7. React Effect Rule

Use `useEffect` only for real side effects.

Good uses include:
- network synchronization
- browser API subscription
- WebSocket lifecycle
- audio or media stream lifecycle
- timer setup and cleanup
- external storage synchronization

Do not use `useEffect` for:
- deriving display values
- copying props into state without a clear reason
- formatting data
- running business rules that can be pure functions
- hiding control flow that should be handled by an event handler

Every effect must have:
- one clear purpose
- a correct dependency list
- cleanup when it subscribes, listens, streams, or starts timers

If an effect becomes hard to explain, split it.

If an effect causes repeated re-renders, fix the state flow instead of adding guards everywhere.

## 8. React State Ownership Rule

Each piece of state must have one owner.

Prefer:
- local component state for temporary UI state
- custom hook state for one feature flow
- context only for cross-page or cross-feature state
- backend as the source of truth for persisted session, user, report, and uploaded document data

Avoid:
- duplicating backend data into multiple local states
- storing derived values as state
- passing state through many layers when a feature hook or context is clearer
- using `localStorage` as the source of truth for important application data
- updating the same state from multiple unrelated places

Derived values should usually be calculated with pure functions or memoized values.

Persisted data should be reloaded or invalidated in a predictable way.

## 9. Predictable Data Flow Rule

Input shape should be clear.

Output shape should be clear.

Side effects should be obvious.

Avoid:
- hidden mutation
- silent fallback values that hide real bugs
- functions that depend on unrelated external state
- deep nested property access in UI files
- broad object passing without clear shape

Prefer:
- mapper for shape conversion
- formatter for text or display conversion
- builder for higher-level view model assembly
- factory for domain object creation
- normalized API output before data reaches components

## 10. API Contract Rule

API modules should normalize backend responses before exposing them to components.

Components should not know raw backend response shapes unless the shape is stable and documented.

Prefer:
- `fetchSession()` returns a normalized session object
- `parseCv()` returns `{ parsedCv, warnings }`
- `parseJd()` returns `{ parsedJd, warnings }`
- `matchCvToJd()` returns `{ matchResult, evidence, warnings }`

Avoid:
- reading deeply nested response fields inside page components
- repeating response fallback logic across components
- mixing fetch logic with display formatting
- returning different shapes for the same API state

For expected API failures, return or throw a consistent error shape.

For unexpected API failures, keep enough debug context for logs but show users a clear action-based message.

## 11. JavaScript Safety Rule

Prefer explicit and predictable JavaScript.

Use:
- `const` by default
- `let` only when reassignment is needed
- optional chaining only when missing data is acceptable
- nullish coalescing for real fallback values
- early returns for invalid inputs
- small pure functions for repeated logic

Avoid:
- hidden mutation
- magic strings repeated across files
- unclear object shapes
- silent fallback values that hide broken data
- large anonymous callbacks inside render blocks
- mixed sync and async control flow in one function

If data can be missing, decide whether that is expected or a bug.

Do not use optional chaining to hide a bug.

## 12. Constants and Magic String Rule

Repeated domain strings must be centralized.

Examples:
- interview modes
- interview question types
- session statuses
- transcript statuses
- voice event names
- report score bands
- match result labels
- API route names
- localStorage keys
- WebSocket event names
- error codes

Avoid repeating string literals across components, hooks, services, and tests.

A shared string should have one owner.

If changing a label or status requires searching the whole project, it probably needs a constant.

## 13. Duplication Rule

Repeated structure or repeated logic must not appear more than 3 times.

When a pattern appears for the 3rd time, review it for extraction.

Extraction options include:
- helper
- mapper
- formatter
- builder
- shared component
- shared hook
- shared service
- shared constant

Do not keep copy-paste variants with small text changes.

However, do not extract too early.

Small duplication is acceptable when extraction would create unclear names, unclear props, or weaker readability.

Extract only when the repeated pattern has the same responsibility, similar behavior, and a stable name.

## 14. Change-Friendly Design Rule

When adding a feature, prefer adding a new focused module over modifying a large old module.

Target pattern:
- new feature = new route, controller, service, component, hook, mapper, or helper
- not new feature = keep stuffing logic into one existing big file

A good change should affect the fewest responsible files possible.

Do not avoid touching the right file just to reduce file count.

Good design allows future features to be added by extension, not by large invasive edits.

## 15. Readability First Rule

Readable code beats clever code.

Prefer:
- direct logic
- guard clauses over dense nesting
- clear names over short names
- small functions over long mixed functions
- consistent abstraction level inside one function

Avoid:
- mixing high-level strategy and low-level string cleanup in the same function
- hiding important logic behind vague helper names
- compressing logic until it becomes hard to debug
- writing code that only the author can safely change

If a reviewer needs too much context to understand a change, the code probably needs clearer structure.

## 16. Error Handling Rule

Error handling must be consistent.

### Backend

Expected errors should use shared error classes or a shared error pattern.

Unexpected errors should bubble to the global handler.

Do not mix these patterns for the same kind of failure without a reason:
- `throw`
- `return null`
- `return { ok: false }`
- direct response sending

Backend errors should preserve enough context for debugging without exposing secrets or sensitive user data.

### Frontend

Separate frontend errors into:
- user-facing errors
- recoverable runtime errors
- developer/debug errors

Rules:
- loading state pattern should be consistent
- empty state pattern should be consistent
- error state pattern should be consistent
- user-facing errors should be clear and action-based
- recoverable runtime errors should expose recovery state when possible
- developer errors should be logged with context but not shown directly to users

Voice, upload, parsing, matching, and report-generation flows should not fail silently.

## 17. Testability Rule

Code should be structured so important logic can be tested in isolation.

Prefer extracting:
- pure functions
- builders
- formatters
- mappers
- narrow services
- narrow hooks
- API modules with normalized return shapes

Avoid burying core logic inside:
- giant page components
- giant custom hooks
- controller-only flows
- mixed persistence and formatting functions
- UI event handlers that also contain business rules

### Frontend testing boundary

Prefer testing:
- pure mappers and builders with unit tests
- custom hooks for state transitions
- API modules with mocked network responses
- components by user-visible behavior
- voice/session runtime behavior through focused mocks

Avoid tests that depend on:
- private component state
- exact DOM structure unless required
- implementation-specific hook calls
- large end-to-end flows for logic that could be unit tested

## 18. Size Warning Rule

These are warning thresholds, not hard blockers.

Hitting a threshold means review is needed.

### Backend

- controller file: review when above 150 lines
- service file: review when above 200 lines
- route file: review when above 120 lines
- repository file: review when above 180 lines
- function: review when above 40 lines

### Frontend

- page file: review when above 220 lines
- feature component file: review when above 150 lines
- reusable UI component: review when above 100 lines
- custom hook: review when above 120 lines
- utility, formatter, or mapper file: review when above 150 lines

Line count is weaker than responsibility count.

A 90-line file with 4 responsibilities is worse than a 160-line file with one clear responsibility.

If a file grows past the threshold, stop and check whether responsibility has started to blur.

## 19. Collaboration Rule

This project is built for multi-person work.

Every change should reduce these risks:
- merge conflict risk
- unclear ownership
- broad side effects
- hard-to-review diffs
- inconsistent patterns

Prefer:
- smaller focused files
- stable calling patterns
- clean shared utilities
- clear constants
- predictable API contracts
- small pull requests when possible

Avoid:
- broad rewrites without a clear reason
- changing formatting and logic in the same commit
- editing unrelated files in one change
- introducing a second pattern when one already exists

## 20. Required Workflow for Future Changes

For every future feature or refactor:

1. Read this file first.
2. Read the relevant code area.
3. Identify duplication, boundary leaks, oversized modules, and unclear state ownership.
4. Make the largest safe batch of changes possible.
5. Run the relevant tests and lint checks.
6. Keep the change focused and reviewable.
7. Document important new patterns when they become reusable.

For formal handoff or milestone delivery, produce a versioned package.

For normal development, use Git branches, pull requests, and tagged releases where appropriate.

## 21. Packaging and Versioning Rule

Every formal delivered package must:
- use version naming
- exclude `.git`
- exclude `node_modules`
- exclude `.env`
- exclude build noise when possible
- include the latest relevant documentation

Version examples:
- `kiwi-clean-code-v1.0.0.zip`
- `kiwi-clean-code-v1.1.0.zip`
- `kiwi-clean-code-v1.2.0.zip`

Do not create zip packages for every small normal development change unless a handoff requires it.

## 22. Definition of Done for Clean Code in This Project

A code area is considered aligned with this standard when:
- duplication is controlled
- responsibilities are separated
- names are clear
- data flow is predictable
- state ownership is clear
- side effects are isolated
- API contracts are normalized
- errors are handled consistently
- file size is reasonable
- important logic is testable
- future features can be added by extension, not by large invasive edits

If a change makes the code harder to reason about, it is not clean code yet.
