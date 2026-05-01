# Backend tests

This backend test suite is intentionally robustness-focused.

`npm run dev` is enough to verify that the app can start. The automated tests should not spend time proving that happy-path endpoints can return something. Instead, `npm run test:all` covers edge cases, malformed inputs, degraded external services, tool-trace contracts, duplex voice interruption, and regression guards that prevent removed legacy flows from returning.

`npm run quality:all` runs the robustness suite first, then runs real DeepSeek eval runners. The eval runners should fail when `DEEPSEEK_API_KEY` is missing, because mock AI output cannot measure CV/JD parse quality.
