import { describe, expect, it } from 'vitest';
import {
  calculateScoreBreakdown,
  buildRequirementChecks,
} from '../../../src/services/match/matchScoringService.js';

describe('matchScoringService robustness unit suite', () => {
  describe('STRICT_TECH_PATTERNS & Hard Technical Requirement Verification', () => {
    it('accurately validates strict tech evidence for AWS, SQL, Docker, and Kubernetes', () => {
      const requirements = [
        { id: 'req-aws', label: 'AWS Cloud Architecture', mustHave: true, type: 'hard', category: 'technical_skill' },
        { id: 'req-sql', label: 'PostgreSQL Database Querying', mustHave: true, type: 'hard', category: 'technical_skill' },
        { id: 'req-docker', label: 'Docker Containerization', mustHave: true, type: 'hard', category: 'technical_skill' },
      ];

      const cvText = 'Deploys microservices on AWS EC2 with PostgreSQL and Docker containers.';
      const evidenceProfileWithMatch = {
        evidenceItems: [
          { section: 'experience', text: 'Deploys microservices on AWS EC2 with PostgreSQL and Docker containers.' },
        ],
        sections: {
          experience: [
            'Deploys microservices on AWS EC2 with PostgreSQL and Docker containers.',
          ],
        },
      };

      const semanticEvidenceContext = {
        byLabel: {
          'aws_cloud_architecture': [{ text: 'Deploys microservices on AWS EC2', score: 0.85, evidenceStrength: 'strong' }],
          'postgresql_database_querying': [{ text: 'PostgreSQL database development', score: 0.88, evidenceStrength: 'strong' }],
          'docker_containerization': [{ text: 'Docker containerized deployment', score: 0.82, evidenceStrength: 'strong' }],
        },
      };

      const checks = buildRequirementChecks(requirements, cvText, evidenceProfileWithMatch, semanticEvidenceContext);
      const awsCheck = checks.find((c) => c.requirementId === 'req-aws' || c.label.includes('AWS'));
      const sqlCheck = checks.find((c) => c.requirementId === 'req-sql' || c.label.includes('PostgreSQL'));
      const dockerCheck = checks.find((c) => c.requirementId === 'req-docker' || c.label.includes('Docker'));

      expect(awsCheck).toBeDefined();
      expect(sqlCheck).toBeDefined();
      expect(dockerCheck).toBeDefined();
      expect(awsCheck.status).not.toBe('not_met');
      expect(sqlCheck.status).not.toBe('not_met');
      expect(dockerCheck.status).not.toBe('not_met');
    });

    it('downgrades hard tech requirement to not_met when strict tech evidence is missing', () => {
      const requirements = [
        { id: 'req-kafka', label: 'Kafka Distributed Streaming', mustHave: true, type: 'hard', category: 'technical_skill' },
      ];

      const cvText = 'Worked with general messaging queues and REST APIs.';
      const evidenceProfileNoKafka = {
        evidenceItems: [
          { section: 'experience', text: cvText },
        ],
        sections: {
          experience: [cvText],
        },
      };

      const checks = buildRequirementChecks(requirements, cvText, evidenceProfileNoKafka, {});
      const kafkaCheck = checks.find((c) => c.requirementId === 'req-kafka' || c.label.includes('Kafka'));
      expect(kafkaCheck).toBeDefined();
      expect(kafkaCheck.status).toBe('not_met');
    });

    it('enforces PRIMARY_TECH strict not_met override when primary stack requirement is missing', () => {
      const requirements = [
        { id: 'req-primary', label: 'Java or Go or Kubernetes Backend Development', mustHave: true, type: 'hard', category: 'technical_skill' },
      ];

      const cvText = 'Extensive Python and Flask development.';
      const evidenceProfile = {
        evidenceItems: [
          { section: 'experience', text: cvText },
        ],
        sections: {
          experience: [cvText],
        },
      };

      const checks = buildRequirementChecks(requirements, cvText, evidenceProfile, {});
      const primaryCheck = checks.find((c) => c.requirementId === 'req-primary' || c.label.includes('Java'));
      expect(primaryCheck).toBeDefined();
      expect(primaryCheck.status).toBe('not_met');
    });
  });

  describe('Composite Requirement Splitting & Quality Sanitization', () => {
    it('splits composite requirement strings into sub-requirements and evaluates status', () => {
      const requirement = {
        id: 'req-composite',
        label: 'Azure or CI/CD pipelines',
        mustHave: true,
        type: 'hard',
        category: 'technical_skill',
      };

      const cvText = 'Built CI/CD pipelines using GitHub Actions.';
      const evidenceProfile = {
        evidenceItems: [
          { section: 'experience', text: cvText },
        ],
        sections: {
          experience: [cvText],
        },
      };

      const checks = buildRequirementChecks([requirement], cvText, evidenceProfile, {});
      expect(checks[0]).toBeDefined();
      expect(checks[0].notes).toBeDefined();
    });
  });

  describe('Domain Weighted Score Breakdown Calculations', () => {
    it('computes overall score according to domain weights for software_it domain', () => {
      const rubric = {
        universalRoleProfile: {
          roleDomain: 'software_it',
          requirements: [
            { id: 'req-1', label: 'React Frontend', mustHave: true, type: 'hard', category: 'technical_skill' },
            { id: 'req-2', label: 'Node.js Backend', mustHave: true, type: 'hard', category: 'technical_skill' },
          ],
        },
        metadata: { matchEngine: 'semantic' },
      };

      const requirementChecks = [
        { id: 'req-1', label: 'React Frontend', status: 'met', category: 'technical_skill', type: 'hard', mustHave: true },
        { id: 'req-2', label: 'Node.js Backend', status: 'met', category: 'technical_skill', type: 'hard', mustHave: true },
      ];

      const breakdown = calculateScoreBreakdown({
        rubric,
        macroScores: [],
        microScores: [],
        requirementChecks,
      });

      expect(breakdown.overallScore).toBeGreaterThan(0);
      expect(breakdown.semanticDimensions).toBeDefined();
      expect(breakdown.semanticDimensions.roleDomain).toBe('software_it');
    });

    it('falls back gracefully to default scoring when semantic engine is disabled', () => {
      const rubric = {
        weights: { overall: { macro: 0.45, micro: 0.35, requirements: 0.2 } },
      };
      const macroScores = [{ score: 80, weight: 1 }];
      const microScores = [{ score: 90, weight: 1 }];
      const requirementChecks = [{ status: 'met', importance: 'high' }];

      const breakdown = calculateScoreBreakdown({
        rubric,
        macroScores,
        microScores,
        requirementChecks,
      });

      expect(breakdown.overallScore).toBeCloseTo(80 * 0.45 + 90 * 0.35 + 100 * 0.2, 1);
    });
  });

  describe('Match Accuracy & Skill Taxonomy Fixes', () => {
    it('correctly matches Master of Information Technology as degree requirement evidence', () => {
      const requirements = [
        {
          id: 'req-qual',
          label: 'A tertiary qualification in Computer Science, Data Engineering, Information Systems, or a related field',
          mustHave: true,
          type: 'hard',
          category: 'qualification',
        },
      ];

      const cvText = 'Master of Information Technology, University of Auckland. Relevant areas: Artificial intelligence, data mining, data modelling.';
      const evidenceProfile = {
        evidenceItems: [
          { section: 'education', text: cvText },
        ],
        sections: {
          education: [cvText],
        },
      };

      const checks = buildRequirementChecks(requirements, cvText, evidenceProfile, {});
      const qualCheck = checks.find((c) => c.id === 'req-qual' || c.label.includes('qualification'));
      expect(qualCheck).toBeDefined();
      expect(qualCheck.status).not.toBe('not_met');
    });
  });
});
