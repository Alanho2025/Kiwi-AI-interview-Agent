# Kiwi Coach — Velocity $100k Stage 1 (submission-ready)

*Paste each block into the matching field on grantplatform.com. The three short fields go in
their own boxes; the seven sections are the 2,000-word entry. Do not paste this heading or the
italic notes.*

> **Word counts (checked 2026-07-23):** pitch = 49 words. Entry body = 2,038 words without the
> section headings, ~2,054 with them. If the platform gives you one big text box that counts the
> headings, either drop the headings or trim ~55 words (start with the Business Model section).
> If it gives a field per section, the headings don't count and you are safely under. **Always
> re-check inside grantplatform — its tokeniser may differ from ours.**

---

## Entry title (max 4 words)

Kiwi Coach: Role-Fit Interview Practice

*(If the counter rejects it, use: Role-Fit Interview Coach)*

---

## High-level pitch (max 50 words — public)

Kiwi Coach is a New Zealand interview practice tool for international students and graduates. It works out what an employer is testing for, maps your CV evidence to it, and checks whether each practice answer fit the question — coaching you before the interview, not feeding you lines during it.

---

## Entry (2,000-word limit — the seven sections below)

### Executive Summary

Every job seeker is told to use relevant examples. Almost none can tell whether the one they picked proves anything about the job in front of them, and the people who could tell them charge NZ$150 an hour, which had priced out all twenty we surveyed.

Kiwi Coach works out why a role exists before it asks a question: it reads the job description and company context, infers what the employer is testing for, builds practice around the candidate's own CV evidence, then judges each answer against the question it was meant to answer. Other tools grade how an answer sounds; we grade whether it was the right one, before the interview rather than during it.

We start with international students and graduates chasing CS and IT roles, where the problem bites hardest, and widen from there; university career offices are the customer we expect to pay. The working prototype is in early testing. The insight it turns on came from a hiring manager who interviewed one of us, then tried our software: fluent delivery, wrong question.

### Problem Statement

Interview advice is not scarce in New Zealand. Universities and public career services already tell candidates to research the employer, structure answers with STAR, and connect their experience back to the role (University of Auckland, n.d.; Tahatū, 2025). But advice like this has to stay general to be useful to everyone, while an interview is always specific. A candidate can follow all of it and still not know whether their example proves anything to the person across the table.

This hurts international students and recent graduates most. We surveyed 21 computer science and IT job seekers in Auckland, 20 of whom finished: 85% were international students looking for graduate roles or internships, and just over half had less than a year of experience.

Every respondent said they had avoided professional coaching because of the cost, and practised alone instead. Preparation is not being skipped, just done without anyone qualified to say whether it is working. Nor does a general-purpose AI close the gap. Half our respondents said tools like ChatGPT know nothing about the New Zealand context or what counts as cultural fit here, and another 30% found the feedback too shallow for real technical critique.

The barriers they named were mostly cultural. Seventy percent worried that hesitation and repetition in English would obscure what they meant. Fifty-five percent feared that talking up their achievements would sound arrogant, which in New Zealand has a name: Tall Poppy Syndrome. Forty percent could not retell an overseas project so it landed with a local employer.

One real interview then focused us on a blind spot the advice above never mentions. The data and AI lead at Auckland Eye, the country's largest ophthalmology group, interviewed one of us for a role and afterwards tried our prototype. His verdict was the same both times: fluent, well organised answers to a question he had not asked, because the candidate had settled on one reading of an ambiguous question instead of checking first. This is one interview, not a dataset, and we are gathering more employer feedback; but tools that grade structure and delivery tend to miss the fault, because the structure is fine. A well-formed STAR answer to the wrong question still fails.

The problem is not that people practise too little. It is that there is no affordable way to find out, before it counts, whether you understood what the employer was testing and chose evidence that proves it.

### Solution

Kiwi Coach begins where most tools stop. Before asking anything it reads the job description and company context and works out why the role exists: the business problem behind it, what an employer would want evidence of, and where they are likely to push. It then works through the candidate's CV to build a proof strategy — which experiences prove fit, which gaps need explaining, which to avoid. Practice questions come out of that strategy rather than a generic bank, run by text or voice, and follow up on what the candidate says. The report judges each answer against the question it was meant to answer.

The prototype runs that whole path today, from CV parsing with a human review step through to a grounded report. Testing has produced 324 recorded interview turns across 57 transcripts, 41% with our New Zealand culture-fit mode enabled. Early testers told us it was the first time they noticed an answer drifting from what the interviewer was actually asking — we are now instrumenting that as a measurable signal, not an impression. One rule holds the reporting together: every claim has to trace back to something the candidate actually said, and a report that cannot meet that bar is held back rather than sent.

Alternatives exist but solve different problems. General assistants like ChatGPT will run a mock interview, but quality depends on the user's prompt and the feedback stays vague, the complaint 30% of our respondents made. Big Interview and Huru do structured practice and coach delivery, scoring how an answer sounds. Verve AI and Final Round AI have gone the other way, feeding candidates answers during the real interview. What none of them ask is whether it was the right answer, and that is the gap we build for. It is also why we stay out of the room: feeding someone answers mid-interview is cheating whatever the marketing calls it.

Our defensibility is not the model, since anyone can call a model. It is what accumulates underneath: a schema for decoding hiring intent, a growing labelled set of question-and-answer alignments, and local coaching knowledge global products have no reason to build. The more sessions run, the better we know which evidence proves which role, and that is not something a new entrant can buy.

### Market Opportunity and Customer Validation

