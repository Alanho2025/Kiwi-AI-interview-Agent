---
name: ground-truth-anti-hallucination
description: Mandatory 3-Step Ground-Truth Verification Protocol (Source Grounding, Disk Inspection, Subagent Independent QA) for every task to eliminate AI hallucinations, synthetic snippets, and unverified claims.
---

# Ground-Truth Anti-Hallucination Skill

This skill enforces a mandatory 3-step verification protocol for **every task** in this codebase (coding, refactoring, documentation, code review, architectural design, debugging).

The goal is zero hallucination, zero synthetic code snippets, zero unverified claims, and 100% disk-inspected ground-truth execution.

---

## Mandatory 3-Step Protocol

### Step 1: Source Grounding (原始碼真實檢索)
Before writing any code, modifying documentation, or giving technical explanations:
1. **File Inspection**: You MUST call `view_file` or `grep_search` to inspect the authoritative source file FIRST.
2. **Byte-for-Byte Snippets**: All quoted code snippets MUST be direct 100% exact slices from actual files with exact line numbers (`L10-L35`). Synthesizing, simplifying, or "writing code from memory" is strictly FORBIDDEN.
3. **Zero Phantom Symbols**: Never invent non-existent function names, API endpoints, parameters, or packages. If a feature or function is not implemented in code, explicitly mark it as `Implementation Status: Planned / Non-Goal`.

### Step 2: Disk Inspection (實體落盤校驗)
After creating or editing files:
1. **Verification of Disk Write**: You MUST execute `git status` or `view_file` to verify that every file modification has actually been written to disk.
2. **No Partial Updates**: Ensure all sections of modified documents (including intro analogies, diagrams, and code blocks) are updated coherently without leaving stale or contradictory text.

### Step 3: Subagent Independent QA (跨 Context Subagent 對立稽核)
Before declaring any non-trivial task complete:
1. **Launch Auditor Subagent**: You MUST launch a separate Subagent (with a clean context window) as an independent Auditor to inspect the modified files line-by-line against the actual codebase.
2. **Line-by-Line Verification**: The subagent MUST check for:
   - File path existence.
   - Code snippet accuracy.
   - Absence of hallucinated terms (e.g. 2PC, fake polling, fake buckets).
   - Correct metadata headers.
3. **Fix Discrepancies**: If the Subagent reports any discrepancy, immediately apply exact code/file fixes before responding to the user.

---

## Strict Rules on Technical Claims & Documentation

- **No Overpromised Claims**: Never use unverified claims such as "0ms latency", "100% atomicity", "2PC", ">99% accuracy" unless backed by actual code logic or automated test files.
- **Mandatory RFC Headers**: Every Feature RFC must include:
  - `> **實作狀態 (Implementation Status)**：[Verified / Partial / Planned]`
  - `> **校驗測試路徑 (Verified by Tests)**：[Test file path or None]`
