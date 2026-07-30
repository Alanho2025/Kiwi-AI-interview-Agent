---
name: evidence-gated-implementation
description: Implement a user plan with a requirement-to-evidence matrix, traced real data flows, adversarial negative tests, bounded full-suite runs, and one independently audited handoff. Use when a user asks for complete implementation, CP/checkpoint verification, anti-hallucination evidence, a PASS/FAIL checklist, or token-efficient QA.
---

# Evidence-Gated Implementation

Turn "implemented" into a claim supported by a real route, response, export, test result, or explicitly named human check. Treat local passing tests as evidence, not as proof of the entire requirement.

Use this skill alongside repository instructions. Do not replace a required anti-hallucination protocol, documentation-sync rule, approval gate, or testing command with this skill.

## 1. Build the evidence matrix before editing

Translate each requested checkpoint into an atomic row before changing code. Inspect the actual source that owns each row first.

| Requirement | Real entry and data flow | Positive proof | Negative/adversarial proof | Human or external proof | Status |
| --- | --- | --- | --- | --- | --- |
| One observable behavior | `route → controller → service → storage → response/export` | Expected output | Disallowed or boundary output | Browser, provider, credentials, or device check | `NOT RUN` initially |

Apply these rules:

- Trace the route, response builder, view model, and exporter that users actually receive. Do not stop at a helper with a plausible name.
- For UI behavior, trace `page/component → API client → server endpoint → public response → rendered/exported output`.
- Record source paths and the exact test or command that can prove each claim.
- Mark a requirement `HUMAN REQUIRED` when it depends on an authenticated account, browser permission, live provider, device, network, or usability judgment. Do not silently convert it to `PASS`.
- Do not claim a checkpoint is implemented or complete while a matrix row lacks a proof path.

## 2. Implement by evidence-bearing slice

Change one coherent slice at a time. After each slice, run only the smallest relevant deterministic check.

Design tests from the requirement rather than from the implementation. A test that repeats the same condition, regex, or helper as production code is weak evidence.

Use these adversarial probes when relevant:

- Send a direct request as well as paraphrased or indirect wording; do not test only the original phrasing.
- Exercise the real public route or response builder, not only the internal sanitizer or selector.
- Put sentinel private values in singular, plural, nested, and unexpected fields to verify a candidate/public projection cannot leak them.
- Test threshold boundaries, max-count limits, catalog/version precedence, empty input, and malformed input.
- For exports, test the actual server and client formatter/view-model paths separately when both can produce output.

Prefer an explicit public-field allowlist for candidate-facing data. If a generic filter is unavoidable, cover identifier families and realistic nested payloads with tests; a small denylist is not a safety boundary.

## 3. Spend the validation budget deliberately

Use this order unless repository rules require a stricter one:

1. Run focused tests after each changed slice.
2. Resolve all failed matrix rows and run their focused regression tests.
3. Run each affected package's broad final quality gate once, only after the focused matrix is green.
4. Capture the command, exit status, duration, and result in the same persistent terminal session. Retrieve more output from that session; never rerun a long suite only because the first tool response was truncated.
5. Run real-provider evaluations, browser/device flows, or cost-bearing tests only with explicit approval. Otherwise report them as `NOT RUN` or `HUMAN REQUIRED`.

Do not run a full backend suite or frontend quality suite repeatedly to obtain a more convenient summary. If a final suite fails, isolate the failure with a focused command, fix it, then run one new final suite for the affected package. State why that additional final run was necessary.

## 4. Run one independent QA bundle at the end

After the matrix and final automated gates are green, launch exactly one clean-context auditor by default. Give it the changed paths, the matrix, actual routes/outputs to inspect, and the human/external checks that remain out of scope. Require a line-by-line `PASS`, `FAIL`, or `NOT RUN` result with evidence.

If the audit finds defects:

- Do not call the work complete.
- Batch compatible findings into one remediation pass.
- Re-run only the affected focused checks and update the affected matrix rows.
- Do not automatically launch another broad audit. Launch a narrowly scoped delta audit only when repository instructions require it or the user approves its cost; state the scope before launching it.

Count any repository-mandated independent auditor as this one QA bundle where possible. Respect an explicit user request to stop optional QA, but never suppress a repository-required safety check; disclose the reason and keep it narrowly scoped.

## 5. Synchronize documentation after evidence, not before it

Apply the repository's documentation workflow when code or stable behavior changes. Keep planned or partially tested documentation clearly provisional until the corresponding matrix row has evidence.

Do not describe a feature RFC, checklist, or plan item as verified merely because code was written. Attach the actual source path, test path, and final gate result. Record a documentation gap instead of inventing a completion claim.

## 6. Hand off with an auditable result

Give the user a compact checklist in this form:

| Checkpoint | Result | Evidence | Remaining action |
| --- | --- | --- | --- |
| Atomic requirement | `PASS` / `FAIL` / `NOT RUN` / `HUMAN REQUIRED` | Source path plus command/test/output | Exact next action, if any |

Only say all implementation is complete when every non-human row passes. Keep human and external validation separate from automated evidence. Include:

- the final full-suite command and exit status for each affected package;
- the independent-audit result and any deliberately skipped QA;
- failures or known gaps, even if unrelated pre-existing failures prevented a full green suite;
- only evidence obtained in the current task or verified directly from disk.

Stop after the agreed evidence is collected. Do not create exploratory auditors, repeat whole suites, or perform cosmetic verification solely to increase confidence language.
