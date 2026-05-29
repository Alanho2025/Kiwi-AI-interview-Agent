import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildCvProfile } from '../../../src/services/cv/cvProfileBuilderService.js';
import { buildNormalizedCvProfile } from '../../../src/services/cv/cvProfileContractBuilder.js';
import { normalizeCvEvidence } from '../../../src/services/cv/cvEvidenceNormalizer.js';
import { buildCvDisplayView } from '../../../src/services/cv/cvDisplayViewService.js';
import { buildReviewedCvProfile, normalizeReviewedCvProfile } from '../../../src/services/cv/cvReviewedProfileService.js';
import { extractCvSections } from '../../../src/services/cv/cvSectionParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureRoot = path.resolve(__dirname, '../../fixtures/cv');
const loadCv = (name) => fs.readFile(path.join(fixtureRoot, name), 'utf8');
const skillLabels = (profile) => profile.skills.map((item) => String(item.label || item).toLowerCase());
const sectionByTitle = (sections, title) => sections.find((section) => section.title === title);
const evidenceByText = (profile, pattern) => profile.evidenceProfile.evidenceItems
  .filter((item) => pattern.test(item.text || ''));

describe('CV parsing robustness', () => {
  it('extracts stable evidence from a project-heavy graduate CV without losing quantified achievements', async () => {
    const profile = buildCvProfile(await loadCv('graduate-software-engineer.txt'));
    const skills = skillLabels(profile);

    expect(profile.candidateName).toBe('Alex Chen');
    expect(skills).toEqual(expect.arrayContaining(['sql', 'git', 'javascript', 'azure', 'testing']));
    expect(profile.sections.map((section) => section.key)).toEqual(expect.arrayContaining(['summary', 'skills', 'projects', 'experience', 'education']));
    expect(profile.evidenceProfile.quantifiedEvidence.join(' ')).toMatch(/50%/);
    expect(profile.cvAnalysis.candidateIntro).toMatch(/Main direction/i);
    expect(profile.cvAnalysis.strongestEvidence.length).toBeGreaterThan(0);
    expect(profile.cvAnalysis.suggestedInterviewHooks).toEqual(expect.arrayContaining(['self introduction and career direction']));
    expect(profile.warnings).not.toEqual(expect.arrayContaining([expect.stringMatching(/No clear experience/i)]));
  });

  it('does not fail when a student CV has no experience section and keeps project evidence visible', async () => {
    const profile = buildCvProfile(await loadCv('frontend-student.txt'));
    const skills = skillLabels(profile);

    expect(profile.candidateName).toBe('Taylor Smith');
    expect(skills).toEqual(expect.arrayContaining(['react', 'javascript', 'html', 'css', 'git']));
    expect(profile.projects).toMatch(/Campus Events App/i);
    expect(profile.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/No clear experience section/i)]));
  });

  it('treats heading-free single-block CV text conservatively instead of hallucinating sections', () => {
    const sections = extractCvSections('Built a food recommendation API for students and improved response times by 40%.');

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('header');
    expect(sections[0].content).toMatch(/food recommendation API/i);
  });

  it('extracts expanded open-source NLP and data taxonomy skills from CV text', () => {
    const profile = buildCvProfile(`Jordan Lee
AI Engineer

Skills
Semantic Retrieval
Vector Search
Data Modelling
Python`);

    expect(skillLabels(profile)).toEqual(expect.arrayContaining([
      'semantic retrieval',
      'vector search',
      'data modelling',
      'python',
    ]));
  });

  it('keeps skills-list evidence as weak supporting evidence', () => {
    const profile = buildCvProfile(`Morgan Ng
Software Developer

Skills
Python
SQL`);

    const skillEvidence = profile.evidenceProfile.evidenceItems.filter((item) => item.sourceType === 'skill');
    expect(skillEvidence.map((item) => item.text)).toEqual(expect.arrayContaining(['Python', 'SQL']));
    expect(skillEvidence.every((item) => item.evidenceStrength === 'weak')).toBe(true);
  });

  it('recognises common CV template headings used by designer and engineer examples', () => {
    const sections = extractCvSections(`Resume Jo Engineer
Email: jo@engineer.com

Skills Summary
Problem solving

Experience Summary
Academic Tutor - VUW 2020 - 2021

Detailed Experience
Coding Assistant - Start-up Extreme 2020

Project Experience
To Do List project at Victoria University 2020

Key tools / skills
Git
Trello
Continuous integration`);

    expect(sections.map((section) => section.key)).toEqual(expect.arrayContaining([
      'summary',
      'experience',
      'projects',
      'skills',
    ]));
    expect(sectionByTitle(sections, 'Key tools / skills')?.key).toBe('skills');
    expect(sectionByTitle(sections, 'Detailed Experience')?.key).toBe('experience');
  });

  it('keeps Alan-style AI project technology as project tech stack evidence', () => {
    const profile = buildCvProfile(`Alan Ho

Projects
KIWI Mock Interview AI Agent
Tech: React, Express, Python, PostgreSQL, MongoDB, DeepSeek API, Azure Speech, WebSocket
Built a full-stack AI interview coaching system with adaptive questioning and structured feedback.`);

    const techEvidence = profile.evidenceProfile.evidenceItems.find((item) => item.sourceType === 'project_tech_stack');
    expect(techEvidence?.text).toMatch(/Express/i);
    expect(techEvidence?.text).toMatch(/DeepSeek API/i);
    expect(techEvidence?.text).toMatch(/Azure Speech/i);
    expect(techEvidence?.text).toMatch(/WebSocket/i);
    expect(techEvidence?.evidenceStrength).toBe('strong');
  });

  it('extracts designer-template tools from detailed design and front-end project evidence', () => {
    const profile = buildCvProfile(`Resume Kerry DeSigner
Email: k@designfamily.com

Detailed Experience
Junior Designer - Freight Co 2021
Skills / Tools: Photoshop, Sketch, InDesign
Achievements: Designed the assets for 3 viral marketing campaigns

Technical Skills
Front-End Development
I worked with HTML, CSS, JavaScript, jQuery and Google Maps API to build an interactive responsive website.
3D Modelling and Animation
I developed a Unity game character with 3D modelling and animation.`);

    expect(profile.experience).toMatch(/Junior Designer/i);
    expect(profile.evidenceProfile.quantifiedEvidence.join(' ')).toMatch(/3 viral marketing campaigns/i);
    expect(profile.evidenceProfile.evidenceItems.map((item) => item.tools || []).flat()).toEqual(expect.arrayContaining([
      'Photoshop',
      'Sketch',
      'InDesign',
      'jQuery',
      'JavaScript',
    ]));
  });

  it('extracts engineer-template technical and project evidence across skills and project sections', () => {
    const profile = buildCvProfile(`Resume Jo Engineer
Email: jo@engineer.com

Technical Skills
Java
Gained experience in object-oriented programming by developing a game with a GUI.
Python
Learned sockets by developing client and server programs.
Other languages I have used: C, C++, SQL

Project Experience
To Do List project at Victoria University 2020
Currently developing a to-do list application with a GUI using git, Trello and continuous integration.
Key tools / skills
Excel - Project management spreadsheet
Stakeholder management`);

    expect(skillLabels(profile)).toEqual(expect.arrayContaining(['java', 'python', 'sql']));
    expect(profile.evidenceProfile.sections.projects[0].techStack).toEqual(expect.arrayContaining(['git', 'trello', 'continuous integration']));
    expect(profile.evidenceProfile.evidenceItems.some((item) => /Excel/i.test(item.text || ''))).toBe(true);
  });

  it('captures contact info, parser metadata, warnings, and confidence in the core CV profile contract', () => {
    const profile = buildCvProfile('Alan Ho\nalan@example.com | +64 020 4184 4951 | Auckland CBD\n\nSkills\nPython\nSQL', {
      parserMetadata: {
        parser: 'test-parser',
        openSourceTools: { pdfplumber: { enabled: true, used: true } },
      },
      nlpSignals: { model: 'en_core_web_sm' },
    });

    expect(profile.candidateName).toBe('Alan Ho');
    expect(profile.contact.email).toBe('alan@example.com');
    expect(profile.contact.phone).toMatch(/020 4184 4951/);
    expect(profile.contact.location).toBe('Auckland');
    expect(profile.parserMetadata.parser).toBe('test-parser');
    expect(profile.parserMetadata.openSourceTools.pdfplumber.used).toBe(true);
    expect(profile.parserMetadata.openSourceTools.spaCy.used).toBe(true);
    expect(profile.confidence).toBe(0.72);
    expect(profile.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/No clear experience section/i)]));
  });

  it('keeps low-confidence warnings when no recognised technical skills are extracted', () => {
    const profile = buildCvProfile(`Jamie Candidate

Experience
Supported customers and prepared weekly notes.

Education
Certificate in Business`);

    expect(profile.skills).toHaveLength(0);
    expect(profile.confidence).toBe(0.48);
    expect(profile.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/No dedicated skills section/i)]));
    expect(profile.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/No common technical skills/i)]));
  });

  it('keeps certification and training sections available for downstream matching', () => {
    const profile = buildCvProfile(`Riley Certifier

Certificates and Training
Microsoft Azure Fundamentals
AWS Cloud Practitioner

Skills
Azure
AWS`);

    expect(profile.certifications).toMatch(/Azure Fundamentals/i);
    expect(profile.certifications).toMatch(/AWS Cloud Practitioner/i);
    expect(profile.evidenceProfile.sections.certifications).toEqual(expect.arrayContaining([
      'Microsoft Azure Fundamentals',
      'AWS Cloud Practitioner',
    ]));
  });

  it('upgrades technical product key competencies without inflating plain skill-list evidence', () => {
    const profile = buildCvProfile(`Alan Ho

Key Competencies
Designed AI agent product workflows through Kiwi Interview Agent, combining CV-JD matching, adaptive questioning, voice interaction, and report quality checks.
Developed full-stack AI prototypes using React, Express, Python, PostgreSQL, MongoDB, Azure Speech, WebSocket, and LLM APIs.
Communication

Skills
Python
SQL`);

    const technicalCompetencies = evidenceByText(profile, /AI agent product workflows|full-stack AI prototypes/i);
    const plainCompetency = evidenceByText(profile, /^Communication$/i)[0];
    const skillEvidence = profile.evidenceProfile.evidenceItems.filter((item) => item.sourceType === 'skill');

    expect(technicalCompetencies.length).toBeGreaterThanOrEqual(2);
    expect(technicalCompetencies.every((item) => item.evidenceStrength === 'partial')).toBe(true);
    expect(plainCompetency?.evidenceStrength).toBe('weak');
    expect(skillEvidence.every((item) => item.evidenceStrength === 'weak')).toBe(true);
  });

  it('builds Alan-style CV analysis with project, work, quantified, and weak-evidence diagnostics', () => {
    const profile = buildCvProfile(`Alan Ho
alan.ho0828@gmail.com | +64 020 4184 4951 | Auckland CBD

Personal Statement
Master of Information Technology student building full-stack AI products and AI agents.

Key Competencies
Evaluated AI outputs with structured rubrics, evidence checks, latency benchmarks, and quality review methods.

Education
Master of Information Technology, University of Auckland

Projects
KIWI Mock Interview AI Agent
Tech: React, Express, Python, PostgreSQL, MongoDB, DeepSeek API, Azure Speech, WebSocket
Built a full-stack AI interview coaching system with CV-JD matching, adaptive questioning, voice interaction, and structured feedback.

Work Experience
Oct 2021 - Jul 2024 Senior Electrical Engineer, Foxconn
Improved test process outcomes by using design of experiments and failure analysis to help reduce retest rates from 15% to 5%.

Volunteer Experience
Buddy Program, Auckland Universities’ Student Association
Supported more than ten new international students.`);

    expect(profile.summary).toMatch(/full-stack AI products/i);
    expect(profile.evidenceProfile.quantifiedEvidence.join(' ')).toMatch(/15% to 5%/);
    expect(profile.evidenceProfile.quantifiedEvidence.join(' ')).not.toMatch(/Oct 2021 - Jul 2024/);
    expect(profile.evidenceProfile.sections.volunteer.join(' ')).toMatch(/Buddy Program/i);
    expect(profile.cvAnalysis.strongestEvidence.map((item) => item.text).join(' ')).toMatch(/KIWI Mock Interview AI Agent|15% to 5%/i);
    expect(profile.cvAnalysis.weakOrMissingEvidence).not.toEqual(expect.arrayContaining([expect.stringMatching(/Project evidence is limited/i)]));
  });

  it('normalizes mixed project and work evidence into separate downstream fields', () => {
    const normalized = buildNormalizedCvProfile({
      candidateName: 'Mia Wong',
      skills: [{ label: 'Python' }, { label: 'SQL' }, { label: 'Power BI' }],
      projects: [{ title: 'Reporting Prototype', description: 'Built a Python and SQL dashboard prototype' }],
      workHistory: [{ role: 'Operations Analyst', company: 'HealthOps NZ', responsibilities: 'Built weekly SQL reports and reduced reconciliation by 35%' }],
      achievements: ['Reduced manual reconciliation by 35%'],
    });

    expect(normalized.projects[0].title).toBe('Reporting Prototype');
    expect(normalized.workHistory[0].title).toBe('Operations Analyst');
    expect(normalized.evidenceProfile.quantifiedEvidence.join(' ')).toMatch(/35%/);
    expect(normalized.skills).toEqual(expect.arrayContaining(['Python', 'SQL']));
  });

  it('normalizes existing parsed evidence without dropping project stack, achievements, and technical-depth signals', () => {
    const evidence = normalizeCvEvidence({
      summary: 'AI product builder',
      skills: ['React', 'Node.js'],
      projects: [{
        title: 'Interview Dashboard',
        description: 'Built backend API and database workflow',
        techStack: ['React', 'Node.js', 'PostgreSQL'],
      }],
      workHistory: [{ role: 'Engineer', responsibilities: 'Owned production issue analysis and documentation' }],
      achievements: ['Reduced retest rate by 30%'],
    });

    expect(evidence.hardSkills).toEqual(expect.arrayContaining(['React', 'Node.js']));
    expect(evidence.sections.projects[0].techStack).toEqual(expect.arrayContaining(['React', 'Node.js', 'PostgreSQL']));
    expect(evidence.quantifiedEvidence.join(' ')).toMatch(/30%/);
    expect(evidence.technicalDepthEvidence.join(' ')).toMatch(/backend API|database/i);
    expect(evidence.leadershipEvidence.join(' ')).toMatch(/Owned production/i);
  });

  it('masks contact information and keeps a redacted display view for uploaded CV cards', () => {
    const profile = buildCvProfile(`Alan Ho
alan.ho0828@gmail.com | +64 020 4184 4951 | Auckland CBD

Personal Statement
Graduate developer building AI products.

Skills
React
Python`);
    const display = buildCvDisplayView({
      fileRecord: {
        id: 'cv_123',
        original_filename: 'Alan Ho_CV.pdf',
        mime_type: 'application/pdf',
        uploaded_at: '2026-05-27T00:00:00.000Z',
      },
      cvProfile: profile,
    });

    expect(display.contact.email).toBe('al***@gmail.com');
    expect(display.contact.phone).toBe('***4951');
    expect(display.topSkills).toEqual(expect.arrayContaining(['React', 'Python']));
    expect(display.parseStatus).toBe('completed');
    expect(display.profileStatus).toBe('completed');
  });

  it('turns human-reviewed CV fields into downstream matching evidence', () => {
    const reviewedProfile = buildReviewedCvProfile({
      baseProfile: { candidateName: 'Alan Ho', sections: [], confidence: 0.48 },
      reviewProfile: {
        candidateSummary: 'Graduate developer with React and data project experience.',
        coreSkills: ['React', 'Node.js', 'Python'],
        experienceEvidence: 'Delivered customer support workflows and automated reporting.',
        projectEvidence: 'Built a React interview dashboard with Node.js APIs.',
        educationCredentials: 'Bachelor of Computer Science.',
        keyCompetencies: ['Communication', 'Troubleshooting'],
      },
      reviewedAt: '2026-05-08T00:00:00.000Z',
    });

    expect(reviewedProfile.summary).toMatch(/Graduate developer/i);
    expect(reviewedProfile.skills.map((item) => item.label)).toEqual(['React', 'Node.js', 'Python']);
    expect(reviewedProfile.sections.map((section) => section.key)).toEqual(expect.arrayContaining(['experience', 'projects', 'education', 'key_competencies']));
    expect(reviewedProfile.evidenceProfile.sections.projects[0].rawText).toMatch(/React interview dashboard/i);
    expect(reviewedProfile.evidenceProfile.hardSkills).toEqual(expect.arrayContaining(['React', 'Node.js', 'Python']));
    expect(reviewedProfile.cvAnalysis.careerDirection).toMatch(/Data|AI|software/i);
    expect(reviewedProfile.cvAnalysis.strongestEvidence.map((item) => item.text).join(' ')).toMatch(/React interview dashboard/i);
    expect(reviewedProfile.metadata.humanReviewStatus).toBe('verified');
  });

  it('normalizes reviewed CV profile input from comma and newline separated fields', () => {
    const normalized = normalizeReviewedCvProfile({
      candidateSummary: '  AI product builder  ',
      coreSkills: 'React, Python\nSQL',
      experienceEvidence: ' Delivered engineering reports. ',
      projectEvidence: 'Built interview agent.',
      educationCredentials: 'MIT, University of Auckland',
      keyCompetencies: [' Communication ', { label: 'Troubleshooting' }],
    });

    expect(normalized.candidateSummary).toBe('AI product builder');
    expect(normalized.coreSkills).toEqual(['React', 'Python', 'SQL']);
    expect(normalized.experienceEvidence).toBe('Delivered engineering reports.');
    expect(normalized.keyCompetencies).toEqual(['Communication', 'Troubleshooting']);
  });

  it('rejects empty human-reviewed CV profile input instead of creating fake evidence', () => {
    expect(() => buildReviewedCvProfile({
      baseProfile: { candidateName: 'Alan Ho', sections: [] },
      reviewProfile: {},
    })).toThrow(/Missing CV review fields/i);
  });
});
