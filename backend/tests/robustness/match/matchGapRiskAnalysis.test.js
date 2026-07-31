import { describe, expect, it } from 'vitest';
import { buildExplanation } from '../../../src/services/match/matchScoringService.js';

describe('F-15 Skill Gap & Risk Analysis Robustness Suite', () => {
  it('extracts structured gaps and risks when requirements are missing or have limited evidence', () => {
    const requirementChecks = [
      { id: 'aws', label: 'AWS Cloud Architecture', status: 'not_met', type: 'hard', importance: 'high', notes: 'missing direct proof' },
      { id: 'docker', label: 'Docker Containerization', status: 'partial', type: 'hard', importance: 'high', notes: 'project-based evidence only' },
      { id: 'react', label: 'React Frontend', status: 'met', type: 'hard', importance: 'high', evidence: ['5 years React'] },
    ];

    const cvEvidenceProfile = {
      achievements: [{ text: 'Built production dashboard' }],
    };

    const { gaps, risks, explanation } = buildExplanation({
      microScores: [{ label: 'React Frontend', score: 85, evidence: ['5 years React'] }],
      requirementChecks,
      cvEvidenceProfile,
    });

    expect(Array.isArray(gaps)).toBe(true);
    expect(Array.isArray(risks)).toBe(true);
    expect(gaps.length).toBeGreaterThan(0);

    const awsGap = gaps.find((g) => g.label.includes('AWS'));
    expect(awsGap).toBeDefined();

    expect(explanation).toBeDefined();
    expect(explanation.summary).toContain('Top matched areas');
  });

  it('identifies hard requirement risks for early ramp-up validation', () => {
    const requirementChecks = [
      { id: 'kafka', label: 'Kafka Distributed Streaming', status: 'not_met', type: 'hard', importance: 'high' },
      { id: 'comm', label: 'Commercial Experience in Production', status: 'partial', type: 'hard', importance: 'high', notes: 'May need ramp-up before owning commercial delivery' },
    ];

    const { risks } = buildExplanation({
      microScores: [],
      requirementChecks,
      cvEvidenceProfile: {},
    });

    expect(risks.length).toBeGreaterThan(0);
    const kafkaRisk = risks.find((r) => r.label.includes('Kafka'));
    expect(kafkaRisk).toBeDefined();
  });
});
