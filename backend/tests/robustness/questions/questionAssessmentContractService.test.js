import { describe, expect, it } from 'vitest';
import {
  SIGNAL_ALIAS_MAP,
  normalizeEvidenceSignalId,
  resolveQuestionAssessmentContract,
} from '../../../src/services/questions/questionAssessmentContractService.js';

describe('questionAssessmentContractService (V6 Extension Contract)', () => {
  it('normalizes evidence signal aliases correctly', () => {
    expect(normalizeEvidenceSignalId('ownership')).toBe('personal_ownership');
    expect(normalizeEvidenceSignalId('measurable_result')).toBe('result_or_validation');
    expect(normalizeEvidenceSignalId('tradeoff')).toBe('tradeoff_or_constraint');
    expect(normalizeEvidenceSignalId('unknown_signal')).toBe('unknown_signal');
  });

  it('deduplicates normalized required signals and computes satisfied status', () => {
    const contract = resolveQuestionAssessmentContract({
      questionId: 'q1',
      intent: 'validation',
      requiredSignals: ['result', 'measurable_result', 'result_or_validation'],
      collectedSignals: [
        { signalId: 'measurable_result', status: 'supported', confidence: 0.9 },
      ],
    });

    expect(contract.requiredSignals).toEqual(['result_or_validation']);
    expect(contract.missingSignals).toEqual([]);
    expect(contract.satisfactionStatus).toBe('satisfied');
    expect(contract.confidence).toBe(0.9);
  });

  it('returns unverifiable status when requiredSignals is empty', () => {
    const contract = resolveQuestionAssessmentContract({
      questionId: 'q2',
      intent: 'technical_depth',
      requiredSignals: [],
      collectedSignals: [
        { signalId: 'ownership', status: 'supported', confidence: 0.8 },
      ],
    });

    expect(contract.satisfactionStatus).toBe('unverifiable');
    expect(contract.confidence).toBeNull();
  });

  it('computes confidence using ONLY matched required signals and ignores unrelated signals', () => {
    const contract = resolveQuestionAssessmentContract({
      questionId: 'q3',
      intent: 'tradeoff',
      requiredSignals: ['ownership'],
      collectedSignals: [
        { signalId: 'ownership', status: 'supported', confidence: 0.85 },
        { signalId: 'unrelated_teamwork', status: 'supported', confidence: 0.2 },
      ],
    });

    expect(contract.satisfactionStatus).toBe('satisfied');
    expect(contract.confidence).toBe(0.85); // Unrelated 0.2 does NOT pull down 0.85!
  });

  it('handles conflicting signals and sets requiresClarification flag', () => {
    const contract = resolveQuestionAssessmentContract({
      questionId: 'q4',
      intent: 'ownership',
      requiredSignals: ['ownership'],
      collectedSignals: [
        { signalId: 'ownership', status: 'supported', confidence: 0.8 },
        { signalId: 'ownership', status: 'contradicted', confidence: 0.9 },
      ],
    });

    expect(contract.satisfactionStatus).toBe('partially_satisfied');
    expect(contract.conflictSignals).toContain('personal_ownership');
    expect(contract.requiresClarification).toBe(true);
  });
});
