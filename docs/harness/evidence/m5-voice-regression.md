# M5 Voice and Cross-Product Release Evidence

- Generated: 2026-07-15T12:54:34.031Z
- Verdict: `LOCAL_FUNCTIONAL_PASS_RELEASE_NOT_READY`
- Release ready: no
- Evidence mode: local browser with mock AI and test STT/TTS

## Local functional evidence

| Outcome | Result |
| --- | --- |
| Voice robustness | 8/8 cases, average 1.00 |
| Browser voice turns | 2/2 completed |
| Canonical interview runs | 2; duplicates 0 |
| Memory writes | 4 completed; unsafe 0 |
| Same-run confirmation | PASS |
| Report publication block observed | PASS |
| Report repair lineage | PASS |
| Candidate internal trace exposed | PASS |

## Latency gate

Per-turn speech-end to first-audio values were 3390 ms, 2089 ms. 1/2 met the <= 3000 ms product SLO; the maximum was 3390 ms. Therefore the latency gate is not verified.

## Runtime coverage

Formal observed tasks: `interview_next_turn`, `generate_report`, `qa_report`. CV-JD matching and question-pool preparation remain docs/shadow mapping only; this release evidence does not claim runtime harness coverage for them.

## Required open gates

- `synthetic_browser_voice_latency_slo`
- `human_microphone_validation`
- `live_speech_provider_validation`
- `production_observe_validation`
- `report_publication_enforcement_approval`
- `memory_product_policy_and_user_controls`
