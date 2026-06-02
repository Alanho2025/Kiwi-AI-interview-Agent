# Marker Review Guide

This guide explains how to review the Kiwi AI Interview Agent repository against the project rubric.

## Project overview

Kiwi AI Interview Agent is a compound AI interview coaching system. It uses a candidate CV, a target job description, retrieval-supported reasoning, adaptive interview control, voice or text interaction, and evidence-grounded report QA to produce personalised mock interview practice.

## Rubric alignment

| Rubric area | What to inspect | Evidence location |
| --- | --- | --- |
| Technical quality and AGI implementation | The system is more than a chat UI. It has CV and JD parsing, human review gates, CV-JD matching, retrieval, adaptive turn control, voice transport, report generation, QA, diagnostics, and tests. | `README.md`, `docs/implementation-workflows.md`, `docs/implementation-functions.md`, `backend/src/services/` |
| Baseline comparison | The repo includes scripts for baseline and quality checks. The final paper should compare Kiwi Coach against generic interview chatbots or manual mock interview practice. | `backend/package.json`, `backend/eval/`, `docs/testing-and-evaluation.md` |
| Completeness of claims | Product claims should be tied to code, tests, or known limitations. | `docs/code-document-alignment.md`, `README.md` |
| Problem verification and impact | The repository implements the system. Market need and cost-benefit evidence should be argued in the final report. | Final report, `docs/commercial-product-plan.md`, AI usage tracking code |
| Reproducibility and road show | Setup commands, safe demo flow, tests, and implementation maps are documented. | `README.md`, `docs/testing-and-evaluation.md` |

## Recommended review order

1. Read `README.md` for the product and architecture overview.
2. Read `docs/implementation-workflows.md` for the full CV-to-report workflow.
3. Read `docs/implementation-functions.md` for the service and function implementation map.
4. Read `docs/testing-and-evaluation.md` for the test and evaluation strategy.
5. Run the safe text-mode demo path if the environment is available.
6. Treat voice mode as product-wired but environment-dependent unless Azure Speech, browser microphone permission, WebSocket authentication, and a live interview session are configured.

## Implemented chain

```text
Login
  -> CV upload or reuse
  -> CV parsing and human review
  -> pasted JD parsing and human review
  -> CV-JD match analysis
  -> JD question filter
  -> interview plan
  -> prepared question pool
  -> text or voice interview loop
  -> adaptive follow-up and next-question control
  -> transcript and question metadata persistence
  -> report generation
  -> report QA and report status persistence
```

## Why the system is agentic

The system does not only send one prompt to an LLM. It uses separate stages:

- input structuring from CV and JD
- safeguard checks and human review gates
- retrieval over session artifacts and interview knowledge
- answer understanding and evaluation
- decision context construction
- action planning and action execution
- question metadata and transcript persistence
- report generation, grounding, QA, and repair orchestration

This gives the system multi-step reasoning and tool-style orchestration across different services.

## Important limitations

- Voice mode is wired but depends on live provider credentials, browser permissions, WebSocket health, and an active authenticated interview session.
- Some preparation steps use fallback behavior instead of hard blocking. This improves demo resilience but means diagnostics matter.
- The local deterministic embedding is suitable for MVP retrieval experiments, not production-grade semantic retrieval.
- Commercial proof should come from the final report's market evidence and cost-benefit analysis, not from code alone.
- Report QA and repair support exist, but claims should describe the exact verified behavior.

## Stable demo path

Use text mode for the most reliable review demo:

1. Login.
2. Upload a CV.
3. Review parsed CV fields.
4. Paste a JD.
5. Generate and review the structured JD rubric.
6. Run CV-JD match.
7. Generate the interview plan.
8. Start text interview.
9. Answer several questions.
10. End or complete the interview.
11. Open the report page and inspect feedback, evidence, score breakdown, and QA status.
