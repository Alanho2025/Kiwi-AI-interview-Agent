import { analyzeTurnStructure } from './src/services/report/turnRubricService.js';

const structure = analyzeTurnStructure({
  question: 'How would you validate a production model before release?',
  answer: 'I enjoy collaborative workplaces and friendly teams where people communicate openly and share ideas. My previous colleagues were supportive, and we held regular meetings about general priorities and upcoming social activities every week.',
  metadata: {
    questionFamily: 'role_specific',
    evidenceMode: 'process_reasoning',
    capabilityGroup: 'technical_or_tool_skill',
  },
});

console.log(JSON.stringify(structure.frameworkBreakdown.dimensions, null, 2));
