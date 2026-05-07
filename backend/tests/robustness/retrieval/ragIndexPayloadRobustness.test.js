import { describe, expect, it } from 'vitest';

import {
  buildControllerDecisionIndexPayload,
  buildMatchAnalysisIndexPayload,
} from '../../../src/services/ragIndexService.js';

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
});
