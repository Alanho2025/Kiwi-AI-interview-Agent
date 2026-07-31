/**
 * File responsibility: Phase 2A Canonical Question Technical-Term Contract Test Suite.
 * Main responsibilities:
 * - Test buildTargetTechnicalTermItem & extractTargetTechnicalTerms helper functions.
 * - Verify sourceRef traceability (evidenceId, questionId, fieldPath).
 * - Confirm JSON serialization/persistence and restore without DB schema migration.
 */

import { describe, expect, it } from 'vitest';

import {
  buildTargetTechnicalTermItem,
  extractTargetTechnicalTerms,
} from '../../../src/services/questions/questionArtifactHelpers.js';
import { normalizeQuestionIntent } from '../../../src/services/agents/interviewerAgentQuestionBuilder.js';

describe('Phase 2A: Canonical Question Technical-Term Contract', () => {
  it('builds structured target technical term items with complete sourceRef traceability', () => {
    const item = buildTargetTechnicalTermItem({
      term: 'Databricks',
      source: 'candidate_evidence',
      sourceRef: {
        evidenceId: 'evidence_bakery_01',
        questionId: 'question_05',
        fieldPath: 'projects[1].technologies',
      },
      priority: 'high',
      reason: 'tool_or_framework',
    });

    expect(item).toEqual({
      term: 'Databricks',
      normalizedTerm: 'databricks',
      source: 'candidate_evidence',
      sourceRef: {
        evidenceId: 'evidence_bakery_01',
        questionId: 'question_05',
        fieldPath: 'projects[1].technologies',
      },
      reason: 'tool_or_framework',
      priority: 'high',
      safeForPhraseHint: true,
      safeForAutoCorrection: true,
    });
  });

  it('extracts technical terms from question text, matchedSkill, and CV context', () => {
    const terms = extractTargetTechnicalTerms({
      questionText: 'Can you give me a practical example of processing large datasets using Databricks and XGBoost?',
      topic: 'data engineering',
      matchedSkill: 'Databricks',
      basedOnSkills: ['XGBoost', 'POS system'],
      questionId: 'q5',
      analysisResult: {
        parsedCvProfile: {
          skills: ['Databricks', 'XGBoost', 'POS system'],
        },
      },
    });

    const termNames = terms.map((t) => t.term);
    expect(termNames).toEqual(expect.arrayContaining(['Databricks', 'XGBoost', 'POS system']));

    // Verify sourceRef traceability on extracted terms
    const databricksItem = terms.find((t) => t.term === 'Databricks');
    expect(databricksItem).toBeDefined();
    expect(databricksItem.sourceRef.questionId).toBe('q5');
    expect(databricksItem.safeForPhraseHint).toBe(true);
  });

  it('populates targetTechnicalTerms during normalizeQuestionIntent', () => {
    const question = normalizeQuestionIntent({
      question: {
        id: 'q5',
        text: 'Tell me about your bakery data project using Databricks.',
        topic: 'data pipeline',
        matchedSkill: 'Databricks',
      },
    });

    expect(Array.isArray(question.targetTechnicalTerms)).toBe(true);
    expect(question.targetTechnicalTerms.length).toBeGreaterThan(0);
    expect(question.targetTechnicalTerms[0].term).toBe('Databricks');
  });

  it('verifies JSON persistence/restore retains targetTechnicalTerms without field loss or DB migration', () => {
    const rawQuestion = {
      id: 'q5',
      text: 'Tell me about your bakery data project using Databricks.',
      targetTechnicalTerms: [
        buildTargetTechnicalTermItem({
          term: 'Databricks',
          source: 'candidate_evidence',
          sourceRef: { evidenceId: 'ev_1', questionId: 'q5', fieldPath: 'projects[0]' },
        }),
      ],
    };

    // Simulate JSONB DB serialization & restore
    const serialized = JSON.stringify(rawQuestion);
    const restored = JSON.parse(serialized);

    expect(restored.targetTechnicalTerms).toHaveLength(1);
    expect(restored.targetTechnicalTerms[0].term).toBe('Databricks');
    expect(restored.targetTechnicalTerms[0].sourceRef.evidenceId).toBe('ev_1');
  });
});
