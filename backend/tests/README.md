# Backend tests

This backend test suite is intentionally robustness-focused.

`npm run dev` is enough to verify that the app can start. The automated tests should not spend time proving only that happy-path endpoints can return something. Instead, `npm run test:all` covers the integration and robustness groups explicitly listed in `backend/package.json`, including edge cases, malformed inputs, degraded external services, report integrity, resumable recording, retention lifecycle contracts, tool-trace contracts, duplex voice interruption, and regression guards that prevent removed legacy flows from returning.

Important scope boundary: `npm run test:all` includes the configured robustness groups, including `tests/robustness/retention`, but it still does not include `tests/unit` or `tests/robustness/interview`. Run those paths explicitly for changes in those areas. Use `npm run test:retention` when you want only the retention lifecycle group.

`npm run quality:all` runs lint, the configured `test:all` groups, local evals, and then real provider-backed eval runners. Real evals require configured credentials and can consume cost or quota; do not run them as a routine local check.
