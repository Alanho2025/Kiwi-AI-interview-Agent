/**
 * File responsibility: Phase 2B Turn-Active STT Phrase Hints Test Suite.
 * Main responsibilities:
 * - Test buildTurnActiveSpeechPhraseContext 3-tier active phrase hint generator.
 * - Verify priority ordering (Current Question > Session > Global Fallback).
 * - Verify Soft Ceiling 30 and Hard Cap 40 early cutoff rules.
 * - Verify diagnostic metrics output.
 */

import { describe, expect, it } from 'vitest';

import {
  buildTurnActiveSpeechPhraseContext,
} from '../../../src/services/voice/speechPhraseHintService.js';
import {
  buildTargetTechnicalTermItem,
} from '../../../src/services/questions/questionArtifactHelpers.js';

describe('Phase 2B: Turn-Active STT Phrase Hints (3-Tier 30/40 Cap)', () => {
  it('prioritizes current question targetTechnicalTerms first over session terms', () => {
    const activeQuestion = {
      id: 'q_bakery_01',
      text: 'Tell me about your bakery data project using Databricks and XGBoost.',
      targetTechnicalTerms: [
        buildTargetTechnicalTermItem({ term: 'Databricks', source: 'question_context', priority: 'high' }),
        buildTargetTechnicalTermItem({ term: 'XGBoost', source: 'question_context', priority: 'high' }),
      ],
    };

    const session = {
      candidateName: 'John Doe',
      targetRole: 'AI Engineer',
      analysisResult: {
        parsedCvProfile: {
          skills: ['PostgreSQL', 'Docker', 'React', 'Node.js', 'Python', 'AWS', 'Redis', 'Kubernetes'],
        },
      },
    };

    const result = buildTurnActiveSpeechPhraseContext({ activeQuestion, session });

    expect(result.currentQuestionCount).toBe(2);
    expect(result.phraseList).toEqual(expect.arrayContaining(['Databricks', 'XGBoost']));
    expect(result.phraseList.indexOf('Databricks')).toBeLessThan(10);
    expect(result.phraseList.indexOf('XGBoost')).toBeLessThan(10);
    expect(result.phraseList.length).toBeLessThanOrEqual(40);
    expect(result.softCap).toBe(30);
    expect(result.hardCap).toBe(40);
  });

  it('applies early cutoff by relevance threshold and caps phrase hints at 30/40', () => {
    const manyTerms = Array.from({ length: 50 }, (_, i) => (
      buildTargetTechnicalTermItem({ term: `TechTerm${i}`, source: 'question_context', priority: 'high' })
    ));

    const activeQuestion = {
      id: 'q_overflow',
      text: 'Question with too many technical terms.',
      targetTechnicalTerms: manyTerms,
    };

    const result = buildTurnActiveSpeechPhraseContext({ activeQuestion });

    expect(result.phraseList.length).toBeLessThanOrEqual(40);
    expect(result.droppedCount).toBeGreaterThan(0);
    expect(result.hardCap).toBe(40);
  });

  it('falls back gracefully to session and global terms when question terms are sparse', () => {
    const activeQuestion = {
      id: 'q_simple',
      text: 'Tell me about a time you worked in a team.',
      targetTechnicalTerms: [],
    };

    const session = {
      candidateName: 'Jane Smith',
      analysisResult: {
        parsedCvProfile: {
          skills: ['Databricks', 'XGBoost'],
        },
      },
    };

    const result = buildTurnActiveSpeechPhraseContext({ activeQuestion, session });

    expect(result.phraseList.length).toBeGreaterThan(0);
    expect(result.phraseList.length).toBeLessThanOrEqual(40);
    expect(result.contextualGlossary.length).toBeLessThanOrEqual(30);
    expect(result.sessionFallbackCount).toBeGreaterThan(0);
  });
});
