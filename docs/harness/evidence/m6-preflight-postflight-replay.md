# M6 Preflight, Postflight, and Rollback Evidence

- Generated: 2026-07-26T11:00:23+12:00
- Status: `LOCAL_PASS_SHADOW_OBSERVE`

## Preflight

Before the existing controller executes, the wrapper validates the formal task, owner/context refs, registered capability surface, and budget availability. Unknown task/capability or missing required context is recorded as a failed/review check without creating a second orchestrator.

## Runtime and postflight

The same registry functions execute through an observation wrapper. The controller result is returned unchanged. Postflight creates a versioned result envelope that separates lifecycle, quality, publication, and validation state.

## Rollback

With the harness feature flag off, execution bypasses the harness wrapper and preserves the legacy controller path. Shadow/observe failure remains fail-open according to the existing harness policy.

## Local evidence

- Backend `npm run test:all` passed, including 72/72 contract tests.
- `harnessExecutableControls.test.js` verifies preflight, lifecycle privacy, result validation, write decisions, and rollback-compatible behavior.
- Existing interview/report wrapper contract tests pass.

This is local deterministic evidence, not live-provider or production replay evidence.
