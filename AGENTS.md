# Repository Rules

## Project Overview

- Kiwi AI Interview Agent is a React/Vite frontend plus Express backend interview practice platform.
- The product flow includes CV upload, JD parsing, CV-JD matching, interview planning, text or voice interview sessions, report generation, and AI evaluation runners.
- Treat text interview mode as the safest low-dependency demo path. Voice mode depends on browser microphone permission, authenticated WebSocket access, valid Azure Speech credentials, and a live interview session.

## Repo docs

The living project guide is in `repo-docs/`. This repo's `repo-docs/` guide is reader-facing Chinese documentation. When updating reader-facing guide pages, use `repo-docs-zh` when available; keep Chinese reader handles in the prose and preserve exact source identifiers for lookup. Start with `repo-docs/README.md`; when `repo-docs/walkthroughs/one-real-run.md` exists, use it as the main behavior trace.

Run one evidence/docs gate per task. The same minimal source inspection must serve both the technical answer and the documentation decision; do not repeat source discovery just to satisfy a second gate.

Repo-docs sync is required for stable product-behavior changes, architecture/onboarding work, or a correction that would otherwise leave the guide materially false. Read-only questions, transient status/debugging, command help, and test-only changes that do not alter documented behavior default to `answer-only` or `none`.

Choose exactly one outcome before the final response: `none`, `answer-only`, `one owning Feature RFC + scoped change-log`, `foreground repo-doc patch`, or `approved milestone-wide sync`. Do not update both RFCs and reader guides for the same small slice unless one would otherwise remain materially false. Broader guide work is deferred to an explicitly approved milestone closeout instead of spawning a documentation task automatically.

## Required Reading Before Work

- Before making any code change, read `docs/clean-code-rules.md` first.
- Before changing voice interview behavior, voice tests, voice prompts, voice latency handling, STT/TTS, VAD, duplex WebSocket logic, interview question selection, or transcript confidence handling, also read `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`.
- Do not rely on memory for voice interview behavior. Treat `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` as the product contract.
- If an implementation idea conflicts with the product behavior document, stop and explain the conflict before changing code.
- **Auto Documentation Synchronization**: When behavior-bearing product code changes, execute the `auto-docs-sync` skill ([SKILL.md](./.agents/skills/auto-docs-sync/SKILL.md)) within the task contract. Update one owning Feature RFC and one scoped change-log entry. Test-only, formatting-only, refactor-only, and transient diagnostic changes need no documentation patch unless they alter documented behavior. Sitemaps, reader guides, and cross-system documents require explicit wider approval. High-level agent mapping is documented in [HIGH_LEVEL_AGENT_ARCHITECTURE_MAPPING.md](./docs/architecture-decision-records/HIGH_LEVEL_AGENT_ARCHITECTURE_MAPPING.md).
- **Ground-Truth Protocol**: Apply the `ground-truth-anti-hallucination` skill ([SKILL.md](./.agents/skills/ground-truth-anti-hallucination/SKILL.md)) proportionally. Every task requires minimal source grounding. Disk verification is required after writes. Independent subagent QA is required for product-behavior writes, security/privacy/scoring/persistence changes, cross-layer changes, or broad documentation claims. Read-only answers, narrow reviews, and low-risk non-behavior writes do not require a subagent.

## Harness Product Updates

- For any change to product-agent contracts, run/context correlation, action or gate policy, cross-session memory, report publication, harness observability, replay, or harness rollout, first read `docs/harness/AGENTS.md`, `docs/harness/goal.md`, and `docs/harness/spec.md`.
- Treat `docs/harness/AGENTS.md` as additional execution instructions for harness work across `backend/`, `frontend/`, tests, scripts, and docs; its location does not limit it to the `docs/harness/` subtree.
- Root rules and `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` take precedence if a harness instruction conflicts with repository or voice product rules.

## Approval First

- A clear user request to implement or modify something counts as approval for changes inside the agreed task contract.
- Ask again before scope expansion, architecture changes, budget overruns, destructive actions, dependency installs, git pushes, or external side effects.
- Do not silently change implementation strategy to avoid an approval requirement.

