/**
 * NZ Workplace Culture Knowledge Base.
 *
 * Structured reference data for NZ workplace values and communication norms.
 * Used by:
 * - nzWorkplaceFitService.js  → dimension descriptions, cultural context, model answers
 * - questionPlanService.js    → selecting culture-appropriate behavioural questions
 * - voice agent prompts       → NZ coaching cues during live interviews
 *
 * Sources:
 * - NZ Immigration workplace culture guidance
 * - NZ Careers (careers.govt.nz) interview advice
 * - NZ Public Service competency frameworks (Hays NZ, Robert Walters NZ)
 * - Te Arawhiti Treaty of Waitangi guidance
 * - Academic research on NZ organisational culture
 */

export const NZ_CULTURE_KB_VERSION = '2026-05-12-v1';

export const NZ_WORKPLACE_VALUES = [
  {
    id: 'manaakitanga',
    label: 'Manaakitanga — Hospitality & Care',
    shortLabel: 'Manaakitanga',
    description:
      'Showing genuine care, respect, and generosity toward others. In NZ workplaces this means being welcoming, supporting colleagues, considering the wellbeing of stakeholders, and upholding the mana (dignity) of everyone you interact with.',
    whyItMatters:
      'NZ employers expect candidates to show that they treat colleagues, customers, and stakeholders with genuine respect — not just as transactions. Interviewers look for evidence that you actively support others and create an environment where people feel valued.',
    interviewSignals: [
      'Mentioning how you supported a struggling team member',
      'Describing user or customer empathy in your decisions',
      'Showing awareness of colleague wellbeing during high-pressure periods',
      'Offering to onboard or mentor new joiners',
    ],
    exampleAnswer:
      'When a new graduate joined our team, I volunteered to be their buddy for the first month. I made sure they had context on our codebase and introduced them to key stakeholders so they felt included from day one. They later told me it made a real difference to how quickly they felt confident contributing.',
    antiPatterns: [
      'Describing purely transactional working relationships',
      'Ignoring team welfare or showing no empathy',
      'Treating users as abstract data points rather than real people',
    ],
  },
  {
    id: 'whanaungatanga',
    label: 'Whānaungatanga — Relationship Building',
    shortLabel: 'Whānaungatanga',
    description:
      'Building meaningful working relationships, a sense of belonging, and mutual trust. NZ workplaces often prioritise finding "the right fit" for the team (the whānau). The interview itself is seen as the beginning of a professional relationship, not just a transactional assessment.',
    whyItMatters:
      'NZ interviews often start with "small talk" — this is not time-wasting but active rapport-building. Employers want evidence that you invest in collaborative relationships, maintain trust, and keep people aligned, not just deliver tasks in isolation.',
    interviewSignals: [
      'Mentioning regular check-ins with teammates or stakeholders',
      'Describing how you built trust with someone from a different team or background',
      'Showing you value shared understanding over imposed direction',
      'Referencing reciprocal collaboration ("they helped me, I helped them")',
    ],
    exampleAnswer:
      'When our team hit a disagreement about the API design, I suggested we map out each person\'s concerns on a whiteboard. That helped us find common ground, and the designer told me later it was the first time she felt truly heard in a technical discussion. We built a much stronger working relationship after that.',
    antiPatterns: [
      'Only describing solo work with no mention of relationships',
      'Framing colleagues as obstacles rather than collaborators',
      'Showing impatience with rapport-building or "small talk"',
    ],
  },
  {
    id: 'flat_hierarchy',
    label: 'Flat Hierarchy & Approachability',
    shortLabel: 'Flat hierarchy',
    description:
      'NZ workplaces typically have flatter management structures than many other countries. Employees are expected to speak up regardless of seniority, address managers by first name, contribute ideas openly, and communicate directly without excessive formality.',
    whyItMatters:
      'Interviewers look for candidates who will challenge ideas constructively, share feedback upward, and not hide behind hierarchy. Overly deferential or rigid answers can signal a poor fit with NZ team culture.',
    interviewSignals: [
      'Describing a time you spoke up to a senior person',
      'Sharing feedback directly with a manager or lead',
      'Contributing ideas in meetings regardless of your seniority',
      'Comfortable with informal communication styles',
    ],
    exampleAnswer:
      'In my previous role, I noticed our deployment process had a bottleneck that the team lead hadn\'t flagged. Rather than waiting, I wrote up a quick proposal and shared it in our next standup. My lead was receptive and we implemented the change together — it cut our release cycle by a day.',
    antiPatterns: [
      'Saying "I waited for my manager to decide"',
      'Excessive formality or deference in describing team dynamics',
      'Never challenging decisions or suggesting improvements',
    ],
  },
  {
    id: 'tall_poppy',
    label: 'Tall Poppy Syndrome Awareness',
    shortLabel: 'Humility with evidence',
    description:
      'NZ culture values humility. Excessive self-promotion, bragging, or claiming sole credit is perceived negatively (the "Tall Poppy" effect). Candidates should demonstrate confidence through concrete evidence and measurable results, not superlatives or self-aggrandizement.',
    whyItMatters:
      'NZ interviewers want to see you own your achievements, but balanced with team acknowledgment and a willingness to learn. Saying "I was the best developer" will land worse than "I led the implementation and the team shipped on time with no critical bugs."',
    interviewSignals: [
      'Using "we" language naturally alongside personal contributions',
      'Providing evidence-based claims with metrics',
      'Crediting team members alongside personal role',
      'Showing willingness to learn or improve',
    ],
    exampleAnswer:
      'I led the frontend migration to React, which improved our page load times by 40%. I worked closely with the backend team to redesign the API contract, and our designer helped ensure the transition was seamless for users. There were some edge cases I missed initially, and the QA engineer caught them early — that collaboration was key to shipping a solid product.',
    antiPatterns: [
      '"I single-handedly built the entire system"',
      '"I was the best developer on the team"',
      '"Nobody else could have done this"',
      'Using superlatives without evidence',
    ],
  },
  {
    id: 'work_life_balance',
    label: 'Work-Life Balance & Sustainability',
    shortLabel: 'Work-life balance',
    description:
      'NZ strongly values sustainable work practices. Glorifying overwork, constant overtime, or "hustle culture" is viewed negatively. Employers want candidates who deliver results within reasonable boundaries and show awareness of sustainable delivery.',
    whyItMatters:
      'Presenting yourself as someone who works 24/7 is a red flag in NZ interviews. Employers want to hear about prioritisation, realistic planning, and healthy boundaries — not burnout heroics.',
    interviewSignals: [
      'Describing how you prioritised tasks under pressure',
      'Mentioning timeboxing, scoping, or sustainable delivery',
      'Showing you manage workload proactively',
      'Describing handovers or delegation for coverage',
    ],
    exampleAnswer:
      'When our sprint was overloaded, I worked with the product owner to re-prioritise and defer two lower-impact features. That let us deliver the critical items to a high standard without the team burning out. We picked up the deferred work in the next sprint and shipped everything within the quarter.',
    antiPatterns: [
      '"I worked all night every night to get it done"',
      '"I never take breaks when there\'s work to do"',
      'Presenting constant overwork as a strength',
    ],
  },
  {
    id: 'kaitiakitanga',
    label: 'Kaitiakitanga — Guardianship & Long-term Thinking',
    shortLabel: 'Kaitiakitanga',
    description:
      'Stewardship and care for things that matter long-term — systems, codebases, environments, data, and communities. In a tech context, this means writing maintainable code, considering technical debt, and thinking about the sustainability of your decisions.',
    whyItMatters:
      'NZ employers value candidates who think beyond the immediate ticket and consider the long-term health of the system, the team, and the organisation. Quick hacks are acceptable when acknowledged as tech debt, but presenting them as good practice is a red flag.',
    interviewSignals: [
      'Mentioning technical debt awareness',
      'Describing long-term impact of decisions',
      'Showing care for code quality, documentation, or knowledge sharing',
      'Considering environmental or resource sustainability',
    ],
    exampleAnswer:
      'I noticed our API had accumulated significant technical debt from rapid feature development. I proposed a "debt sprint" where we spent two weeks refactoring the most critical modules and adding tests. It slowed feature work briefly, but reduced our production incidents by 60% over the following quarter.',
    antiPatterns: [
      'Only caring about shipping speed with no quality consideration',
      'Dismissing documentation or knowledge sharing as unimportant',
      'No awareness of the downstream impact of decisions',
    ],
  },
  {
    id: 'treaty_awareness',
    label: 'Te Tiriti o Waitangi Awareness',
    shortLabel: 'Treaty awareness',
    description:
      'For NZ public sector and many large organisations, understanding Treaty of Waitangi obligations is important. The three principles — Partnership, Participation, and Protection — inform how services are designed and delivered. Candidates should show cultural competency and respect for Māori perspectives.',
    whyItMatters:
      'Public sector roles explicitly assess Treaty awareness. Even in the private sector, demonstrating cultural sensitivity and understanding of Aotearoa\'s bicultural foundation is valued. You don\'t need to be an expert — showing genuine respect and willingness to learn is enough.',
    interviewSignals: [
      'Correct pronunciation of Māori words and place names',
      'Awareness of Treaty principles (Partnership, Participation, Protection)',
      'Consideration of diverse user groups in design decisions',
      'Openness to learning tikanga (customs and protocols)',
    ],
    exampleAnswer:
      'When we designed a public-facing service, I advocated for including te reo Māori content and ensuring the user flows worked for communities with lower digital literacy. I consulted with our Māori liaison team to make sure the language was appropriate and respectful, rather than just using Google Translate.',
    antiPatterns: [
      'Dismissing Treaty obligations as irrelevant',
      'Mispronouncing Māori words without effort to learn',
      'Designing services without considering diverse NZ communities',
    ],
  },
  {
    id: 'pragmatism',
    label: 'Kiwi Pragmatism & Can-Do Attitude',
    shortLabel: 'Kiwi pragmatism',
    description:
      'The "Number 8 wire" mentality — NZ values practical, resourceful problem-solving over theoretical perfection. Showing you can get things done with limited resources, adapt quickly, and find workable solutions is highly valued.',
    whyItMatters:
      'NZ companies (especially startups and SMEs) often operate with constrained resources. Interviewers want to see that you can be pragmatic, make trade-offs intelligently, and ship working solutions rather than waiting for perfect conditions.',
    interviewSignals: [
      'Describing creative solutions with limited resources',
      'Making deliberate trade-offs between ideal and practical',
      'Adapting quickly to changing requirements',
      'Shipping iteratively rather than waiting for perfection',
    ],
    exampleAnswer:
      'We needed a reporting dashboard but didn\'t have budget for a BI tool. I built a lightweight solution using Google Sheets as a data source with a simple React frontend. It wasn\'t architecturally perfect, but it gave stakeholders the visibility they needed within a week, and we replaced it with a proper solution six months later when budget freed up.',
    antiPatterns: [
      'Refusing to work without perfect tools or conditions',
      'Over-engineering when a simpler solution would work',
      'Waiting for permission instead of taking initiative',
    ],
  },
];

/**
 * Lookup a value definition by its ID.
 */
export const findValueById = (id) => NZ_WORKPLACE_VALUES.find((v) => v.id === id) || null;

/**
 * Get all value IDs as a simple list.
 */
export const getAllValueIds = () => NZ_WORKPLACE_VALUES.map((v) => v.id);
