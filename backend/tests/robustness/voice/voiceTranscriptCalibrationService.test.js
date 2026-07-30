import { describe, expect, it } from 'vitest';

import {
  buildSessionSpeechPhraseContext,
} from '../../../src/services/voice/speechPhraseHintService.js';
import {
  calibrateTranscript,
  mergeStaticNormalizationIntoCalibration,
} from '../../../src/services/voice/transcriptCalibrationService.js';
import { normalizeTranscript } from '../../../src/services/voice/transcriptNormalizer.js';

const buildGlossaryItem = (term, overrides = {}) => ({
  term,
  normalizedTerm: term.toLowerCase(),
  source: 'jd_rubric',
  sourceRef: { fieldPath: 'parsedJdProfile.sections.technicalSkills' },
  scope: 'session',
  priority: 'high',
  reason: 'tool_or_framework',
  safeForPhraseHint: true,
  safeForAutoCorrection: true,
  safeForReportCitation: false,
  ...overrides,
});

describe('voice transcript calibration service', () => {
  it('builds source-aware contextual glossary items without exposing raw CV or JD text', () => {
    const context = buildSessionSpeechPhraseContext({
      candidateName: 'A Candidate',
      analysisResult: {
        jobTitle: 'AI Workflow Engineer',
        parsedCvProfile: {
          skills: ['PostgreSQL', 'OCR validation'],
          projects: [{ title: 'Clinic Workflow Automation' }],
        },
        parsedJdProfile: {
          title: 'AI Workflow Engineer',
          sections: {
            technicalSkills: ['Playwright', 'Vitest'],
          },
          mustHaveRequirements: ['Translate messy clinical workflows into automation requirements'],
        },
      },
      interviewPlan: {
        questionPool: [
          {
            id: 'q1',
            topic: 'workflow validation',
            matchedSkill: 'OCR validation',
            text: 'Tell me how you validated OCR output with clinical staff.',
          },
        ],
      },
    });

    expect(context.phraseList).toEqual(expect.arrayContaining([
      'PostgreSQL',
      'OCR validation',
      'Playwright',
      'Vitest',
    ]));

    expect(context.contextualGlossary).toEqual(expect.arrayContaining([
      expect.objectContaining({
        term: 'PostgreSQL',
        source: 'cv_profile',
        priority: 'high',
        safeForPhraseHint: true,
        safeForAutoCorrection: true,
        safeForReportCitation: false,
      }),
      expect.objectContaining({
        term: 'Playwright',
        source: 'jd_rubric',
        reason: 'tool_or_framework',
      }),
      expect.objectContaining({
        term: 'workflow validation',
        source: 'interview_plan',
        scope: 'question',
      }),
    ]));

    expect(JSON.stringify(context.contextualGlossary)).not.toContain('Tell me how you validated OCR output with clinical staff.');
    expect(JSON.stringify(context.contextualGlossary)).not.toContain('Translate messy clinical workflows into automation requirements');
  });

  it('reranks to a near-confidence N-best candidate only for bounded term-level corrections', () => {
    const decision = calibrateTranscript({
      rawText: 'I used post grace SQL for durable storage.',
      nBestCandidates: [
        { text: 'I used post grace SQL for durable storage.', confidence: 0.72 },
        { text: 'I used PostgreSQL for durable storage.', confidence: 0.68 },
      ],
      glossaryItems: [buildGlossaryItem('PostgreSQL')],
    });

    expect(decision).toEqual(expect.objectContaining({
      rawTranscript: 'I used post grace SQL for durable storage.',
      selectedTranscript: 'I used PostgreSQL for durable storage.',
      decisionType: 'nbest_rerank',
      guardrail: {
        answerQualityChanged: false,
        usedCvJdAsSpokenEvidence: false,
      },
    }));
    expect(decision.corrections).toEqual([
      expect.objectContaining({
        rawSpan: 'I used post grace SQL for durable storage.',
        correctedSpan: 'I used PostgreSQL for durable storage.',
        glossaryTerm: 'PostgreSQL',
        source: 'jd_rubric',
        reason: 'tool_or_framework',
        scoringImpacting: true,
        userConfirmed: false,
      }),
    ]);
    expect(decision.nbest).toEqual(expect.objectContaining({
      retained: true,
      candidateCount: 2,
      selectedIndex: 1,
    }));
  });

  it('does not use CV or JD context to add candidate evidence the user did not say', () => {
    const decision = calibrateTranscript({
      rawText: 'I worked on the database.',
      nBestCandidates: [
        { text: 'I worked on the database.', confidence: 0.72 },
        { text: 'I designed PostgreSQL schemas and optimized indexes.', confidence: 0.70 },
      ],
      glossaryItems: [buildGlossaryItem('PostgreSQL', { source: 'cv_profile' })],
    });

    expect(decision).toEqual(expect.objectContaining({
      selectedTranscript: 'I worked on the database.',
      decisionType: 'no_change',
      corrections: [],
      guardrail: {
        answerQualityChanged: false,
        usedCvJdAsSpokenEvidence: false,
      },
    }));
  });

  it('falls back safely when provider N-best candidates are unavailable', () => {
    const decision = calibrateTranscript({
      rawText: 'I used MongoDB because the document shape changed often.',
      nBestCandidates: [],
      glossaryItems: [buildGlossaryItem('MongoDB')],
    });

    expect(decision).toEqual(expect.objectContaining({
      rawTranscript: 'I used MongoDB because the document shape changed often.',
      selectedTranscript: 'I used MongoDB because the document shape changed often.',
      decisionType: 'no_change',
      corrections: [],
      nbest: {
        retained: false,
        candidateCount: 0,
        selectedIndex: 0,
      },
    }));
  });

  it('marks existing safe transcript normalization without changing raw transcript truth', () => {
    const calibration = calibrateTranscript({
      rawText: 'I used post gray sql for durable storage.',
      nBestCandidates: [],
      glossaryItems: [buildGlossaryItem('PostgreSQL')],
    });
    const normalized = normalizeTranscript(calibration.selectedTranscript);
    const merged = mergeStaticNormalizationIntoCalibration({ calibration, normalized });

    expect(merged).toEqual(expect.objectContaining({
      rawTranscript: 'I used post gray sql for durable storage.',
      selectedTranscript: 'I used post gray sql for durable storage.',
      normalizedTranscript: 'I used PostgreSQL for durable storage.',
      calibratedTranscript: 'I used PostgreSQL for durable storage.',
      decisionType: 'static_normalization',
      guardrail: {
        answerQualityChanged: false,
        usedCvJdAsSpokenEvidence: false,
      },
    }));
    expect(merged.staticCorrections).toEqual([
      expect.objectContaining({
        replacement: 'PostgreSQL',
      }),
    ]);
    expect(merged.corrections).toEqual([]);
  });

  it('calibrates candidate answer acronyms from N-best candidates correctly', () => {
    const decision = calibrateTranscript({
      rawText: 'I used github c oc id for automated deploy',
      nBestCandidates: [
        { index: 0, text: 'I used github c oc id for automated deploy', confidence: 0.81 },
        { index: 1, text: 'I used github CI/CD for automated deploy', confidence: 0.79 },
      ],
      glossaryItems: [buildGlossaryItem('CI/CD', { reason: 'technical_acronym' })],
    });

    expect(decision.decisionType).toBe('nbest_rerank');
    expect(decision.calibratedTranscript).toBe('I used github CI/CD for automated deploy');
  });
});
