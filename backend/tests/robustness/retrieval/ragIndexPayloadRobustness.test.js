import { describe, expect, it } from 'vitest';

import {
  buildControllerDecisionIndexPayload,
  buildMatchAnalysisIndexPayload,
  buildPreparedQuestionPoolIndexPayload,
} from '../../../src/services/ragIndexService.js';
import { RETRIEVAL_SOURCES } from '../../../src/services/retrieval/retrievalSourceRegistry.js';
import { selectRetrievalSources } from '../../../src/services/retrieval/retrievalSourceSelector.js';

describe('RAG index payload builders', () => {
  it('builds a match_analysis payload from the stored session analysis fields', () => {
    const payload = buildMatchAnalysisIndexPayload({
      schemaVersion: 'v3',
      matchSummary: {
        candidateName: 'Ava',
        jobTitle: 'Data Engineer',
        matchScore: 76,
        strengths: [{ label: 'Python and SQL' }],
        gaps: [{ label: 'Production pipeline evidence' }],
        interviewFocus: ['data pipelines'],
      },
      decision: { label: 'moderate_match' },
      confidence: 0.84,
      scoreBreakdown: { macro: 70, micro: 82, requirements: 65 },
      requirementChecks: [
        { label: 'SQL', type: 'hard', importance: 'high', status: 'met', evidence: ['SQL project'] },
      ],
      evidenceMap: [{ type: 'strength', label: 'SQL' }],
    });

    expect(payload).toMatchObject({
      candidateName: 'Ava',
      jobTitle: 'Data Engineer',
      matchScore: 76,
      confidence: 0.84,
      decision: { label: 'moderate_match' },
      scoreBreakdown: { macro: 70, micro: 82, requirements: 65 },
    });
    expect(payload.explanation.strengths).toEqual([{ label: 'Python and SQL' }]);
    expect(payload.requirementChecks[0]).toMatchObject({
      label: 'SQL',
      type: 'hard',
      importance: 'high',
      status: 'met',
      evidence: ['SQL project'],
    });
    expect(payload.evidenceMap).toEqual([{ type: 'strength', label: 'SQL' }]);
  });

  it('builds a controller_decision payload from controller memory records', () => {
    const payload = buildControllerDecisionIndexPayload({
      schemaVersion: 'v3',
      controllerState: { currentTopic: 'sql' },
      decisionRecords: [{ actionType: 'ASK_FOLLOW_UP', targetTopic: 'sql' }],
      evaluatorRecords: [{ evidenceStrength: 3 }],
      trajectoryRecords: [{ section: 'technical' }],
      dynamicSlotRecords: [{ topic: 'database_design' }],
      reflectionRecords: [{ summary: 'Needs stronger evidence.' }],
      agentMemory: { weakAreas: ['examples'] },
    });

    expect(payload.controllerState).toEqual({ currentTopic: 'sql' });
    expect(payload.decisionRecords).toHaveLength(1);
    expect(payload.evaluatorRecords).toHaveLength(1);
    expect(payload.trajectoryRecords).toHaveLength(1);
    expect(payload.dynamicSlotRecords).toHaveLength(1);
    expect(payload.reflectionRecords).toHaveLength(1);
    expect(payload.agentMemory).toEqual({ weakAreas: ['examples'] });
  });

  it('indexes Role Evidence Map instead of duplicating the legacy evidence map for new analysis', () => {
    const roleEvidenceMap = {
      schemaVersion: 'role_evidence_map_v1',
      items: [{ roleIntentId: 'intent:api', classification: 'direct', sourceEvidence: [] }],
    };

    const payload = buildMatchAnalysisIndexPayload({
      schemaVersion: 'v3',
      roleEvidenceMap,
      evidenceMap: [{ type: 'strength', label: 'legacy duplicate' }],
    });

    expect(payload.roleEvidenceMap).toEqual(roleEvidenceMap);
    expect(payload).not.toHaveProperty('evidenceMap');
  });

  it('builds a prepared_question_pool payload without raw CV or JD text', () => {
    const payload = buildPreparedQuestionPoolIndexPayload([{
      questionId: 'poolq-1',
      sourceStage: 'match_gap',
      sourceType: 'match_gap',
      category: 'technical',
      stage: 'validation',
      topic: 'database',
      questionIntent: 'risk_probe',
      text: 'Tell me about a database task you owned.',
      fallbackText: 'Tell me about a database task you owned.',
      expectedSignal: ['ownership'],
      evidenceNeed: ['validation_method'],
      priorityWeight: 0.9,
      coverageWeight: 0.8,
      riskWeight: 0.7,
      status: 'active',
      linkedCvEvidence: [{ text: 'Sensitive raw CV evidence should not be copied.' }],
      linkedJdRequirement: [{ text: 'Sensitive raw JD evidence should not be copied.' }],
    }]);

    expect(payload).toMatchObject({
      schemaVersion: 'v1',
      questionCount: 1,
      questions: [expect.objectContaining({
        questionId: 'poolq-1',
        sourceType: 'match_gap',
        topic: 'database',
        text: 'Tell me about a database task you owned.',
      })],
    });
    expect(JSON.stringify(payload)).not.toContain('Sensitive raw CV evidence');
    expect(JSON.stringify(payload)).not.toContain('Sensitive raw JD evidence');
  });

  it('includes prepared_question_pool in interview and report retrieval source selection', () => {
    const bootstrapSources = selectRetrievalSources({ objective: 'BOOTSTRAP_INTERVIEW_CONTEXT' });
    const reportSources = selectRetrievalSources({ objective: 'COLLECT_REPORT_EVIDENCE' });

    expect(bootstrapSources).toContain(RETRIEVAL_SOURCES.SESSION_PREPARED_QUESTION_POOL);
    expect(reportSources).toContain(RETRIEVAL_SOURCES.SESSION_PREPARED_QUESTION_POOL);
  });
});
