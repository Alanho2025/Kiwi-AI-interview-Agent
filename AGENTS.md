# Repository Rules

## Approval First

- Ask for approval before making any non-trivial code change.
- Ask for approval before running destructive commands, dependency installs, git pushes, or architecture changes.
- Ask for approval before any UI design change. Do not change layout, styling, spacing, color, typography, or interaction patterns without presenting a concrete proposal first.

## Code Quality

- Follow clean code principles in every file:
- Keep functions small and focused on one responsibility.
- Prefer explicit naming over abbreviated naming.
- Avoid duplicated logic; extract shared logic into services, utilities, or components when it improves clarity.
- Keep side effects close to the boundary layer.
- Prefer deterministic business logic over model-generated decisions for core product behavior.
- Add comments only when the code would otherwise be non-obvious.

## Structure

- Frontend code belongs under `frontend/src`.
- Backend API code belongs under `backend`.
- Route handlers should stay thin and delegate business logic to services.
- Parsing, scoring, and other domain logic should live in backend services, not controllers.
- UI components should stay presentation-focused and avoid hidden business logic.

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
