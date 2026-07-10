import { describe, expect, it } from 'vitest';

import { buildLiveInterviewTurnResponse } from '../../../src/services/interview/liveInterviewPayloadService.js';

describe('liveInterviewPayloadService', () => {
  it('allows spoken output and latency while removing internal Role-Fit diagnostics', () => {
    const payload = buildLiveInterviewTurnResponse({
      agentResult: {
        nextQuestion: 'Tell me about a project you improved.',
        interviewerTurn: {
          feedbackMode: 'conversational_llm',
          displayText: 'Tell me about a project you improved.',
          questionDecision: { recommendedEvidenceIds: ['private-evidence-voice'] },
        },
        rationale: 'private-proof-reason',
        retrievalSnapshot: { evidenceId: 'private-evidence-voice' },
        evaluatorOutput: { proofPointId: 'private-proof-voice' },
        reactTrace: { thoughtSummary: 'private-thought-voice' },
        rankTrace: { recommendedEvidenceIds: ['private-evidence-voice'] },
        isComplete: false,
      },
      updatedSession: {
        id: 'session-1',
        status: 'in_progress',
        interviewPlan: {
          roleFit: { proofStrategy: { mustCover: [{ evidenceOptions: ['private-evidence-session'] }] } },
        },
      },
      transcription: { text: 'I improved a reporting workflow.' },
      latency: { totalMs: 100 },
    });

    expect(payload).toMatchObject({
      nextQuestion: 'Tell me about a project you improved.',
      interviewerTurn: { displayText: 'Tell me about a project you improved.' },
      transcription: { text: 'I improved a reporting workflow.' },
      latency: { totalMs: 100 },
    });
    expect(JSON.stringify(payload)).not.toMatch(/private-evidence|private-proof|private-thought|questionDecision|rankTrace/);
  });
});
