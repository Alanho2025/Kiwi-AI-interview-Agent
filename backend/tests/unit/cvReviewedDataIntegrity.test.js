import { describe, expect, it } from 'vitest';
import { buildReviewedCvProfile } from '../../src/services/cv/cvReviewedProfileService.js';

describe('CV Human Review Canonical Data Integrity & Preservation Suite', () => {
  it('Issue 5 & 8: Preserves un-edited CV sections (contact, awards, languages) and full skills list', () => {
    const baseProfile = {
      schemaVersion: 'cv_profile_v1',
      personalStatement: 'Original summary',
      summary: 'Original summary',
      experience: 'Senior Developer at Company X',
      projects: 'Project Alpha',
      education: 'Bachelor of Computer Science',
      certifications: 'AWS Certified Solutions Architect',
      skills: [
        { label: 'JavaScript' }, { label: 'Python' }, { label: 'React' }, { label: 'Node.js' },
        { label: 'SQL' }, { label: 'Docker' }, { label: 'Kubernetes' }, { label: 'AWS' },
        { label: 'TypeScript' }, { label: 'PostgreSQL' }
      ],
      sections: [
        { key: 'contact', title: 'Contact', content: 'alan@example.com' },
        { key: 'languages', title: 'Languages', content: 'English, Mandarin' },
        { key: 'experience', title: 'Experience', content: 'Senior Developer at Company X' },
        { key: 'certifications', title: 'Certifications', content: 'AWS Certified Solutions Architect' },
      ],
      warnings: ['Low confidence on graduation year'],
      confidence: 0.8,
    };

    const reviewProfile = {
      coreSkills: ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Docker', 'Kubernetes', 'AWS', 'TypeScript', 'PostgreSQL'],
      experienceEvidence: 'Senior Developer at Company X - Updated bullet point',
    };

    const reviewed = buildReviewedCvProfile({ baseProfile, reviewProfile });

    // Verify un-edited sections (contact, languages, certifications) were preserved
    const sectionKeys = reviewed.sections.map((s) => s.key);
    expect(sectionKeys).toContain('contact');
    expect(sectionKeys).toContain('languages');
    expect(sectionKeys).toContain('certifications');

    // Verify certifications were not wiped out
    expect(reviewed.certifications).toBe('AWS Certified Solutions Architect');

    // Verify system warnings were preserved
    expect(reviewed.warnings).toEqual(['Low confidence on graduation year']);

    // Verify full skills list (10 skills) was preserved without truncation to 8
    expect(reviewed.skills).toHaveLength(10);
    expect(reviewed.skills.map((s) => s.label)).toContain('PostgreSQL');
  });

  it('Issue 7: Supports certifications as distinct field without merging/wiping into education', () => {
    const baseProfile = {
      education: 'Master of IT, University of Auckland',
      certifications: 'CKA Certified Kubernetes Administrator',
      sections: [
        { key: 'education', title: 'Education', content: 'Master of IT, University of Auckland' },
        { key: 'certifications', title: 'Certifications', content: 'CKA Certified Kubernetes Administrator' },
      ],
    };

    const reviewProfile = {
      educationCredentials: 'Master of IT, University of Auckland',
      certifications: 'CKA Certified Kubernetes Administrator, AWS DevOps Professional',
    };

    const reviewed = buildReviewedCvProfile({ baseProfile, reviewProfile });

    expect(reviewed.education).toBe('Master of IT, University of Auckland');
    expect(reviewed.certifications).toBe('CKA Certified Kubernetes Administrator, AWS DevOps Professional');
    const certSection = reviewed.sections.find((s) => s.key === 'certifications');
    expect(certSection?.content).toBe('CKA Certified Kubernetes Administrator, AWS DevOps Professional');
  });
});
