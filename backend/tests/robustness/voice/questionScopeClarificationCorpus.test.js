import { describe, expect, it } from 'vitest';

import { resolveQuestionScopeObservation } from '../../../src/services/voice/questionScopeClarificationService.js';

const activeQuestion = {
  role: 'ai',
  text: 'Tell me about a project where you improved a business process.',
  questionId: 'question-holdout',
  metadata: {
    turnType: 'interview_question',
    countsAsQuestion: true,
    ambiguityMode: 'none',
  },
};

const classify = (candidateText) => resolveQuestionScopeObservation({
  session: { transcript: [activeQuestion] },
  candidateText,
});

const POSITIVE_HOLDOUT = [
  ['Would you say the question again please', 'request_repeat'],
  ['Could you repeat that again', 'request_repeat'],
  ['I missed it, can you repeat the question', 'request_repeat'],
  ['Can you ask it more simply', 'request_shorter_question'],
  ['Please make that shorter', 'request_shorter_question'],
  ['Could you make the question clearer', 'request_shorter_question'],
  ['What kind of example should I use', 'ask_example_type'],
  ['Could you provide an example', 'ask_example_type'],
  ['Can you give me an example', 'ask_example_type'],
  ['Could you rephrase the question', 'request_rephrase'],
  ['Say that in another way', 'request_rephrase'],
  ['Put it a different way', 'request_rephrase'],
  ['What do you mean by that', 'ask_question_meaning'],
  ['What does the question mean', 'ask_question_meaning'],
  ['What were you asking', 'ask_question_meaning'],
  ["I can't follow", 'did_not_understand'],
  ['I do not really understand', 'did_not_understand'],
  ["Not sure what you're asking", 'did_not_understand'],
  ['Can you speak more slowly', 'request_slower_delivery'],
  ['Please slow down', 'request_slower_delivery'],
  ["You're speaking too fast", 'request_slower_delivery'],
  ['Which area should I focus on', 'ask_focus_or_scope'],
  ['What scope do you want', 'ask_focus_or_scope'],
  ['Is this focused on my latest role', 'ask_focus_or_scope'],
  ['What period should I use', 'ask_timeframe'],
  ['How recent should the example be', 'ask_timeframe'],
  ['Does it need to be from my current role', 'ask_timeframe'],
  ['So are you asking me to explain my own role', 'confirm_candidate_understanding'],
  ['Have I understood the question correctly', 'confirm_candidate_understanding'],
  ['Is the question asking for one example', 'confirm_candidate_understanding'],
  ['That was very complicated', 'question_too_complex'],
  ['There were too many parts', 'question_too_complex'],
  ['Too many things in that question', 'question_too_complex'],
  ['That was quite wordy', 'question_too_long'],
  ['The question had too many words', 'question_too_long'],
  ['That is too long', 'question_too_long'],
  ['That question is very vague', 'question_too_ambiguous'],
  ['I am not sure how to interpret that', 'question_too_ambiguous'],
  ['This feels too broad', 'question_too_ambiguous'],
  ['I need help with that question', 'uncertain_help_request'],
  ['I do not know where to start', 'uncertain_help_request'],
  ["I'm not sure how to answer", 'uncertain_help_request'],
  ['Can you break that down', 'request_shorter_question'],
  ['Please be more specific', 'question_too_ambiguous'],
  ['Can you unpack the question', 'request_rephrase'],
  ['What exactly should I cover', 'ask_focus_or_scope'],
  ['Could you simplify that', 'request_shorter_question'],
  ["It is unclear what you're looking for", 'did_not_understand'],
];

