import { describe, expect, it } from 'vitest';
import {
  computeRequirementStatus,
  buildExplanation,
} from '../../../src/services/match/matchScoringService.js';
import { buildCvEvidenceProfile } from '../../../src/services/cv/cvEvidenceProfileBuilder.js';
import { inferCapabilitiesFromText } from '../../../src/services/match/capabilityTaxonomy.js';

describe('Match Engine Precision & Evidence Binding Robustness Suite', () => {
  it('1. Degree & Institution Extraction: evaluates Master of Information Technology, University of Auckland as met', () => {
    const cvText = `Alan Ho
Education
Master of Information Technology, University of Auckland (2022 - 2024)`;

    const cvProfile = {
      candidateName: 'Alan Ho',
      education: 'Master of Information Technology, University of Auckland (2022 - 2024)',
      sections: [
        { title: 'Education', key: 'education', content: 'Master of Information Technology, University of Auckland (2022 - 2024)' },
      ],
    };

    const cvEvidenceProfile = buildCvEvidenceProfile(cvProfile, cvText);

    const requirement = {
      id: 'req-degree',
      label: 'Master of Information Technology or related tertiary qualification',
      mustHave: true,
      type: 'hard',
      category: 'qualification',
    };

    const status = computeRequirementStatus(requirement, cvEvidenceProfile, {});
    expect(status.finalStatus).toBe('met');
    expect(status.matchedSection).toBe('education');
  });

  it('2. Evidence Misbinding Safeguards: AI/ML, Collaboration, and Documentation do not bind to Git/CI or Data Models', () => {
    const cvProfile = {
      candidateName: 'Alan Ho',
      projects: [
        {
          title: 'GitHub Repo',
          techStack: ['Git', 'CI/CD'],
          responsibilities: ['Managed git repositories and CI/CD pipelines.'],
          outcomes: ['Automated deployment.'],
        },
        {
          title: 'CV Matching App',
          techStack: ['React', 'Node.js'],
          responsibilities: ['Built linked data models for CVs and job descriptions.'],
          outcomes: ['Improved data retrieval.'],
        },
      ],
    };

    const cvEvidenceProfile = buildCvEvidenceProfile(cvProfile, '');

    const aiRequirement = {
      id: 'req-ai',
      label: 'AI/ML Engineering & LLM Agents',
      mustHave: true,
      type: 'hard',
      category: 'technical_skill',
    };

    const aiStatus = computeRequirementStatus(aiRequirement, cvEvidenceProfile, {
      byLabel: {
        'ai_ml_engineering_llm_agents': [
          { text: 'Project tech stack for GitHub: Git, CI/CD', score: 0.35, sourceType: 'project_tech_stack' },
        ],
      },
    });

    // AI/ML should not bind to Git/CI as met evidence
    expect(aiStatus.evidence.some((e) => e.includes('Git'))).toBe(false);
  });

  it('3. Problem Solving & Engineering Evidence: extracts problem_solving and attention_to_detail from DOE and failure analysis', () => {
    const engineeringText = `Foxconn Senior Engineer
- Designed design of experiments (DOE) and structured failure analysis for test stations.
- Identified test-station issues and lowered retest rate from 15% to 5%.
- Completed 15 dry-run validations and 45 test review documents.`;

    const capabilities = inferCapabilitiesFromText(engineeringText);

    expect(capabilities).toEqual(expect.arrayContaining([
      'problem_solving',
      'attention_to_detail',
      'troubleshooting',
    ]));
  });

  it('4. Collaboration Evidence Mapping: extracts direct collaboration evidence from client and team coordination', () => {
    const collaborationText = `Senior Hardware Engineer
- Coordinated with Apple client engineers and product development teams for 4 NPI builds.
- Co-hosted orientation and supported international students.`;

    const capabilities = inferCapabilitiesFromText(collaborationText);

    expect(capabilities).toEqual(expect.arrayContaining([
      'stakeholder_collaboration',
    ]));
  });

  it('5. Cloud OR Logic: evaluates disjunctive requirements (Azure, AWS, or GCP) as met when AWS is met', () => {
    const cvProfile = {
      experience: ['Deploys microservices on AWS EC2 and AWS Lambda.'],
      sections: [
        { title: 'Experience', key: 'experience', content: 'Deploys microservices on AWS EC2 and AWS Lambda.' },
      ],
    };

    const cvEvidenceProfile = buildCvEvidenceProfile(cvProfile, '');

    const disjunctiveRequirement = {
      id: 'req-cloud',
      label: 'Azure, AWS, or GCP',
      mustHave: true,
      type: 'hard',
      category: 'tool_or_platform',
    };

    const status = computeRequirementStatus(disjunctiveRequirement, cvEvidenceProfile, {
      byLabel: {
        'aws': [{ text: 'Deploys microservices on AWS EC2', score: 0.85, evidenceStrength: 'strong', section: 'experience', sourceType: 'experience' }],
        'azure': [],
        'gcp': [],
      },
    });

    expect(status.finalStatus).toBe('met');
  });

  it('6. Non-Contradictory Reason Strings: outputs accurate note when explicit terms exist in keyCompetencies', () => {
    const requirement = {
      id: 'req-data',
      label: 'Data Engineering & ETL/ELT Pipelines',
      mustHave: true,
      type: 'hard',
      category: 'technical_skill',
    };

    const cvProfile = {
      keyCompetencies: ['data engineering', 'etl', 'elt', 'data quality', 'modelling'],
      sections: [
        { title: 'Key Competencies', key: 'key_competencies', content: 'data engineering, etl, elt, data quality, modelling' },
      ],
    };

    const cvEvidenceProfile = buildCvEvidenceProfile(cvProfile, '');
    const status = computeRequirementStatus(requirement, cvEvidenceProfile, {});

    expect(status.detailNote).not.toMatch(/no explicit mention/i);
  });

  it('7. Consistent Role Evidence Map Categories: keeps consistent strength ordering', () => {
    const requirementChecks = [
      { id: 'aws', label: 'AWS Cloud', status: 'met', type: 'hard', evidenceStrength: 'strong', evidence: ['AWS EC2'] },
      { id: 'sql', label: 'SQL Database', status: 'partial', type: 'hard', evidenceStrength: 'partial', evidence: ['SQL'] },
    ];

    const { strengths } = buildExplanation({
      microScores: [{ label: 'AWS Cloud', score: 85, evidence: ['AWS EC2'] }],
      requirementChecks,
      cvEvidenceProfile: {},
    });

    expect(strengths.length).toBeGreaterThan(0);
    expect(strengths[0].label).toMatch(/AWS Cloud/i);
  });
});
