import { describe, expect, it } from 'vitest';

import { buildQuestionPoolFromAnalysis } from '../../../src/services/session/sessionShared.js';

const buildAnalysis = ({ topic, category, normalizedCapability = topic, roleTitle = 'Customer Service Representative' }) => ({
  jobTitle: roleTitle,
  parsedJdProfile: {
    title: roleTitle,
    roleFamily: 'general',
    universalRoleProfile: {
      roleTitle,
      industry: 'Customer service',
      requirements: [
        {
          id: 'req_1',
          text: topic,
          normalizedCapability,
          category,
          importance: 'high',
          mustHave: true,
          evidenceNeeded: `The CV should show direct evidence for ${topic}.`,
        },
      ],
    },
  },
  matchingDetails: {
    questionPlanHints: {
      mustProbeSkills: [topic],
      mustProbeBehavioural: ['communication'],
    },
  },
});

describe('role competency question planning', () => {
  it('uses role-specific competency wording for non-IT requirements', () => {
    const pool = buildQuestionPoolFromAnalysis(
      buildAnalysis({
        topic: 'Ability to handle customer complaints in a fast-paced environment',
        normalizedCapability: 'customer complaint handling',
        category: 'customer_or_stakeholder',
      }),
      { seniorityLevel: 'Junior/Grad', focusArea: 'Technical', questionLimit: 6 }
    );
    const question = pool.find((item) => item.category === 'role_competency' && item.topic.includes('customer complaints'));

    expect(question).toMatchObject({
      type: 'role_competency_core',
      sourceType: 'universal_requirement_competency',
    });
    expect(question.text).toMatch(/client, customer, referrer, or stakeholder/i);
    expect(question.text).toMatch(/what happened, what did you do, and what was the outcome/i);
    expect(question.text).not.toMatch(/project|implementation|debugging/i);
  });

  it('keeps technical wording for IT tool and platform requirements', () => {
    const topic = 'React frontend development';
    const pool = buildQuestionPoolFromAnalysis(
      buildAnalysis({ topic, category: 'technical_skill', roleTitle: 'Frontend Developer' }),
      { seniorityLevel: 'Junior/Grad', focusArea: 'Technical', questionLimit: 6 }
    );
    const question = pool.find((item) => item.category === 'technical' && item.topic === topic);

    expect(question).toMatchObject({
      type: 'technical_core',
    });
    expect(question.text).toMatch(/project where you used React frontend development/i);
  });
});