const SUBSTANTIVE_ANSWER_NEGATIVES = [
  'I clarified the requirements with finance, built the workflow, and measured a 20 percent reduction in rework.',
  'I focused on the customer onboarding problem and mapped each failure point before changing the process.',
  'I repeated the validation in staging and production before releasing the change.',
  'The scope was ambiguous, so I documented an assumption and confirmed it with the product owner.',
  'I explained the question to my team before we agreed on the delivery plan.',
  'I gave the team an example of the expected output and then reviewed their first iteration.',
  'I shortened the reporting cycle from five days to two by automating reconciliation.',
  'I made the acceptance criteria clearer and reduced reopened tickets by 30 percent.',
  'I asked the stakeholder what the metric meant, then aligned the dashboard definition across teams.',
  'I could not use the legacy API, so I designed an adapter and verified backward compatibility.',
  'I did not understand the first data extract, so I profiled it and found three malformed fields.',
  'I was not sure how to interpret the error rate, so I compared it with the raw event count.',
  'I chose a recent example from my current role where I owned the migration plan.',
  'The timeframe was six weeks, and I delivered the first usable release in week four.',
  'I spoke more slowly during training and used checkpoints to confirm the audience was following.',
  'I rephrased the policy for non-technical staff and tested comprehension with a short exercise.',
  'I made the design simpler by removing two unnecessary approval steps.',
  'I reduced a long incident handover to a one-page checklist and verified it during the next outage.',
  'I handled a complex migration by separating data, API, and rollout risks.',
  'I converted a broad goal into three measurable milestones with named owners.',
  'I confirmed my understanding with the hiring manager, then drafted the delivery plan.',
  'I asked for one concrete example from support and used it to reproduce the defect.',
  'I reviewed which area had the highest failure rate and focused the first experiment there.',
  'I compared two periods and found the improvement was sustained for three months.',
  'I helped a new engineer start by pairing on one real ticket and writing a runbook.',
  'I repeated the question in the workshop so every participant worked from the same prompt.',
  'I clarified who owned the decision, but I retained responsibility for the implementation result.',
  'I explained what the metric meant and why it mattered to revenue.',
  'I followed the incident timeline, identified the slow database query, and added an index.',
  'I used an example from a previous role, stated the limitation, and connected it to this context.',
  'I made the presentation shorter after testing it with two non-technical reviewers.',
  'I interpreted the ambiguous requirement as a reporting need and explicitly recorded that assumption.',
  'I asked whether the timeframe could move, negotiated the dependency, and still met the launch date.',
  'I provided an example, the action I owned, and the measured result.',
  'I scoped the first release to one market and expanded after the success criteria passed.',
  'I reviewed the long query, split it into stages, and reduced execution time.',
  'I simplified a complicated approval flow without removing the risk controls.',
  'I helped the team understand the objective by connecting it to a customer complaint.',
  'I focused on my personal contribution: I designed the test plan and led the rollout.',
  'I confirmed the question with the stakeholder during discovery and documented the decision.',
  'I do not know where to start, so I mapped the workflow, removed two bottlenecks, and reduced cycle time by 30 percent.',
  'The requirement was too broad, so I narrowed it to onboarding, delivered the new workflow, and measured the result.',
  'I could not follow the initial data lineage, so I mapped every source, tested the joins, and fixed the reporting gap.',
  'Can you clarify what conversion means? I treated it as completed checkout, built the metric, and reduced reporting errors by 20 percent.',
];

describe('voice clarification classifier corpus gates', () => {
  it('meets the reviewed paraphrase holdout recall gate', () => {
    const matches = POSITIVE_HOLDOUT.filter(([candidateText, expectedIntent]) => {
      const observation = classify(candidateText);
      return observation.kind === 'clarification_request'
        && observation.intentType === expectedIntent
        && observation.countsAsAnswer === false;
    });
    const recall = matches.length / POSITIVE_HOLDOUT.length;

    expect(POSITIVE_HOLDOUT).toHaveLength(48);
    expect(recall).toBeGreaterThanOrEqual(0.95);
  });

  it('keeps the substantive-answer false-positive rate at or below one percent', () => {
    const falsePositives = SUBSTANTIVE_ANSWER_NEGATIVES.filter((candidateText) => (
      classify(candidateText).kind !== 'none'
    ));
    const falsePositiveRate = falsePositives.length / SUBSTANTIVE_ANSWER_NEGATIVES.length;

    expect(SUBSTANTIVE_ANSWER_NEGATIVES).toHaveLength(44);
    expect(falsePositives).toEqual([]);
    expect(falsePositiveRate).toBeLessThanOrEqual(0.01);
  });
});
