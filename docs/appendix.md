# Appendix — Kiwi Coach (Velocity $100k Stage 1)

*Supporting material, up to 2 pages, not counted in the 2,000-word limit. Every figure here
either traces to a cited source or to our own instrumentation; see notes.*

---

## A. Market sizing (TAM / SAM / SOM)

We size the market bottom-up from users, not from the NZ$3.6b sector figure, which is far
wider than interview practice. Revenue per user assumes an average of three months of active
job-seeking at the tested consumer price.

| Layer | Who | Basis | Estimated annual value |
|---|---|---|---|
| **TAM** | All job seekers connected to NZ tertiary education | ~150,000 graduating or job-seeking students per year × ~NZ$75 (3 months at the low end of the NZ$19–29 band, blended with institutional seats) | **~NZ$11m/year** |
| **SAM** | International + early-career **CS/IT** job seekers in NZ | ~20,000/year (CS/IT share of the tertiary job-seeking pool, weighted to international students, who were 85% of our survey) × ~NZ$75 | **~NZ$1.5m/year** |
| **SOM (year 1)** | 1–2 university pilots | 50–100 students via one or two career/international offices, first cohort free-to-low-cost, converting to one paid institutional licence | **NZ$5k–15k**, plus direct consumer subscriptions |

*Assumptions to test:* the CS/IT share of the job-seeking pool, average months of active use,
and the split between institutional seats and direct subscription. The student counts derive
from the enrolment figures in the entry (Reuters, 2025); the per-user value derives from our
own price test (Appendix C). These are estimates, presented with their arithmetic so they can
be challenged.

---

## B. Competitor comparison

| Product | What it does | Real-time in-interview help? | NZ localisation? | Approx. price* |
|---|---|---|---|---|
| ChatGPT / Gemini (generic) | Simulates interviews from a prompt | No | No | Free–US$20/mo |
| Big Interview | Structured practice + delivery coaching | No | No | ~US$35/mo or ~US$155/yr |
| Huru | Practice + AI feedback, job-post questions | No | No | Freemium + subscription |
| Verve AI / Final Round AI | Feeds answers **during** live interviews | Yes | No | ~US$25–90+/mo |
| Interview Sidekick | Live-interview assistant | Yes | No | Subscription |
| **Kiwi Coach** | Decodes hiring intent, maps CV evidence, checks whether the answer fit the question | **No — by design** | **Yes** | **NZ$19–29/mo** |

\* *Third-party prices vary widely by source and change often; **re-verify before submitting**.
Directionally, coaching competitors sit at US$25–90+/month (≈ NZ$40–150), well above our tested
NZ$19–29 band. Two axes set us apart: we coach before the interview rather than assisting during
it, and we are built for the New Zealand context (Tall Poppy framing, local hiring norms) that
global tools ignore.*

---

## C. Unit economics (measured, not estimated)

From our own token-usage and speech instrumentation over live testing:

| Metric | Value | Source |
|---|---|---|
| Mean provider cost / voice session | **NZ$0.31** | `aiusageevents`, 25 voice sessions |
| Of which speech (STT + TTS) | 82% | same |
| Most expensive single session | NZ$0.96 | same |
| Recorded interview turns / transcripts | 324 / 57 | `sessiontranscripts` |
| Price test: NZ$19 / NZ$29 / NZ$39 | 95% / 65% / 30% likely-to-buy | survey (n=20) |

**Illustrative margin:** at NZ$19/month and ten voice sessions, direct provider cost ≈ NZ$3.10,
a gross margin near 84% before fixed costs (hosting, storage, monitoring, privacy/security).
*Note: ElevenLabs pricing is not yet configured in our instrumentation, so voice cost is
marginally understated; Azure Speech is the dominant measured driver.*

---

## D. Twelve-month milestones

Structured so Seed Capital could be released against milestones (per Rules 12.2).

| Quarter | Milestone | Evidence it produces |
|---|---|---|
| Q1 | Incorporate in NZ; privacy/data-location review; recalibrate report QA and generate a clean pass-rate baseline | Company registered; QA pass rate |
| Q2 | First university pilot (50–100 students) via one career/international office | Completion rate, usefulness ratings, per-session cost at scale |
| Q3 | Ship Question-Intent & Clarification layer (from the Auckland Eye feedback); convert one pilot to a paid institutional licence | First institutional revenue |
| Q4 | Second institution or training-provider (Dev Academy / Mission Ready) deal; direct-subscription launch | Second paying channel; stated-vs-actual willingness-to-pay data |

---

## E. Prototype

The working prototype runs the full path described in the Solution section. *[Insert 2–4
screenshots or a demo link: CV review, role-intent review, a voice interview turn, and a
grounded report.]*

---

### Source notes
- Enrolment / sector figures: Reuters, 14 Jul 2025.
- Cost, session, transcript figures: our production database, extracted 21 Jul 2026 via
  `backend/scripts/velocityTraction.mjs` (read-only).
- Survey figures: n=21 responses, 20 complete; convenience sample recruited through our own
  network (a stated limitation).
- Competitor prices: third-party sources, July 2026 — **re-verify at submission.**
