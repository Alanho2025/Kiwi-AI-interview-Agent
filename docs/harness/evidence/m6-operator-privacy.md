# M6 Operator and Candidate Privacy Evidence

- Generated: 2026-07-26T11:00:23+12:00
- Status: `LOCAL_PARTIAL`

## Operator-visible local evidence

`HarnessWorkflowRun.executionControls` persists the preflight/postflight, capability lifecycle, correlated usage/budget availability, and observed write decisions. The existing owner-scoped, non-production `GET /api/interview/harness-runs` developer query now returns this redacted control view; no separate operator console or production authority layer was introduced.

## Candidate-visible evidence

The report API now returns allowlisted `report_publication_summary_v1`. The Report Trust Status card maps `ready`, `ready_after_repair`, `needs_review`, and `repair_failed` to safe explanations and applicable recheck/regenerate actions. It does not expose QA flags, prompts, candidate evidence text, stack traces, or internal reasoning. Export behavior is unchanged.

## Verification

- Candidate summary backend and frontend tests pass.
- Frontend `npm run quality:all`: 61 files / 329 tests, lint, and production build passed.
- `npm run test:e2e:role-fit-visual` passed and captured desktop/mobile Report Trust Status screenshots.

## Open production gates

- Production operator role, break-glass access, access audit, retention, and deletion policy are not implemented.
- Live multi-user isolation and production trace review are not verified.
