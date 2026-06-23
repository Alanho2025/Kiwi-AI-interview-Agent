# Backend tests

This backend test suite is intentionally robustness-focused.

`npm run dev` is enough to verify that the app can start. The automated tests should not spend time proving only that happy-path endpoints can return something. Instead, `npm run test:all` covers the integration and robustness groups explicitly listed in `backend/package.json`, including edge cases, malformed inputs, degraded external services, report integrity, resumable recording, tool-trace contracts, duplex voice interruption, and regression guards that prevent removed legacy flows from returning.

Important scope boundary: `npm run test:all` currently selects 98 test files and does not include `tests/unit`, `tests/robustness/retention`, or `tests/robustness/interview`. Run those paths explicitly for changes in those areas. The repository contains 132 backend `*.test.js` files as of 2026-06-23.

`npm run quality:all` runs lint, the configured `test:all` groups, local evals, and then real provider-backed eval runners. Real evals require configured credentials and can consume cost or quota; do not run them as a routine local check.
