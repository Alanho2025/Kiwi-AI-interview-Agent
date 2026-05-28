import { describe, it, expect } from 'vitest';
import {
    validateAnalyzeOutput,
    validateInterviewPlan,
    validateReportOutput,
    validateReportQaOutput,
} from '../../src/services/schemaValidationService.js';

describe('schemaValidationService', () => {
    describe('validateAnalyzeOutput', () => {
        it('should return valid output with defaults when given empty object', () => {
            const result = validateAnalyzeOutput({});

            expect(result.candidateName).toBe('Candidate');
            expect(result.jobTitle).toBe('Target Role');
            expect(result.overallScore).toBe(0);
            expect(result.confidence).toBe(0.4);
            expect(result.decision).toEqual({ label: 'manual_review', reasonCodes: [] });
            expect(result.macroScores).toEqual([]);
            expect(result.microScores).toEqual([]);
            expect(result.requirementChecks).toEqual([]);
            expect(result.explanation).toHaveProperty('strengths');
            expect(result.explanation).toHaveProperty('gaps');
            expect(result.explanation).toHaveProperty('risks');
            expect(result.explanation).toHaveProperty('summary');
        });

        it('should preserve valid input values', () => {
            const input = {
                candidateName: 'John Doe',
                jobTitle: 'Senior Developer',
                overallScore: 85,
                confidence: 0.9,
                decision: { label: 'hire', reasonCodes: ['strong_match'] },
            };

            const result = validateAnalyzeOutput(input);

            expect(result.candidateName).toBe('John Doe');
            expect(result.jobTitle).toBe('Senior Developer');
            expect(result.overallScore).toBe(85);
            expect(result.confidence).toBe(0.9);
            expect(result.decision).toEqual({ label: 'hire', reasonCodes: ['strong_match'] });
        });

        it('should use matchScore as fallback for overallScore', () => {
            const result = validateAnalyzeOutput({ matchScore: 75 });
            expect(result.overallScore).toBe(75);
        });

        it('should normalize explanation object', () => {
            const input = {
                explanation: {
                    strengths: ['Good communication'],
                    gaps: ['Needs more experience'],
                    risks: ['Limited availability'],
                    summary: 'Overall good candidate',
                },
            };

            const result = validateAnalyzeOutput(input);

            expect(result.explanation.strengths).toEqual(['Good communication']);
            expect(result.explanation.gaps).toEqual(['Needs more experience']);
            expect(result.explanation.risks).toEqual(['Limited availability']);
            expect(result.explanation.summary).toBe('Overall good candidate');
        });

        it('should handle invalid types gracefully', () => {
            const result = validateAnalyzeOutput(null);

            expect(result.candidateName).toBe('Candidate');
            expect(result.overallScore).toBe(0);
        });

        it('should preserve arrays as-is (no filtering)', () => {
            const input = {
                macroScores: [1, null, 2, undefined, 3, false, 4],
                microScores: ['a', '', 'b', null, 'c'],
            };

            const result = validateAnalyzeOutput(input);

            // ensureArray doesn't filter, it just ensures it's an array
            expect(result.macroScores).toEqual([1, null, 2, undefined, 3, false, 4]);
            expect(result.microScores).toEqual(['a', '', 'b', null, 'c']);
        });

        it('should normalize legacy fields to top-level properties', () => {
            const input = {
                interviewFocus: ['Technical skills', 'Communication'],
                planPreview: 'Focus on backend development',
            };

            const result = validateAnalyzeOutput(input);

            // buildAnalyzeOutput flattens legacy fields to top-level properties
            expect(result).toHaveProperty('interviewFocus');
            expect(result).toHaveProperty('planPreview');
            expect(result.interviewFocus).toEqual(['Technical skills', 'Communication']);
            expect(result.planPreview).toBe('Focus on backend development');
        });

        it('should handle nested legacy object', () => {
            const input = {
                legacy: {
                    interviewFocus: ['Leadership'],
                    planPreview: 'Management assessment',
                },
            };

            const result = validateAnalyzeOutput(input);

            // buildAnalyzeOutput flattens legacy fields to top-level properties
            expect(result).toHaveProperty('interviewFocus');
            expect(result).toHaveProperty('planPreview');
            expect(result.interviewFocus).toEqual(['Leadership']);
            expect(result.planPreview).toBe('Management assessment');
        });
    });

    describe('validateInterviewPlan', () => {
        it('should return valid plan with defaults when given empty object', () => {
            const result = validateInterviewPlan({});

            expect(result.schemaVersion).toBe('v3');
            expect(result.candidateName).toBe('Candidate');
            expect(result.jobTitle).toBe('Target Role');
            expect(result.matchScore).toBe(0);
            expect(result.confidence).toBe(0.4);
            expect(result.decision).toEqual({ label: 'manual_review', reasonCodes: [] });
            expect(result.requirementChecks).toEqual([]);
            expect(result.interviewFocus).toEqual([]);
            expect(result.planPreview).toBe('');
            expect(result.questionPool).toEqual([]);
        });

        it('should preserve valid input values', () => {
            const input = {
                schemaVersion: 'v4',
                candidateName: 'Jane Smith',
                jobTitle: 'Product Manager',
                matchScore: 90,
                confidence: 0.95,
                planPreview: 'Focus on product strategy',
            };

            const result = validateInterviewPlan(input);

            expect(result.schemaVersion).toBe('v4');
            expect(result.candidateName).toBe('Jane Smith');
            expect(result.jobTitle).toBe('Product Manager');
            expect(result.matchScore).toBe(90);
            expect(result.confidence).toBe(0.95);
            expect(result.planPreview).toBe('Focus on product strategy');
        });

        it('should normalize explanation object', () => {
            const input = {
                explanation: {
                    strengths: ['Strong leadership'],
                    gaps: [],
                    risks: ['New to industry'],
                    summary: 'Promising candidate',
                },
            };

            const result = validateInterviewPlan(input);

            expect(result.explanation.strengths).toEqual(['Strong leadership']);
            expect(result.explanation.gaps).toEqual([]);
            expect(result.explanation.risks).toEqual(['New to industry']);
            expect(result.explanation.summary).toBe('Promising candidate');
        });

        it('should handle strategy and fallbackRules objects', () => {
            const input = {
                strategy: { approach: 'behavioral' },
                fallbackRules: { maxRetries: 3 },
                settingsSnapshot: { voiceEnabled: true },
            };

            const result = validateInterviewPlan(input);

            expect(result.strategy).toEqual({ approach: 'behavioral' });
            expect(result.fallbackRules).toEqual({ maxRetries: 3 });
            expect(result.settingsSnapshot).toEqual({ voiceEnabled: true });
        });
    });

    describe('validateReportOutput', () => {
        it('should return valid report with defaults when given empty object', () => {
            const result = validateReportOutput({});

            expect(result.schemaVersion).toBe('v3');
            expect(result.id).toBe('');
            expect(result.sessionId).toBe('');
            expect(result.candidateName).toBe('Candidate');
            expect(result.jobTitle).toBe('Target Role');
            expect(result.status).toBe('draft');
            expect(result.summary).toBe('');
            expect(result.sections).toEqual([]);
            expect(result.recommendations).toEqual([]);
        });

        it('should use sessionId as fallback for id', () => {
            const result = validateReportOutput({ sessionId: 'session-123' });
            expect(result.id).toBe('session-123');
            expect(result.sessionId).toBe('session-123');
        });

        it('should normalize sections with defaults', () => {
            const input = {
                sections: [
                    { id: 's1', title: 'Summary', content: 'Good performance' },
                    { title: 'Details' },
                    {},
                ],
            };

            const result = validateReportOutput(input);

            expect(result.sections).toHaveLength(3);
            expect(result.sections[0]).toEqual({ id: 's1', title: 'Summary', content: 'Good performance' });
            expect(result.sections[1]).toEqual({ id: 'section_2', title: 'Details', content: '' });
            expect(result.sections[2]).toEqual({ id: 'section_3', title: 'Section 3', content: '' });
        });

        it('should normalize NZ workplace fit', () => {
            const input = {
                nzWorkplaceFit: {
                    enabled: true,
                    score: 8.5,
                    summary: 'Strong cultural fit',
                    dimensionScores: [
                        { id: 'teamwork', label: 'Teamwork', score: 9, observed: true, riskDetected: false },
                    ],
                    strengths: ['Collaborative'],
                    gaps: [],
                    evidence: [{ dimension: 'Teamwork', quote: 'Works well with others', signal: 'strength' }],
                },
            };

            const result = validateReportOutput(input);

            expect(result.nzWorkplaceFit.enabled).toBe(true);
            expect(result.nzWorkplaceFit.score).toBe(8.5);
            expect(result.nzWorkplaceFit.summary).toBe('Strong cultural fit');
            expect(result.nzWorkplaceFit.dimensionScores).toHaveLength(1);
            expect(result.nzWorkplaceFit.strengths).toEqual(['Collaborative']);
            expect(result.nzWorkplaceFit.evidence).toHaveLength(1);
        });

        it('should normalize voice delivery summary', () => {
            const input = {
                voiceDeliverySummary: {
                    turnCount: 10,
                    averageWordsPerMinute: 150,
                    averageSpeakingDurationSeconds: 45,
                    totalFillerCount: 5,
                    deliveryConfidence: 'high',
                    feedback: ['Clear speech', 'Good pace'],
                },
            };

            const result = validateReportOutput(input);

            expect(result.voiceDeliverySummary.turnCount).toBe(10);
            expect(result.voiceDeliverySummary.averageWordsPerMinute).toBe(150);
            expect(result.voiceDeliverySummary.totalFillerCount).toBe(5);
            expect(result.voiceDeliverySummary.feedback).toEqual(['Clear speech', 'Good pace']);
        });

        it('should normalize company motivation fit', () => {
            const input = {
                companyMotivationFit: {
                    source: 'company_website',
                    score: 7.5,
                    summary: 'Good alignment with company values',
                    matchedValues: [
                        { value: 'Innovation', candidateQuote: 'I love building new things', comment: 'Strong match' },
                    ],
                    missingValues: [],
                },
            };

            const result = validateReportOutput(input);

            expect(result.companyMotivationFit.source).toBe('company_website');
            expect(result.companyMotivationFit.score).toBe(7.5);
            expect(result.companyMotivationFit.matchedValues).toHaveLength(1);
        });

        it('should normalize candidate feedback with all sections', () => {
            const input = {
                candidateFeedback: {
                    overallTakeaway: 'Strong candidate',
                    scoreBand: 'high',
                    generationSource: 'ai',
                    scoreExplanations: {
                        overall: { summary: 'Excellent performance' },
                    },
                    communicationProfile: {
                        summary: 'Clear communicator',
                        keyTraits: [{ id: 't1', label: 'Clarity', value: 8 }],
                    },
                    turnBreakdowns: [
                        {
                            question: 'Tell me about yourself',
                            answer: 'I am a developer',
                            feedback: 'Good introduction',
                            scores: { business: 7, logic: 8, evidence: 7 },
                        },
                    ],
                },
            };

            const result = validateReportOutput(input);

            expect(result.candidateFeedback.overallTakeaway).toBe('Strong candidate');
            expect(result.candidateFeedback.scoreBand).toBe('high');
            expect(result.candidateFeedback.communicationProfile.summary).toBe('Clear communicator');
            expect(result.candidateFeedback.turnBreakdowns).toHaveLength(1);
        });

        it('should handle turn breakdown with STAR structure', () => {
            const input = {
                candidateFeedback: {
                    turnBreakdowns: [
                        {
                            question: 'Describe a challenge',
                            answer: 'I faced a deadline issue',
                            starBreakdown: {
                                situation: 'clear',
                                task: 'clear',
                                action: 'partial',
                                result: 'missing',
                                mainMissingElement: 'result',
                                scoreReason: 'Missing outcome',
                            },
                            scores: { business: 6, logic: 7, evidence: 5 },
                        },
                    ],
                },
            };

            const result = validateReportOutput(input);

            const turn = result.candidateFeedback.turnBreakdowns[0];
            expect(turn.starBreakdown.situation).toBe('clear');
            expect(turn.starBreakdown.action).toBe('partial');
            expect(turn.starBreakdown.result).toBe('missing');
            expect(turn.starBreakdown.mainMissingElement).toBe('result');
        });

        it('should handle non-STAR turn breakdown', () => {
            const input = {
                candidateFeedback: {
                    turnBreakdowns: [
                        {
                            question: 'What is your strength?',
                            answer: 'Problem solving',
                            starApplicable: false,
                            structureBreakdown: {
                                mainMissingElement: 'example',
                                scoreReason: 'Needs concrete example',
                            },
                            scores: { business: 7, logic: 7, evidence: 6 },
                        },
                    ],
                },
            };

            const result = validateReportOutput(input);

            const turn = result.candidateFeedback.turnBreakdowns[0];
            expect(turn.starApplicable).toBe(false);
            expect(turn.starBreakdown).toBe(null);
            expect(turn.structureLabel).toBe('Answer structure');
            expect(turn.structureBreakdown.mainMissingElement).toBe('example');
        });

        it('should normalize evidence labels and confidence levels', () => {
            const input = {
                candidateFeedback: {
                    plainEnglishMetrics: [
                        { id: 'm1', evidenceLabel: 'supported_by_cv', confidenceLevel: 'high' },
                        { id: 'm2', evidenceLabel: 'invalid_label', confidenceLevel: 'invalid_level' },
                    ],
                },
            };

            const result = validateReportOutput(input);

            expect(result.candidateFeedback.plainEnglishMetrics[0].evidenceLabel).toBe('supported_by_cv');
            expect(result.candidateFeedback.plainEnglishMetrics[0].confidenceLevel).toBe('high');
            expect(result.candidateFeedback.plainEnglishMetrics[1].evidenceLabel).toBe('supported_by_answer');
            expect(result.candidateFeedback.plainEnglishMetrics[1].confidenceLevel).toBe('medium');
        });

        it('should normalize feedback status', () => {
            const input = {
                candidateFeedback: {
                    strengthHighlights: [
                        { id: 's1', feedbackStatus: 'confirmed_feedback' },
                        { id: 's2', feedbackStatus: 'invalid_status' },
                    ],
                },
            };

            const result = validateReportOutput(input);

            expect(result.candidateFeedback.strengthHighlights[0].feedbackStatus).toBe('confirmed_feedback');
            expect(result.candidateFeedback.strengthHighlights[1].feedbackStatus).toBe('confirmed_feedback');
        });
    });

    describe('validateReportQaOutput', () => {
        it('should return valid QA output with defaults when given empty object', () => {
            const result = validateReportQaOutput({});

            expect(result.schemaVersion).toBe('v3');
            expect(result.reportId).toBe('');
            expect(result.status).toBe('needs_review');
            expect(result.qualityFlags).toEqual([]);
            expect(result.consistencyChecks).toEqual([]);
            expect(result.coverageScore).toBe(0);
            expect(result.hallucinationRisk).toBe('unknown');
            expect(result.passed).toBe(false);
            expect(result.diagnostics).toEqual({});
        });

        it('should set status to ready when passed is true', () => {
            const result = validateReportQaOutput({ passed: true });
            expect(result.status).toBe('ready');
            expect(result.passed).toBe(true);
        });

        it('should handle pass as alias for passed', () => {
            const result = validateReportQaOutput({ pass: true });
            expect(result.status).toBe('ready');
            expect(result.passed).toBe(true);
        });

        it('should preserve valid input values', () => {
            const input = {
                schemaVersion: 'v4',
                reportId: 'report-123',
                status: 'ready',
                qualityFlags: ['complete', 'accurate'],
                consistencyChecks: ['passed'],
                coverageScore: 95,
                hallucinationRisk: 'low',
                passed: true,
                diagnostics: { checkCount: 10 },
            };

            const result = validateReportQaOutput(input);

            expect(result.schemaVersion).toBe('v4');
            expect(result.reportId).toBe('report-123');
            expect(result.status).toBe('ready');
            expect(result.qualityFlags).toEqual(['complete', 'accurate']);
            expect(result.coverageScore).toBe(95);
            expect(result.hallucinationRisk).toBe('low');
            expect(result.passed).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('should handle null inputs', () => {
            // validateAnalyzeOutput converts null to {} via isObject check
            expect(() => validateAnalyzeOutput(null)).not.toThrow();

            // validateInterviewPlan and validateReportOutput access properties directly
            // They will throw TypeError when given null
            expect(() => validateInterviewPlan(null)).toThrow(TypeError);
            expect(() => validateReportOutput(null)).toThrow(TypeError);

            // validateReportQaOutput also accesses properties directly
            expect(() => validateReportQaOutput(null)).toThrow(TypeError);
        });

        it('should handle undefined inputs', () => {
            expect(() => validateAnalyzeOutput(undefined)).not.toThrow();
            expect(() => validateInterviewPlan(undefined)).not.toThrow();
            expect(() => validateReportOutput(undefined)).not.toThrow();
            expect(() => validateReportQaOutput(undefined)).not.toThrow();
        });

        it('should handle arrays as input', () => {
            const result = validateAnalyzeOutput([]);
            expect(result.candidateName).toBe('Candidate');
        });

        it('should handle primitive values as input', () => {
            expect(() => validateAnalyzeOutput('string')).not.toThrow();
            expect(() => validateAnalyzeOutput(123)).not.toThrow();
            expect(() => validateAnalyzeOutput(true)).not.toThrow();
        });
    });
});

// Made with Bob
