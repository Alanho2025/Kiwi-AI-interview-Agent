---
name: ground-truth-anti-hallucination
description: Risk-tiered Ground-Truth Verification Protocol for source-backed claims, verified writes, and bounded independent QA.
---

# Ground-Truth Anti-Hallucination Skill

This skill enforces evidence-backed work without turning every question or small edit into a full audit workflow.

The goal is to prevent invented symbols, stale documentation, and unsupported claims while keeping verification proportional to task risk.

---

## Risk Tiers

| Tier | Examples | Required verification |
| --- | --- | --- |
| T0 — read-only | Repository question, status check, narrow explanation, command help | Minimal source grounding only |
| T1 — low-risk write | Typo, formatting, comment, narrow test-only or docs-only correction | Source grounding + disk verification |
| T2 — behavior write | Product behavior, cross-file refactor, public contract, Feature RFC | Source grounding + disk verification + one independent QA |
| T3 — high-risk write | Security, privacy, authorization, scoring, persistence, migration, deployment | T2 plus focused negative/adversarial verification |

Use the lowest tier that fully covers the requested work. Do not raise the tier merely because the repository is large or already dirty.

---

## Step 1: Source Grounding (原始碼真實檢索)

Before modifying files or making repository-specific technical claims:

1. Inspect only the minimum authoritative source needed for the task using available read-only tools such as `rg`, `sed`, `view_file`, or `grep_search`.
2. Never invent non-existent functions, endpoints, parameters, packages, files, or runtime behavior.
3. Verbatim code quotations must be exact slices from disk and include a file/line reference. Conceptual explanations and clearly labeled pseudocode may be paraphrased; do not present them as existing code.
4. If behavior is not implemented or evidence is incomplete, label it `Planned`, `Partial`, `Not verified`, or `Non-goal` as appropriate.
5. Reuse this inspection for the repo-docs decision. Do not repeat source discovery for a second documentation gate.

## Step 2: Disk Inspection (實體落盤校驗)

Required only after a write:

1. Use `git status`, a task-scoped diff, or direct file inspection to verify that intended writes reached disk.
2. Compare only task-owned paths against the task baseline. Do not attribute unrelated dirty files to the task.
3. Check modified documents and interfaces for stale or contradictory nearby text.
4. Run the smallest relevant syntax, format, link, lint, or focused test check required by the task contract.

## Step 3: Bounded Independent QA (跨 Context 對立稽核)

Required for T2 and T3 only:

1. The main agent launches exactly one clean-context auditor during Cycle 3, after its own implementation and focused checks are complete.
2. The auditor reviews only task-owned diffs, their directly affected interfaces, and the stated acceptance criteria. Whole-repository line-by-line review is not required.
3. An agent explicitly assigned as an auditor or read-only QA agent must not launch another auditor. This prevents recursive audit trees.
4. The auditor does not modify files unless the user explicitly authorizes that role. It reports blocking findings with file/line evidence and an evidence matrix.
5. The main agent repairs only auditor-confirmed gaps and runs focused verification. The same auditor may inspect those repairs within the same Cycle 3 and must return the final evidence matrix; do not launch a different or additional auditor.
6. T0 and T1 tasks do not use a subagent unless the user explicitly requests one.
7. Do not claim `PASS` before the auditor's final evidence matrix supports it.

---

## Strict Rules on Technical Claims & Documentation

- **No Overpromised Claims**: Never use claims such as "0ms latency", "100% atomicity", "2PC", or ">99% accuracy" without evidence that directly supports that exact statement.
- **Bounded Evidence**: Passing tests support only the behavior and environment they exercised. Keep human, live-provider, browser, production, and deployment evidence explicitly separate.
- **No Audit Recursion**: Independent QA uses one auditor in one audit cycle, never a self-replicating tree. A follow-up by that same auditor to finalize its evidence matrix is part of the same cycle.
- **Mandatory RFC Headers**: Every Feature RFC must include:
  - `> **實作狀態 (Implementation Status)**：[Verified / Partial / Planned]`
  - `> **校驗測試路徑 (Verified by Tests)**：[Test file path or None]`