The problem is not specific to one field: every job seeker has to translate their experience into evidence for a particular role. We start with international students and graduates in computer science and IT — 85% of our survey, and the group feeling both barriers most sharply — then widen to job seekers across disciplines, including new migrants. The people we expect to pay are university career and international offices, accountable for graduate outcomes across every faculty and unable to scale one-to-one coaching.

The sector is being grown deliberately. New Zealand's international education market was worth NZ$3.6 billion in 2024 and the government targets NZ$7.2 billion by 2034, with enrolments rising from 83,700 to 119,000 over the same period (Reuters, 2025). Institutional buyers are few and concentrated, keeping acquisition cost low. Appendix A sets out our TAM, SAM and first-year SOM.

We tested the idea three ways. The survey established the cost barrier, the cultural pain points and what people will pay. Six peer teams of postgraduate IT students used the prototype and returned structured critiques; they are in our target segment, though recruited through our own network, which limits how independent the sample is. We also demonstrated at two job-seeker meetups, of about 40 and 15 attendees.

Each changed something. The employer feedback mattered most: it showed we coached people to answer well without checking whether they had understood the question, shifting our roadmap towards question intent — spotting ambiguity, surfacing unnoticed assumptions, and knowing when to clarify before answering. The meetups raised a different worry, that AI feedback which rewrites answers takes the candidate's voice with it, a concern with research behind it (Hwang et al., 2024), so we judge whether an answer works instead of supplying the words. Peer testing flagged latency as the risk that decides whether voice practice feels real.

What we have not tested is whether an institution will pay. Ninety-five percent of those surveyed said free university access would improve their confidence, but no university has been asked for money. The next step is a pilot with one or two career or international offices covering 50 to 100 students, measuring completion, usefulness, and whether the office funds a second cohort.

### Business Model

For a job seeker, Kiwi Coach stands in for a NZ$150 hour they were never going to book. For a university it extends employability support past the hours an adviser can cover, and shows where students are losing interviews. That has commercial weight rather than goodwill: graduate outcomes feed institutional reputation, reputation feeds international enrolments, and enrolments are what the sector has been told to grow. Career offices are measured on something they cannot scale.

Most revenue should come from institutional cohort licences: a university funds access for a cohort for a semester, then moves to an annual licence once usage justifies it. A direct subscription runs alongside, both for job seekers outside partner institutions and to learn whether people will actually pay.

We approach buyers in the order they can be closed. Student associations and the meetups where we already demonstrate cost nothing and are exactly our segment. Private training providers such as Dev Academy and Mission Ready advertise graduate placement rates of 86% and above, so interview readiness feeds the number they sell on and they decide in weeks, not budget cycles. University offices are slowest and largest.

Our largest assumption is that a university will pay at all — untested, and the primary target of the pilot above, which we are preparing to launch rather than treating as settled. Two ride alongside it: that students finish sessions, and that role-fit feedback beats free generic AI.

### Financial Considerations

We measure what a session costs rather than estimating it. Across 25 voice sessions the mean provider cost was NZ$0.31, of which 82% is speech recognition and synthesis and the rest is language-model work; the most expensive single session came to NZ$0.96. Above that sit hosting, storage, monitoring and the privacy work that CVs and transcripts demand.

We tested three prices. At NZ$19 a month, 95% said they would likely or definitely buy; at NZ$29, 65%; at NZ$39, only 30%. Demand falls away sharply above NZ$29, which puts consumer pricing in the NZ$19 to NZ$29 band. Forty percent would rather pay per session, at around NZ$5 for half an hour, so we intend to offer both. Institutional seats will price below the consumer rate at volume.

At NZ$19 a month and ten voice sessions, direct provider cost is roughly NZ$3.10, a gross margin near 84% before fixed costs. Whether it holds depends on heavy users not eroding it — which is why voice minutes are capped during pilots — and on institutional renewal turning on student outcomes rather than raw usage.

### Founding Team

Alan Ho, our lead contact, and Yuning Fan are both studying for a Master of Information Technology at the University of Auckland.

Alan built the core: the voice pipeline, job description and role intent decoding, the CV-to-role matching engine, adaptive interview control, and the evaluation harness. Yuning owns the trust and commercial layer — the report QA and repair loop, the STARR scoring rubric and its explanation service, transcript-grounded quote analysis, the New Zealand workplace culture knowledge base, the token-usage instrumentation the cost figures above come from, and the landing and pricing surfaces.

We are well placed for an unusual reason: we are also the customer. Both of us are international students looking for CS and IT work here, and the insight this venture turns on came from one of our own interviews.

Our gaps are commercial rather than technical: we have never sold to an institution, our handling of CVs and interview transcripts has not been reviewed against institutional privacy requirements, and every user we researched came through our own network. We are closing these rather than waiting: we have booked a CIE start-up advice session, are seeking an introduction to a University of Auckland career office to scope the pilot, and are forming a small advisory group — a career adviser we already talk to, and the Auckland Eye data and AI lead on the employer side. On privacy, we are reviewing data location and retention before any pilot, the first question an institutional buyer asks.

---

## References (put in the appendix, not the 2,000-word body)

- Hwang, A. H.-C., Liao, Q. V., Blodgett, S. L., Olteanu, A., & Trischler, A. (2024). "It was 80% me, 20% AI": Seeking authenticity in co-writing with large language models. arXiv:2411.13032
- Reuters (2025, 14 July). New Zealand aims to double foreign international education market by 2034.
- Tahatū (2025). Tips for interviews. tahatu.govt.nz
- University of Auckland (n.d.). Interviews. Careers Centre.

*Verify each reference opens and supports its claim before submitting. Confirm the Hwang et al. arXiv ID.*
