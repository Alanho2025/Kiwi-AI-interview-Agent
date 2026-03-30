# UI/UX Professionalization Proposal

This file describes proposed UI/UX improvements only. It is not an approval to implement them.

## Goals

- increase trust and product credibility
- make analysis results easier to interpret
- improve the sense of workflow continuity
- reduce low-signal actions and placeholder UI

## Problems In Current UI

- The analysis page feels like a demo flow instead of a production workflow.
- The match rate is shown without enough explanation or supporting evidence.
- The interview screen is information-dense but visually flat.
- Some actions look available even when they do not add meaningful value.

## Proposed Changes

### 1. Analysis Page

- Replace the current generic status card with a structured result panel:
- overall match score
- matched skills
- missing skills
- risk summary
- explanation of how the score was calculated

- Rework the right column actions:
- primary: `Generate Match Analysis`
- secondary: `Create Interview Session`
- tertiary: `Save Draft`

- Add a parsed CV summary preview so the user can confirm extraction quality before trusting the score.

### 2. Match Result Presentation

- Replace the single percentage tile with a score breakdown card:
- skills coverage
- keyword coverage
- requirement coverage
- seniority alignment

- Add evidence chips:
- `Matched`
- `Missing`
- `Needs verification`

### 3. Interview Workspace

- Tighten hierarchy in header:
- session title
- target role
- elapsed time
- progress

- Improve chat panel contrast and spacing.
- Add clearer separation between current question and transcript history.
- Make transcript export and interview controls feel like a professional tool panel rather than generic buttons.

### 4. Visual Direction

- Use stronger typography hierarchy.
- Reduce generic light-gray surfaces.
- Introduce more deliberate spacing rhythm.
- Use status color more sparingly so green means success, not every primary UI element.
- Improve empty states and loading states to feel product-grade rather than placeholder.

## Suggested First Implementation Slice

- Do not redesign the whole app at once.
- Start with:
- analysis result card
- match score breakdown
- interview header refinement
- transcript panel cleanup

## Approval Needed Before Implementation

Before UI changes are made, confirm:

- whether to keep the current overall brand colors
- whether to keep the current card-based layout
- whether the first slice should focus on analysis screen or interview screen
