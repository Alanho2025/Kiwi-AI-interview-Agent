/**
 * NZ workplace communication dimensions configuration.
 * Each dimension defines observable interview behaviours for NZ workplace fit coaching.
 */

export const DIMENSIONS = [
    {
        id: 'friendly_professional',
        label: 'Friendly professional communication',
        positive: [
            /\b(thanks|thank you|appreciate|happy to|sure|good question)\b/i,
            /\b(clear|brief|concise|explain|summaris[ez]e|walk through)\b/i,
        ],
        gap: [
            /\b(whatever|idk|nah|obviously|just simple)\b/i,
        ],
        strength: 'Your tone sounded approachable while still staying work-focused.',
        gapText: 'Make the answer sound more approachable and professional instead of abrupt or overly casual.',
    },
    {
        id: 'teamwork',
        label: 'Teamwork and shared outcomes',
        positive: [
            /\b(team|teammate|colleague|stakeholder|designer|product owner|manager)\b/i,
            /\b(collaborat|worked with|aligned|shared goal|reviewed with|checked with|paired|handoff)\b/i,
        ],
        gap: [
            /\b(i did everything|all by myself|full system myself|without anyone|only me)\b/i,
        ],
        strength: 'You showed that your work connected to team goals and other people.',
        gapText: 'Balance your personal contribution with how you worked with others and supported a shared result.',
    },
    {
        id: 'humility_confidence',
        label: 'Humility with confidence',
        positive: [
            /\b(i led|i owned|i was responsible|my role was|i contributed|i helped)\b/i,
            /\b(result|outcome|improved|reduced|increased|measured|validated|evidence)\b/i,
        ],
        gap: [
            /\b(best|perfect|expert in everything|obvious|easy for me|single-handedly)\b/i,
            /\b(i did everything|all by myself|full system myself|only me)\b/i,
        ],
        strength: 'You showed confidence through evidence rather than unsupported self-promotion.',
        gapText: 'Use evidence to show confidence, and avoid wording that sounds like over-claiming or solo heroics.',
    },
    {
        id: 'initiative',
        label: 'Initiative',
        positive: [
            /\b(identified|noticed|proposed|suggested|initiated|took initiative|improved|automated|started|created)\b/i,
            /\b(proactively|without being asked|picked up|took ownership)\b/i,
        ],
        gap: [],
        strength: 'You gave evidence of noticing a need and acting on it.',
        gapText: 'Add one moment where you noticed a problem, proposed a next step, or took ownership without waiting for detailed instructions.',
    },
    {
        id: 'open_communication',
        label: 'Open communication',
        positive: [
            /\b(discussed|asked|clarified|explained|documented|feedback|review|checked|aligned|transparent)\b/i,
            /\b(make sure|made sure|shared context|kept .* informed)\b/i,
        ],
        gap: [],
        strength: 'You showed a willingness to communicate clearly and check understanding.',
        gapText: 'Show how you communicated decisions, asked for feedback, or clarified expectations.',
    },
    {
        id: 'manaakitanga',
        label: 'Care and respect for others',
        positive: [
            /\b(support|helped|mentor|onboard|respect|care|user|customer|accessible|inclusive)\b/i,
            /\b(made .* easier|reduced friction|unblocked|listened)\b/i,
        ],
        gap: [],
        strength: 'You showed care for users, teammates, or stakeholders through practical support.',
        gapText: 'Add how your actions supported another person, user, teammate, or stakeholder respectfully.',
    },
    {
        id: 'whanaungatanga',
        label: 'Relationship building',
        positive: [
            /\b(trust|relationship|rapport|belonging|stakeholder|shared understanding|shared goal)\b/i,
            /\b(built trust|kept .* aligned|worked closely|regular check-ins)\b/i,
        ],
        gap: [],
        strength: 'You showed relationship-building through trust, alignment, or reciprocal collaboration.',
        gapText: 'Add how you built trust or kept relationships strong while solving the problem.',
    },
    {
        id: 'wellbeing_awareness',
        label: 'Wellbeing and sustainable work',
        positive: [
            /\b(prioritis[ez]ed|scope|sustainable|workload|balance|burnout|manageable|handover|planned)\b/i,
            /\b(deprioritis[ez]ed|timebox|realistic deadline|shared the load)\b/i,
        ],
        gap: [
            /\b(24\/7|all night every night|never sleep|work nonstop|always overtime)\b/i,
        ],
        strength: 'You showed awareness of sustainable delivery and realistic workload management.',
        gapText: 'Avoid presenting constant overwork as a strength; show how you deliver sustainably and manage trade-offs.',
    },
];

// Made with Bob
