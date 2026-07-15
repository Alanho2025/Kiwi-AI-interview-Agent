# M1 Debug Benchmark

- Generated: 2026-07-15T12:43:19.065Z
- Benchmark: deterministic lookup proxy over current scattered log/decision/trajectory/memory shapes
- Failure tasks: 5
- Correct diagnosis: 100%
- Legacy median: 4.5872 ms
- Harness median: 0.0007 ms
- Reduction: 99.99%
- Target: at least 50%
- Proxy verdict: PASS

This measures deterministic lookup cost, not a human developer's wall-clock diagnosis time. Automated browser H1 confirmed that the durable timeline is populated after real frontend/backend/WebSocket execution, but human diagnosis timing remains required.