## Change Budget and Dirty Worktree Control

The user values small, attributable, reversible changes over broad "complete" rewrites. Treat the task contract and baseline as hard constraints, not planning suggestions.

- For read-only analysis, record a path-only dirty-worktree snapshot. Before writing, capture task-scoped baseline evidence for allowed paths using status plus their existing diff or content hash. Do not hash, read, or attribute unrelated dirty files.
- Write a task contract before editing: one observable goal, allowed and forbidden areas, file/test/doc/diff budgets, execution-cycle budget, and the smallest expected evidence. Conservative defaults are at most 5 production files, 3 test files, 1 owning Feature RFC plus 1 scoped change-log entry, and fewer than 400 incremental changed lines.
- Do not expand a task without explicit approval. If the forecast exceeds 10 task-owned files or 500 incremental changed lines, stop before implementation, present a split plan, and wait. Adjacent cleanup, diagnostics, UI, migrations, docs sweeps, and another product surface are never implied.
- Each product-behavior slice updates at most one owning Feature RFC and one precise change-log entry. Do not rewrite sitemaps, reader guides, or cross-system documents unless explicitly approved or required to prevent a materially false statement. Defer milestone-wide alignment to milestone closeout.
- At an implementation handoff, report: (1) files added or modified by this task relative to its baseline, (2) pre-existing dirty files left untouched, (3) the reason for each task-file change, and (4) test evidence, including `NOT RUN` when applicable. If concurrent edits make attribution uncertain, say so rather than guessing.
- Keep independent product concerns in independent commits or PRs. Do not bundle a clarification bug fix with question-planning, report-surface, diagnostics, legacy migration, or opportunistic cleanup work.

### Execution Budget and Stop Rules

1. Use no more than three implementation cycles.
2. Cycle 1: inspect and patch all confirmed issues.
3. Cycle 2: run focused tests and repair failures.
4. Cycle 3: run the independent auditor and repair only auditor-confirmed gaps.
5. Do not repeatedly reread unchanged files.
6. Use `git diff` to identify what still requires verification.
7. Reserve the final stage for tests, security-boundary checks, and the audit report.
8. Do not start unrelated refactoring.
9. If completion is impossible within these limits, stop and report:
   - completed items
   - unresolved items
   - exact blockers
   - recommended next task
10. Do not claim `PASS` before the auditor returns its final evidence matrix.


## Dev Commands

- Backend dev server: from `backend`, run `npm run dev`.
- Frontend dev server: from `frontend`, run `npm run dev`.
- Backend lint: from `backend`, run `npm run lint`.
- Backend robustness tests: from `backend`, run `npm run test:all`.
- Frontend lint: from `frontend`, run `npm run lint`.
- Frontend tests: from `frontend`, run `npm run test:all`.
- Frontend full check: from `frontend`, run `npm run quality:all`.
- Backend full quality gate: from `backend`, run `npm run quality:all` only when real AI credentials and eval cost expectations are clear.
- Backend real AI evals: from `backend`, run `npm run eval:all` only when real AI credentials are configured and the user has approved running them.

## Testing Instructions

- Run the smallest relevant check first and stop when the task contract's evidence requirement is satisfied.
- Documentation-only changes use format/link/diff validation only; do not run product suites.
- A single backend behavior slice uses focused Vitest files plus backend lint. From `backend`, run `./node_modules/.bin/vitest run <test-files>`; do not pass focused file arguments through `npm run test` wrappers that expand to the full suite.
- A single frontend behavior slice uses focused Vitest files plus frontend lint. From `frontend`, run `./node_modules/.bin/vitest run <test-files>`; do not pass focused file arguments through `npm run test` wrappers that expand to the full suite.
- Cross-package shared contracts, schema/auth/persistence infrastructure, milestone closeout, or an explicit release request may require backend `npm run test:all` and frontend `npm run quality:all`.
- After moving files or changing imports, run lint for the affected package.
- Add or update tests for changed behavior, especially around parsing, scoring, authorization, persistence, voice flow, and report grounding.
- Use quiet reporters and bounded command output where possible. Do not stream an entire passing suite log into context; retain the summary and actionable failures.
- If a check needs unavailable credentials, paid providers, network access, or blocked local ports, mark it `NOT RUN` with the reason. Do not retry an unchanged environmental failure repeatedly.
- Do not run real AI evals as a routine test step; they require credentials and may have cost or quota impact.

