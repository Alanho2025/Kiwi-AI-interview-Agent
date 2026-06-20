---
name: generate-interview-report
description: |
  Summarizes an interview session and produces actionable coaching feedback and scores.
  Use this skill after an interview session has ended to generate the final evaluation report.
  Do NOT use during a live interview.
version: 1.0.0
license: MIT
allowed-tools: [Read, Bash, Write]
---
# Generate Interview Report

## When to use
- The interview session is marked as completed.
- The system needs to generate the final feedback report, calculate scores, and provide coaching.

## When NOT to use
- Do NOT use during a live interview session to grade individual answers in real-time (unless explicitly architected as intermediate feedback).

## Workflow
1. **Data Aggregation**: Load the full interview transcript, the candidate's CV profile, and the JD rubric.
2. **Grounding**:
   - Ensure ALL feedback is grounded in actual quotes or evidence from the session transcript.
   - Enforce the "no-hallucination" policy: Do NOT claim the candidate said something or demonstrated a skill they did not explicitly mention in the interview.
   - If a candidate overclaims a skill, document the discrepancy.
3. **Scoring**: Calculate scores based on the JD rubric (essential vs. preferred requirements).
4. **Coaching**: Provide specific, actionable coaching points for how the candidate can improve their answers in the future.
5. Save the final summary to the `report_summaries` table.
