# Repository Rules

## Project Overview

- Kiwi AI Interview Agent is a React/Vite frontend plus Express backend interview practice platform.
- The product flow includes CV upload, JD parsing, CV-JD matching, interview planning, text or voice interview sessions, report generation, and AI evaluation runners.
- Treat text interview mode as the safest low-dependency demo path. Voice mode depends on browser microphone permission, authenticated WebSocket access, valid Azure Speech credentials, and a live interview session.

## Required Reading Before Work

- Before making any code change, read `docs/clean-code-rules.md` first.
- Before changing voice interview behavior, voice tests, voice prompts, voice latency handling, STT/TTS, VAD, duplex WebSocket logic, interview question selection, or transcript confidence handling, also read `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`.
- Do not rely on memory for voice interview behavior. Treat `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` as the product contract.
- If an implementation idea conflicts with the product behavior document, stop and explain the conflict before changing code.

## Approval First

- Ask for approval before making any non-trivial code change.
- Ask for approval before running destructive commands, dependency installs, git pushes, or architecture changes.
- Ask for approval before installing any package or dependency. Do not silently change implementation strategy just to avoid asking for package installation approval.


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

- Run the smallest relevant check first for the changed area.
- For backend service, controller, parsing, matching, retrieval, interview, or report changes, prefer focused backend robustness tests under `backend/tests` before broader suites.
- For frontend component, hook, route, or API client changes, run the relevant frontend Vitest tests and `npm run lint`.
- After moving files or changing imports, run lint for the affected package.
- Before broad structural changes are considered complete, run backend `npm run test:all` and frontend `npm run quality:all` when feasible.
- Add or update tests for changed behavior, especially around parsing, scoring, authorization, persistence, voice flow, and report grounding.
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

Before editing, convert the user's plan into an implementation checklist. Complete every item unless there is a concrete technical blocker. If any item is skipped or changed, explain why in the final response.

Preserve existing behaviour unless the user explicitly asks to change it.
