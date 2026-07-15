# M1 Debug Benchmark

- Generated: 2026-07-15T09:14:59.210Z
- Benchmark: deterministic lookup proxy over current scattered log/decision/trajectory/memory shapes
- Failure tasks: 5
- Correct diagnosis: 100%
- Legacy median: 4.5232 ms
- Harness median: 0.0005 ms
- Reduction: 99.99%
- Target: at least 50%
- Proxy verdict: PASS

This measures deterministic lookup cost, not a human developer's wall-clock diagnosis time. H1 must still confirm that the queryable timeline shortens diagnosis in an actual session.
