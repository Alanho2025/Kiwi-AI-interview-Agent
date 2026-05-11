/**
 * NZ Culture Interview Question Bank.
 *
 * Curated behavioural and situational questions mapped to NZ workplace culture
 * dimensions. Each question includes scoring criteria, a model answer showing
 * what NZ employers value, and anti-pattern keywords for detection.
 *
 * Used by:
 * - questionPlanService.js → injects 2–3 NZ questions into the behavioural stage
 * - nzWorkplaceFitService.js → references scoring criteria during transcript analysis
 * - voice agent prompts → provides follow-up anchors for NZ coaching
 */

export const NZ_QUESTIONS_VERSION = '2026-05-12-v1';

export const NZ_CULTURE_QUESTIONS = [
  // ─── Manaakitanga (Care & Respect) ──────────────────────
  {
    id: 'nz_manaaki_01',
    dimension: 'manaakitanga',
    stage: 'behavioural',
    difficulty: 'junior',
    question: 'Tell me about a time you helped a colleague who was struggling with something at work.',
    followUp: 'What specifically did you do, and how did it affect your own workload?',
    scoringCriteria: [
      'Describes a specific, genuine act of support',
      'Shows empathy and awareness of the other person\'s situation',
      'Balances helping others with own responsibilities',
      'Mentions the positive outcome for the colleague or team',
    ],
    modelAnswer:
      'A junior developer was stuck on a database migration that kept failing silently. I sat with them for an hour, walked through the logs together, and we found the issue was a missing index. I also set up a shared troubleshooting doc so the team could reference it in the future. It cost me an hour, but it saved them a day and the doc helped two more people later that month.',
    antiPatternKeywords: ['not my problem', 'they should have known', 'I was too busy'],
  },
  {
    id: 'nz_manaaki_02',
    dimension: 'manaakitanga',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'How do you make sure the people you work with — whether teammates, users, or stakeholders — feel respected and valued?',
    followUp: 'Can you give a specific example where this made a difference to the outcome?',
    scoringCriteria: [
      'Shows deliberate actions, not just good intentions',
      'Mentions listening, acknowledging, or including others',
      'Demonstrates care for people beyond just completing tasks',
      'Connects care to better outcomes',
    ],
    modelAnswer:
      'When gathering requirements from a non-technical stakeholder, I always start by acknowledging their expertise in their domain. I ask them to walk me through their workflow before suggesting changes. In one project, this approach uncovered a critical edge case that our team had completely missed, because the stakeholder felt comfortable sharing details they might not have raised in a formal meeting.',
    antiPatternKeywords: ['I told them', 'they just needed to understand', 'I didn\'t have time'],
  },
  {
    id: 'nz_manaaki_03',
    dimension: 'manaakitanga',
    stage: 'behavioural',
    difficulty: 'senior',
    question: 'Describe a situation where you had to deliver difficult feedback or bad news to someone. How did you handle it?',
    followUp: 'How did you ensure the person\'s dignity was maintained throughout?',
    scoringCriteria: [
      'Shows empathy and consideration in delivery',
      'Maintains the person\'s mana (dignity)',
      'Balances honesty with care',
      'Focuses on growth rather than blame',
    ],
    modelAnswer:
      'I had to tell a team member their code review practices were creating a bottleneck. Instead of calling it out publicly, I had a private coffee chat, framed it as a process issue rather than a personal failing, and suggested we pair on reviews for a week so I could share some shortcuts. They appreciated the approach and their review turnaround improved significantly.',
    antiPatternKeywords: ['I called them out', 'embarrassed', 'publicly', 'blamed'],
  },

  // ─── Whānaungatanga (Relationship Building) ─────────────
  {
    id: 'nz_whanau_01',
    dimension: 'whanaungatanga',
    stage: 'behavioural',
    difficulty: 'junior',
    question: 'Can you describe a time when you built a strong working relationship with someone from a different background or team?',
    followUp: 'What did you do specifically to build trust?',
    scoringCriteria: [
      'Mentions specific actions taken to build rapport',
      'Shows awareness of diverse perspectives',
      'Describes mutual benefit or shared outcome',
      'Avoids framing it as purely transactional',
    ],
    modelAnswer:
      'When I joined a cross-functional project, I made a point of having one-on-one catch-ups with each team member to understand their priorities. With our designer, who had a very different working style, I suggested we do informal whiteboard sessions instead of formal review meetings. That built a rapport that made our collaboration much smoother when we hit disagreements later.',
    antiPatternKeywords: ['I managed them', 'I told them what to do', 'they needed my help'],
  },
  {
    id: 'nz_whanau_02',
    dimension: 'whanaungatanga',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'Tell me about a time you had a conflict or disagreement with a colleague. How did you resolve it?',
    followUp: 'What was the relationship like afterwards?',
    scoringCriteria: [
      'Shows willingness to understand the other perspective',
      'Describes a constructive resolution process',
      'Focuses on preserving the relationship, not "winning"',
      'Mentions what was learned from the experience',
    ],
    modelAnswer:
      'I disagreed with a backend developer about whether to use a NoSQL or relational database. Instead of escalating, I suggested we each write a one-page pros/cons list and present them to the team. We ended up going with their suggestion because their arguments for our specific use case were stronger. I learned to separate my preferences from the project\'s needs, and we worked together well after that.',
    antiPatternKeywords: ['I was right', 'they were wrong', 'I won', 'I escalated to management'],
  },
  {
    id: 'nz_whanau_03',
    dimension: 'whanaungatanga',
    stage: 'behavioural',
    difficulty: 'senior',
    question: 'How do you maintain relationships with stakeholders who have competing priorities?',
    followUp: 'Give me a specific example where this was challenging.',
    scoringCriteria: [
      'Shows proactive communication and transparency',
      'Balances competing needs fairly',
      'Maintains trust even when saying "no"',
      'Demonstrates ongoing relationship investment',
    ],
    modelAnswer:
      'I had two product managers who both wanted their features prioritised. I set up a shared priority matrix, walked them both through the data on user impact, and facilitated a conversation where they could hear each other\'s reasoning. We agreed on a sequence together, and both felt the process was fair even though one had to wait.',
    antiPatternKeywords: ['I just picked one', 'I avoided them', 'I let my manager decide'],
  },

  // ─── Flat Hierarchy & Approachability ───────────────────
  {
    id: 'nz_flat_01',
    dimension: 'flat_hierarchy',
    stage: 'behavioural',
    difficulty: 'junior',
    question: 'Tell me about a time you shared an idea or concern with someone more senior than you. How did it go?',
    followUp: 'What gave you the confidence to speak up?',
    scoringCriteria: [
      'Shows willingness to contribute regardless of seniority',
      'Communicates respectfully but directly',
      'Describes a constructive outcome',
      'Doesn\'t frame hierarchy as a barrier',
    ],
    modelAnswer:
      'During a sprint planning, I noticed we were estimating a feature too optimistically based on a similar ticket that had taken twice as long. I raised it with the tech lead, explained my reasoning with the historical data, and they agreed to adjust the estimate. It felt natural — the team encouraged everyone to flag concerns regardless of experience level.',
    antiPatternKeywords: ['I didn\'t want to overstep', 'I waited for permission', 'it wasn\'t my place'],
  },
  {
    id: 'nz_flat_02',
    dimension: 'flat_hierarchy',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'How do you handle giving feedback to someone who is more senior than you?',
    followUp: 'Was there a time this was particularly difficult?',
    scoringCriteria: [
      'Shows directness balanced with respect',
      'Provides specific, actionable feedback',
      'Focuses on the issue, not the person',
      'Demonstrates that hierarchy doesn\'t prevent honest communication',
    ],
    modelAnswer:
      'My team lead was consistently merging PRs without running the test suite, which caused regressions. I mentioned it privately after standup, showed them the two incidents it had caused, and suggested we add a CI check. They thanked me for flagging it and we set up the automated check that week.',
    antiPatternKeywords: ['I couldn\'t say anything', 'they\'re the boss', 'I just accepted it'],
  },

  // ─── Tall Poppy / Humility ──────────────────────────────
  {
    id: 'nz_humility_01',
    dimension: 'tall_poppy',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'Tell me about a significant achievement you\'re proud of. How did you contribute, and who else was involved?',
    followUp: 'What would you do differently if you could do it again?',
    scoringCriteria: [
      'Credits team members alongside personal contribution',
      'Uses "we" language naturally',
      'Provides evidence-based claims, not vague superlatives',
      'Shows willingness to learn or improve',
    ],
    modelAnswer:
      'I led the migration of our frontend from jQuery to React, which improved page load times by 40%. The backend team redesigned the API contract to support it, and our designer ensured the transition was seamless for users. Looking back, I would have involved QA earlier — they caught several edge cases late that we could have addressed sooner.',
    antiPatternKeywords: ['single-handedly', 'best developer', 'nobody else could', 'I did everything'],
  },
  {
    id: 'nz_humility_02',
    dimension: 'tall_poppy',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'Tell me about a mistake you made at work. How did you handle it?',
    followUp: 'What did you learn, and how did it change your approach?',
    scoringCriteria: [
      'Acknowledges the mistake honestly',
      'Takes responsibility without deflecting',
      'Describes what was learned and changed',
      'Shows vulnerability and growth mindset',
    ],
    modelAnswer:
      'I once deployed a database migration to production without testing it against our full dataset. It caused a 20-minute outage. I immediately owned the incident, coordinated the rollback, and wrote a post-mortem that led us to implement a staging environment with production-like data. I was embarrassed, but the team appreciated the transparency and the process improvement it triggered.',
    antiPatternKeywords: ['it wasn\'t my fault', 'someone else caused it', 'I never make mistakes'],
  },
  {
    id: 'nz_humility_03',
    dimension: 'tall_poppy',
    stage: 'behavioural',
    difficulty: 'senior',
    question: 'How do you balance advocating for your technical opinion while staying open to being wrong?',
    followUp: 'Can you give an example where you changed your mind based on someone else\'s input?',
    scoringCriteria: [
      'Shows strong opinions held loosely',
      'Demonstrates evidence-based decision making',
      'Values team consensus over individual ego',
      'Can describe changing their mind gracefully',
    ],
    modelAnswer:
      'I initially pushed for microservices for our new project, but a junior developer made a compelling case for starting with a modular monolith. I reviewed their reasoning, realised our team size didn\'t justify the operational overhead of microservices yet, and backed their approach. We shipped faster and the modular structure still gave us the option to split later.',
    antiPatternKeywords: ['I\'m always right', 'they didn\'t understand', 'I insisted'],
  },

  // ─── Work-Life Balance ──────────────────────────────────
  {
    id: 'nz_balance_01',
    dimension: 'work_life_balance',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'Describe a time when you had to manage competing deadlines or an overloaded sprint. How did you handle it?',
    followUp: 'How did you decide what to prioritise, and what did you deprioritise?',
    scoringCriteria: [
      'Shows proactive prioritisation over heroic overwork',
      'Mentions communication with stakeholders about trade-offs',
      'Demonstrates sustainable delivery thinking',
      'Doesn\'t glorify burnout or constant overtime',
    ],
    modelAnswer:
      'Our sprint had more work than the team could sustainably deliver. I flagged this early in planning, worked with the product owner to rank features by user impact, and we deferred two lower-priority items. The team delivered the critical features to a high standard without burning out, and we picked up the deferred work next sprint.',
    antiPatternKeywords: ['worked all night', 'never sleep', 'always overtime', '24/7'],
  },
  {
    id: 'nz_balance_02',
    dimension: 'work_life_balance',
    stage: 'behavioural',
    difficulty: 'senior',
    question: 'How do you ensure your team delivers sustainably without burning out?',
    followUp: 'Has there been a time you had to push back on unrealistic expectations?',
    scoringCriteria: [
      'Shows awareness of team wellbeing',
      'Describes concrete practices (timeboxing, scope negotiation)',
      'Demonstrates willingness to push back on unrealistic demands',
      'Values quality over speed when it matters',
    ],
    modelAnswer:
      'I noticed my team was consistently working late to meet sprint commitments. I tracked our velocity over six sprints, showed the product manager that we were over-committing by about 20%, and we agreed to reduce sprint scope. Team morale improved, our defect rate dropped, and we actually delivered more total value over the quarter because we stopped context-switching.',
    antiPatternKeywords: ['the team just needs to work harder', 'deadlines are non-negotiable', 'I push through'],
  },

  // ─── Kaitiakitanga (Guardianship) ───────────────────────
  {
    id: 'nz_kaitiaki_01',
    dimension: 'kaitiakitanga',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'Tell me about a time you improved the long-term health of a system, codebase, or process — even when there was no immediate pressure to do so.',
    followUp: 'How did you justify the investment to stakeholders?',
    scoringCriteria: [
      'Shows initiative beyond immediate requirements',
      'Demonstrates long-term thinking',
      'Balances short-term cost with long-term benefit',
      'Mentions documentation, testing, or knowledge sharing',
    ],
    modelAnswer:
      'I noticed our API had accumulated significant technical debt from rapid feature development. I proposed allocating 20% of our next sprint to refactoring the most fragile modules and adding tests. I justified it by showing the correlation between those modules and our production incident rate. After the refactoring, our incidents dropped by 60% and new feature development in those areas became noticeably faster.',
    antiPatternKeywords: ['tech debt doesn\'t matter', 'just ship it', 'documentation is a waste'],
  },
  {
    id: 'nz_kaitiaki_02',
    dimension: 'kaitiakitanga',
    stage: 'behavioural',
    difficulty: 'junior',
    question: 'How do you make sure your code is easy for others to understand and maintain after you\'ve moved on?',
    followUp: 'Can you give an example of a time this helped someone?',
    scoringCriteria: [
      'Mentions clear naming, documentation, or comments',
      'Shows consideration for future developers',
      'Describes knowledge-sharing practices',
      'Values maintainability alongside functionality',
    ],
    modelAnswer:
      'I always write README files for my modules explaining the why, not just the what. When I built a data pipeline, I included a decision log explaining why I chose certain libraries and what trade-offs I made. Three months later, a colleague who took over the project told me the decision log saved them hours of research because they understood the reasoning behind each choice.',
    antiPatternKeywords: ['the code is self-documenting', 'they\'ll figure it out', 'not my problem after I leave'],
  },

  // ─── Treaty of Waitangi Awareness ───────────────────────
  {
    id: 'nz_treaty_01',
    dimension: 'treaty_awareness',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'When designing a product or service for New Zealand users, how do you consider the diverse communities that will use it?',
    followUp: 'Have you ever adapted something specifically for a community you weren\'t personally part of?',
    scoringCriteria: [
      'Shows awareness of NZ\'s bicultural foundation',
      'Considers diverse user groups in design decisions',
      'Demonstrates cultural sensitivity without tokenism',
      'Mentions consultation or collaboration with affected communities',
    ],
    modelAnswer:
      'When we built a public-facing booking system, I advocated for including te reo Māori labels and ensuring the user flows worked for communities with lower digital literacy. I consulted with our Māori liaison team to ensure the translations were natural and respectful, not just machine-translated. We also tested with community members and made several adjustments based on their feedback.',
    antiPatternKeywords: ['everyone speaks English', 'not relevant to tech', 'just translate it'],
  },
  {
    id: 'nz_treaty_02',
    dimension: 'treaty_awareness',
    stage: 'behavioural',
    difficulty: 'senior',
    question: 'What do you understand about the Treaty of Waitangi principles, and how might they apply to technology decisions in a NZ context?',
    followUp: 'Can you give an example of how you\'ve seen — or would apply — these principles in practice?',
    scoringCriteria: [
      'Can articulate the three principles (Partnership, Participation, Protection)',
      'Connects them to practical workplace or product decisions',
      'Shows respect and genuine interest, not just surface knowledge',
      'Acknowledges what they don\'t know and willingness to learn',
    ],
    modelAnswer:
      'The Treaty principles of Partnership, Participation, and Protection mean that technology decisions in NZ — especially for government or public-facing services — should involve Māori perspectives from the start, not as an afterthought. In practice, this could mean ensuring data sovereignty, co-designing with iwi (tribal) groups, and making sure digital services are accessible and culturally appropriate. I\'m still learning, but I believe the core idea is that good design includes the people it affects.',
    antiPatternKeywords: ['doesn\'t apply to tech', 'political correctness', 'not my area'],
  },

  // ─── Kiwi Pragmatism ───────────────────────────────────
  {
    id: 'nz_pragmatism_01',
    dimension: 'pragmatism',
    stage: 'behavioural',
    difficulty: 'all',
    question: 'Tell me about a time you had to deliver a solution with limited resources, time, or tools. How did you make it work?',
    followUp: 'What trade-offs did you make, and were they the right ones?',
    scoringCriteria: [
      'Shows resourcefulness and creativity',
      'Makes deliberate trade-offs, not random shortcuts',
      'Delivers something usable, not perfect',
      'Acknowledges what was sacrificed and plans for the future',
    ],
    modelAnswer:
      'We needed a reporting dashboard but had no budget for a BI tool. I built a lightweight solution using Google Sheets as a data source with a simple React frontend. It wasn\'t architecturally perfect, but it gave stakeholders the visibility they needed within a week. I documented the limitations and we replaced it with a proper solution six months later when budget freed up.',
    antiPatternKeywords: ['I refused to work without proper tools', 'it has to be perfect', 'I waited for approval'],
  },
  {
    id: 'nz_pragmatism_02',
    dimension: 'pragmatism',
    stage: 'behavioural',
    difficulty: 'junior',
    question: 'Describe a situation where you had to learn something new quickly to solve a problem. How did you approach it?',
    followUp: 'How did you know when you\'d learned enough to start building?',
    scoringCriteria: [
      'Shows self-directed learning ability',
      'Balances learning with shipping',
      'Demonstrates practical, iterative approach',
      'Mentions resources used and time management',
    ],
    modelAnswer:
      'I needed to add WebSocket support to our app but had never used them before. I spent half a day reading the docs and building a minimal prototype, then integrated it incrementally. I asked a senior colleague to review my approach after the first working version rather than trying to learn everything upfront. The feature shipped on time and the code review caught one issue I\'d missed.',
    antiPatternKeywords: ['I need formal training first', 'I can\'t work with unfamiliar tech', 'I waited until I fully understood'],
  },
  {
    id: 'nz_pragmatism_03',
    dimension: 'pragmatism',
    stage: 'behavioural',
    difficulty: 'senior',
    question: 'How do you decide when to build something quick and scrappy versus investing in a more robust solution?',
    followUp: 'Give me an example of each approach and why you chose it.',
    scoringCriteria: [
      'Articulates clear decision criteria (risk, reversibility, user impact)',
      'Shows awareness of context-dependent trade-offs',
      'Doesn\'t default to either extreme',
      'Communicates trade-offs to stakeholders',
    ],
    modelAnswer:
      'For an internal admin tool used by five people, I built a quick script with a basic UI — it took two days and solved the problem. For our customer-facing checkout flow, I invested three weeks in proper error handling, accessibility, and load testing because the cost of failure was much higher. The key question I ask is: what\'s the blast radius if this breaks?',
    antiPatternKeywords: ['always build it properly', 'always move fast', 'quality doesn\'t matter'],
  },
];

/**
 * Pick NZ culture questions matching the given difficulty level.
 * Returns questions shuffled and limited to the requested count.
 */
export function pickNzCultureQuestions({ difficulty = 'all', count = 3, excludeIds = [] } = {}) {
  const eligible = NZ_CULTURE_QUESTIONS.filter(
    (q) => (q.difficulty === difficulty || q.difficulty === 'all') && !excludeIds.includes(q.id),
  );

  // Shuffle using Fisher-Yates
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Ensure diversity across dimensions — pick at most one per dimension
  const picked = [];
  const usedDimensions = new Set();
  for (const q of shuffled) {
    if (picked.length >= count) break;
    if (usedDimensions.has(q.dimension)) continue;
    usedDimensions.add(q.dimension);
    picked.push(q);
  }

  return picked;
}

/**
 * Get all question IDs for a specific dimension.
 */
export function getQuestionsByDimension(dimensionId) {
  return NZ_CULTURE_QUESTIONS.filter((q) => q.dimension === dimensionId);
}
