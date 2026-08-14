import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateWithUniversalLlm } from '../../../src/services/report/universalLlmEvaluationService.js';
import * as deepseekService from '../../../src/services/deepseekService.js';

vi.mock('../../../src/services/deepseekService.js', () => ({
  callDeepSeek: vi.fn(),
}));

describe('universalLlmEvaluationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseDimensions = [
    { key: 'riskIdentification', label: 'Risk Identification' },
    { key: 'controls', label: 'Controls / Action' }
  ];

  it('should evaluate dimensions using LLM and return valid scores', async () => {
    deepseekService.callDeepSeek.mockResolvedValueOnce({
      content: `\`\`\`json
[
  { "dimension": "Risk Identification", "level": 4, "reason": "Identifies specific risks." },
  { "dimension": "Controls / Action", "level": 2, "reason": "Mentions being careful but no concrete actions." }
]
\`\`\``
    });

    const result = await evaluateWithUniversalLlm({
      question: 'How do you handle safety risks?',
      answer: 'I try to be careful and I watch out for tripping hazards.',
      context: { targetRole: 'Warehouse Worker' },
      dimensionsArray: baseDimensions,
      frameworkLabel: 'Safety Test'
    });

    expect(deepseekService.callDeepSeek).toHaveBeenCalledTimes(1);
    
    expect(result.dimensions).toHaveLength(2);
    
    const risk = result.dimensions.find(d => d.key === 'riskIdentification');
    expect(risk.level).toBe(4);
    expect(risk.score).toBe(7.5); // (4-1) * 0.25 * 10
    expect(risk.status).toBe('clear');

    const controls = result.dimensions.find(d => d.key === 'controls');
    expect(controls.level).toBe(2);
    expect(controls.score).toBe(2.5); // (2-1) * 0.25 * 10
    expect(controls.status).toBe('partial');

    expect(result.totalScore).toBe(10); // 7.5 + 2.5
    expect(result.maxScore).toBe(20);
    expect(result.normalizedScore).toBe(5); // (10 / 20) * 10
  });

  it('should fallback to Level 1 if LLM times out or throws', async () => {
    deepseekService.callDeepSeek.mockRejectedValueOnce(new Error('Timeout'));

    const result = await evaluateWithUniversalLlm({
      question: 'Test',
      answer: 'Test',
      context: {},
      dimensionsArray: baseDimensions,
      frameworkLabel: 'Test Framework'
    });

    expect(result.dimensions).toHaveLength(2);
    result.dimensions.forEach(d => {
      expect(d.level).toBe(1);
      expect(d.score).toBe(0);
      expect(d.status).toBe('missing');
      expect(d.reason).toMatch(/Evaluation failed or timeout/);
    });

    expect(result.totalScore).toBe(0);
    expect(result.normalizedScore).toBe(0);
  });

  it('should fallback to Level 1 if answer is empty string', async () => {
    const result = await evaluateWithUniversalLlm({
      question: 'Test',
      answer: '   ', // Empty string / whitespace
      context: {},
      dimensionsArray: baseDimensions,
      frameworkLabel: 'Test Framework'
    });

    expect(deepseekService.callDeepSeek).not.toHaveBeenCalled();

    expect(result.dimensions).toHaveLength(2);
    result.dimensions.forEach(d => {
      expect(d.level).toBe(1);
      expect(d.score).toBe(0);
      expect(d.status).toBe('missing');
      expect(d.reason).toBe('Answer is entirely empty.');
    });
  });

  it('should handle LLM returning non-JSON garbage', async () => {
    deepseekService.callDeepSeek.mockResolvedValueOnce({
      content: 'I am a chatbot and I think the answer is good.'
    });

    const result = await evaluateWithUniversalLlm({
      question: 'Test',
      answer: 'Test',
      context: {},
      dimensionsArray: baseDimensions,
      frameworkLabel: 'Test Framework'
    });

    // It fails to parse and falls back gracefully
    expect(result.dimensions).toHaveLength(2);
    result.dimensions.forEach(d => {
      expect(d.level).toBe(1);
      expect(d.score).toBe(0);
    });
  });

  it('should safely cap levels outside 1-5 boundary', async () => {
    deepseekService.callDeepSeek.mockResolvedValueOnce({
      content: `[
  { "dimension": "Risk Identification", "level": 99, "reason": "Too good" },
  { "dimension": "Controls / Action", "level": -5, "reason": "Too bad" }
]`
    });

    const result = await evaluateWithUniversalLlm({
      question: 'Test',
      answer: 'Test',
      context: {},
      dimensionsArray: baseDimensions,
      frameworkLabel: 'Test Framework'
    });

    const risk = result.dimensions.find(d => d.key === 'riskIdentification');
    expect(risk.level).toBe(5); // Capped at 5
    expect(risk.score).toBe(10);

    const controls = result.dimensions.find(d => d.key === 'controls');
    expect(controls.level).toBe(1); // Capped at 1
    expect(controls.score).toBe(0);
  });
});
