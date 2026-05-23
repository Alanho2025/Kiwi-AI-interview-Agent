# Voice Robustness Eval

- Cases run: 8
- Average score: 1
- Accepted cases: 2
- Rejected cases: 6
- Min average gate: 0.9
- Per-case fail gate: 0.75

## Case results
| case | score | expected | actual | expected reason | actual reason | decision | reason | message | failed checks |
| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| empty-transcript-rejected | 1 | rejected | rejected | EMPTY_TRANSCRIPT | EMPTY_TRANSCRIPT | 1 | 1 | 1 | - |
| short-filler-rejected | 1 | rejected | rejected | TOO_SHORT_TRANSCRIPT | TOO_SHORT_TRANSCRIPT | 1 | 1 | 1 | - |
| low-confidence-rejected | 1 | rejected | rejected | LOW_CONFIDENCE_TRANSCRIPT | LOW_CONFIDENCE_TRANSCRIPT | 1 | 1 | 1 | - |
| medium-confidence-too-short-rejected | 1 | rejected | rejected | MEDIUM_CONFIDENCE_INSUFFICIENT_EVIDENCE | MEDIUM_CONFIDENCE_INSUFFICIENT_EVIDENCE | 1 | 1 | 1 | - |
| accented-clear-answer-accepted | 1 | accepted | accepted | VALID_TRANSCRIPT | VALID_TRANSCRIPT | 1 | 1 | 1 | - |
| domain-terms-accepted-when-clear | 1 | accepted | accepted | VALID_TRANSCRIPT | VALID_TRANSCRIPT | 1 | 1 | 1 | - |
| non-final-vad-rejected | 1 | rejected | rejected | NON_FINAL_VAD_TRANSCRIPT | NON_FINAL_VAD_TRANSCRIPT | 1 | 1 | 1 | - |
| no-final-stt-segment-rejected | 1 | rejected | rejected | NO_FINAL_STT_SEGMENTS | NO_FINAL_STT_SEGMENTS | 1 | 1 | 1 | - |

## Interpretation
This benchmark checks whether the voice input layer blocks unsafe or unclear transcripts before they are saved as interview answers. It covers silence, empty transcript, low-confidence STT, incomplete VAD, accented but clear speech, and domain-specific terminology.

