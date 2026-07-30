import { describe, expect, it } from 'vitest';
import {
  TECHNICAL_TRADEOFF_DICTIONARY,
  REAL_WORLD_CLARIFICATION_PATTERNS,
  lookupRealWorldTradeOff,
  getDynamicFollowUpDepth,
} from '../../src/config/realWorldInterviewPatterns.js';

describe('realWorldInterviewPatterns', () => {
  it('contains trade-off questions for major engineering technologies', () => {
    expect(Object.keys(TECHNICAL_TRADEOFF_DICTIONARY).length).toBeGreaterThanOrEqual(25);
    expect(TECHNICAL_TRADEOFF_DICTIONARY.postgres.tradeOffQuestion).toContain('relational ACID compliance');
    expect(TECHNICAL_TRADEOFF_DICTIONARY.kafka.tradeOffQuestion).toContain('partition ordering guarantees');
    expect(TECHNICAL_TRADEOFF_DICTIONARY.websockets.tradeOffQuestion).toContain('persistent connections');
    expect(TECHNICAL_TRADEOFF_DICTIONARY.rag.tradeOffQuestion).toContain('vector retrieval depth');
    expect(TECHNICAL_TRADEOFF_DICTIONARY.kubernetes.tradeOffQuestion).toContain('control plane operational complexity');
    expect(TECHNICAL_TRADEOFF_DICTIONARY.graphql.tradeOffQuestion).toContain('N+1 query complexity');
  });

  it('correctly matches trade-off questions by technology topic', () => {
    const postgresMatch = lookupRealWorldTradeOff('PostgreSQL Database');
    expect(postgresMatch).not.toBeNull();
    expect(postgresMatch.label).toBe('PostgreSQL');

    const kafkaMatch = lookupRealWorldTradeOff('Apache Kafka Event Bus');
    expect(kafkaMatch).not.toBeNull();
    expect(kafkaMatch.label).toBe('Apache Kafka');

    const unknownMatch = lookupRealWorldTradeOff('Some Unknown Super Custom Framework');
    expect(unknownMatch).toBeNull();
  });

  it('provides supportive real-world clarification responses', () => {
    const meaningResponse = REAL_WORLD_CLARIFICATION_PATTERNS.ask_question_meaning('PostgreSQL');
    expect(meaningResponse).toContain('asking specifically about your experience with PostgreSQL');

    const exampleResponse = REAL_WORLD_CLARIFICATION_PATTERNS.ask_example_type('Docker');
    expect(exampleResponse).toContain('where you used Docker is ideal');
  });

  it('correctly matches trade-off questions for non-IT roles', () => {
    const pmMatch = lookupRealWorldTradeOff('Product Management Strategy');
    expect(pmMatch).not.toBeNull();
    expect(pmMatch.tradeOffQuestion).toContain('enterprise custom feature requests');

    const salesMatch = lookupRealWorldTradeOff('Sales & Business Development');
    expect(salesMatch).not.toBeNull();
    expect(salesMatch.tradeOffQuestion).toContain('offering aggressive end-of-quarter discounts');

    const marketingMatch = lookupRealWorldTradeOff('Digital Marketing & Growth');
    expect(marketingMatch).not.toBeNull();
    expect(marketingMatch.tradeOffQuestion).toContain('paid customer acquisition (CAC)');

    const hrMatch = lookupRealWorldTradeOff('Human Resources & Recruiting');
    expect(hrMatch).not.toBeNull();
    expect(hrMatch.tradeOffQuestion).toContain('time-to-fill hiring speed');
  });

  it('calculates dynamic follow-up depth based on claim complexity', () => {
    expect(getDynamicFollowUpDepth({ topic: 'System Architecture' })).toBe(3);
    expect(getDynamicFollowUpDepth({ topic: 'RAG Pipeline' })).toBe(3);
    expect(getDynamicFollowUpDepth({ claimComplexity: 'low', topic: 'basic crud' })).toBe(1);
    expect(getDynamicFollowUpDepth({ claimComplexity: 'medium', topic: 'standard feature' })).toBe(2);
  });
});