## Code Quality

- Follow `docs/clean-code-rules.md` in every code change.
- Follow clean code principles in every file:
  - Keep functions small and focused on one responsibility.
  - Prefer explicit naming over abbreviated naming.
  - Avoid duplicated logic; extract shared logic into services, utilities, or components when it improves clarity.
  - Keep side effects close to the boundary layer.
  - Prefer deterministic business logic over model-generated decisions for core product behavior.
  - Add comments only when the code would otherwise be non-obvious.

## Voice Interview Product Rules

- Voice interview behavior must follow `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`.
- Treat the voice interview as a state machine, not a collection of isolated flags.
- Low-confidence STT is a system understanding issue, not automatically a failed user answer.
- Contentful low-confidence transcripts must go through understanding confirmation instead of being silently discarded or directly scored.
- Repair prompts, transcript confirmations, clarification turns, repeat requests, system messages, and barge-in acknowledgements must not count as interview questions.
- The product latency target is `user speech end -> next question first audio <= 3 seconds`.
- Next-question behavior must preserve transparency: record why the question was selected, what evidence supported it, what it is expected to test, and any ranking or alternatives considered.
- The LLM should primarily naturalize selected questions into spoken text. Deterministic controller and ranking logic should decide what should be asked and why when possible.

## Structure

- Frontend code belongs under `frontend/src`.
- Backend API code belongs under `backend`.
- Route handlers should stay thin and delegate business logic to services.
- Parsing, scoring, and other domain logic should live in backend services, not controllers.
- UI components should stay presentation-focused and avoid hidden business logic.
- Frontend API clients belong under `frontend/src/api`.
- Reusable frontend UI belongs under `frontend/src/components`; page orchestration belongs under `frontend/src/pages`.
- Voice-specific frontend logic should stay under `frontend/src/hooks/voice` or nearby voice hooks.
- Backend voice logic should stay under `backend/src/services/voice` or clearly named interview/AI-control services.
- Backend persistence logic should stay in repositories or storage services, not route handlers.

## Environment and Secrets

- Backend environment examples live in `backend/.env.example`.
- Do not read, print, commit, or modify real `.env` secrets unless explicitly requested.
- Do not commit generated credentials, access tokens, recordings, uploaded CVs, exported reports, or local database dumps.
- Be conservative with privacy and compliance claims. UI copy and docs must not promise encryption, deletion guarantees, or compliance readiness unless the backend fully enforces those guarantees.

## UI/UX Change Process

- Before changing the UI, provide:
  - The user problem being solved.
  - The exact screens/components affected.
  - The proposed layout and interaction changes.
  - The visual direction and why it improves professionalism or usability.
- Wait for approval before implementation.

## Git Workflow

- Do not push, force-push, or rewrite git history without approval.
- Keep commits scoped and descriptive.
- Do not commit secrets or `.env` files.

## Nested Instructions

- If a nested `AGENTS.md` exists under `frontend`, `backend`, or another subdirectory, follow the closest file for that area.
- Root rules still apply unless the nested file explicitly narrows them.

## User Plan Priority

When the user provides a concrete plan, checklist, or step-by-step implementation request, follow that plan as the main source of truth.

Do not default to the smallest safe change if the user clearly asks for a broader implementation.

An explicit broad outcome authorizes the requested result, not an unbounded implementation. Divide it into named task contracts before any slice exceeds its budget or the 10-file/500-line hard stop. One user approval may authorize an enumerated sequence of bounded slices; unapproved excess work is `deferred pending approval`, not a technical blocker.

Before editing, convert the user's plan into an implementation checklist. Complete every item unless there is a concrete technical blocker. If any item is skipped or changed, explain why in the final response.

Preserve existing behaviour unless the user explicitly asks to change it.
