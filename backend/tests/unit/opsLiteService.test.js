import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs/promises';

// Mock dependencies before importing the service
vi.mock('node:fs/promises');
vi.mock('../../src/db/models/sessionAnalysisModel.js', () => ({
    SessionAnalysis: {
        find: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        allowDiskUse: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn(),
    },
}));
vi.mock('../../src/db/models/sessionReportModel.js', () => ({
    SessionReport: {
        find: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn(),
    },
}));

const { buildEvalReportSummary, buildRuntimeOpsSummary, buildOpsLiteSummary } = await import('../../src/services/opsLiteService.js');
const { SessionAnalysis } = await import('../../src/db/models/sessionAnalysisModel.js');
const { SessionReport } = await import('../../src/db/models/sessionReportModel.js');

describe('opsLiteService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('buildEvalReportSummary', () => {
        describe('when report directory not found', () => {
            beforeEach(() => {
                fs.stat.mockRejectedValue(new Error('ENOENT'));
            });

            it('should return empty summary with reportDirectoryFound false', async () => {
                const result = await buildEvalReportSummary();

                expect(result.reportDirectoryFound).toBe(false);
                expect(result.totalSuites).toBe(0);
                expect(result.totalCases).toBe(0);
                expect(result.averageScore).toBe(0);
                expect(result.passRate).toBe(0);
                expect(result.warningCaseCount).toBe(0);
                expect(result.failedSuites).toEqual([]);
                expect(result.failedCases).toEqual([]);
                expect(result.suites).toEqual([]);
            });

            it('should include all group categories', async () => {
                const result = await buildEvalReportSummary();

                expect(result.groups).toHaveProperty('analysisQuality');
                expect(result.groups).toHaveProperty('trajectoryQuality');
                expect(result.groups).toHaveProperty('groundingSafety');
                expect(result.groups).toHaveProperty('voiceQuality');
                expect(result.groups).toHaveProperty('reliability');
            });

            it('should include risk coverage for all categories', async () => {
                const result = await buildEvalReportSummary();

                expect(result.riskCoverage).toHaveLength(10);
                expect(result.riskCoverage[0]).toHaveProperty('category');
                expect(result.riskCoverage[0]).toHaveProperty('covered');
                expect(result.riskCoverage[0]).toHaveProperty('suiteCount');
                expect(result.riskCoverage.every(item => item.covered === false)).toBe(true);
            });
        });

        describe('when report directory exists but is empty', () => {
            beforeEach(() => {
                fs.stat.mockResolvedValue({ isDirectory: () => true });
                fs.readdir.mockResolvedValue([]);
            });

            it('should return summary with reportDirectoryFound true but no suites', async () => {
                const result = await buildEvalReportSummary();

                expect(result.reportDirectoryFound).toBe(true);
                expect(result.totalSuites).toBe(0);
                expect(result.suites).toEqual([]);
            });
        });

        describe('when report directory contains valid reports', () => {
            beforeEach(() => {
                fs.stat.mockResolvedValue({ isDirectory: () => true });
                fs.readdir.mockResolvedValue([
                    'cv-parse-eval.latest.json',
                    'interview-controller-eval.latest.json',
                    'not-a-report.txt',
                ]);
            });

            it('should parse passing suite correctly', async () => {
                fs.readFile.mockImplementation((filePath) => {
                    if (filePath.includes('cv-parse-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.85,
                            casesRun: 10,
                            results: [
                                { id: 'case1', score: 0.9, failedChecks: [] },
                                { id: 'case2', score: 0.8, failedChecks: [] },
                            ],
                            thresholds: { minAverage: 0.7, failBelow: 0.6 },
                            generatedAt: '2024-01-01T00:00:00Z',
                        }));
                    }
                    return Promise.resolve(null);
                });

                const result = await buildEvalReportSummary();

                expect(result.totalSuites).toBe(1);
                expect(result.suites[0]).toMatchObject({
                    id: 'cv-parse-eval',
                    label: 'CV parse analysis',
                    group: 'analysisQuality',
                    casesRun: 10,
                    average: 0.85,
                    passed: true,
                    warningStatus: 'strong_pass',
                    failedCaseCount: 0,
                });
            });

            it('should parse failing suite correctly', async () => {
                fs.readFile.mockImplementation((filePath) => {
                    if (filePath.includes('cv-parse-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.5,
                            casesRun: 5,
                            results: [
                                { id: 'case1', score: 0.4, failedChecks: ['check1', 'check2'] },
                                { id: 'case2', score: 0.6, failedChecks: [] },
                            ],
                            thresholds: { minAverage: 0.7, failBelow: 0.6 },
                        }));
                    }
                    return Promise.resolve(null);
                });

                const result = await buildEvalReportSummary();

                expect(result.suites[0].passed).toBe(false);
                expect(result.suites[0].warningStatus).toBe('needs_work');
                expect(result.suites[0].failedCaseCount).toBe(1);
                expect(result.suites[0].failedCases).toHaveLength(1);
                expect(result.suites[0].failedCases[0]).toMatchObject({
                    id: 'case1',
                    score: 0.4,
                    failedChecks: ['check1', 'check2'],
                });
            });

            it('should handle suite with warnings (passed but has failed cases)', async () => {
                fs.readFile.mockImplementation((filePath) => {
                    if (filePath.includes('cv-parse-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.85,
                            casesRun: 10,
                            results: [
                                { id: 'case1', score: 0.9, failedChecks: [] },
                                { id: 'case2', score: 0.8, failedChecks: ['minor_issue'] },
                            ],
                            thresholds: { minAverage: 0.7, failBelow: 0.5 },
                        }));
                    }
                    return Promise.resolve(null);
                });

                const result = await buildEvalReportSummary();

                expect(result.suites[0].passed).toBe(true);
                expect(result.suites[0].warningStatus).toBe('pass_with_warnings');
                expect(result.suites[0].failedCaseCount).toBe(1);
            });

            it('should calculate overall statistics correctly', async () => {
                fs.readFile.mockImplementation((filePath) => {
                    if (filePath.includes('cv-parse-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.8,
                            casesRun: 10,
                            results: [],
                            thresholds: { minAverage: 0.7 },
                        }));
                    }
                    if (filePath.includes('interview-controller-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.6,
                            casesRun: 5,
                            results: [{ id: 'case1', score: 0.5, failedChecks: ['check1'] }],
                            thresholds: { minAverage: 0.7 },
                        }));
                    }
                    return Promise.resolve(null);
                });

                const result = await buildEvalReportSummary();

                expect(result.totalSuites).toBe(2);
                expect(result.totalCases).toBe(15);
                expect(result.averageScore).toBe(0.7); // (0.8 + 0.6) / 2
                expect(result.passRate).toBe(0.5); // 1 passed out of 2
                expect(result.warningCaseCount).toBe(1);
                expect(result.failedSuites).toEqual(['Interview decision control']);
            });

            it('should group suites by category', async () => {
                fs.readFile.mockImplementation((filePath) => {
                    if (filePath.includes('cv-parse-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.8,
                            casesRun: 10,
                            results: [],
                            thresholds: { minAverage: 0.7 },
                        }));
                    }
                    if (filePath.includes('interview-controller-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.9,
                            casesRun: 5,
                            results: [],
                            thresholds: { minAverage: 0.7 },
                        }));
                    }
                    return Promise.resolve(null);
                });

                const result = await buildEvalReportSummary();

                expect(result.groups.analysisQuality).toHaveLength(1);
                expect(result.groups.trajectoryQuality).toHaveLength(1);
                expect(result.groups.analysisQuality[0].id).toBe('cv-parse-eval');
                expect(result.groups.trajectoryQuality[0].id).toBe('interview-controller-eval');
            });

            it('should calculate risk coverage correctly', async () => {
                fs.readFile.mockImplementation((filePath) => {
                    if (filePath.includes('cv-parse-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.8,
                            casesRun: 10,
                            results: [],
                            thresholds: { minAverage: 0.7 },
                        }));
                    }
                    return Promise.resolve(null);
                });

                const result = await buildEvalReportSummary();

                const cvJdAlignmentCoverage = result.riskCoverage.find(item => item.category === 'cv_jd_alignment');
                expect(cvJdAlignmentCoverage.covered).toBe(true);
                expect(cvJdAlignmentCoverage.suiteCount).toBe(1);

                const voiceQualityCoverage = result.riskCoverage.find(item => item.category === 'voice_quality');
                expect(voiceQualityCoverage.covered).toBe(false);
                expect(voiceQualityCoverage.suiteCount).toBe(0);
            });

            it('should handle plan eval suite format', async () => {
                fs.readFile.mockImplementation((filePath) => {
                    if (filePath.includes('plan-eval-suite')) {
                        return Promise.resolve(JSON.stringify({
                            label: 'Plan Eval Suite Summary',
                            suitesAttempted: 5,
                            reportsAvailable: 5,
                            processPassRate: 1,
                        }));
                    }
                    return Promise.resolve(null);
                });

                fs.readdir.mockResolvedValue(['plan-eval-suite.latest.json']);

                const result = await buildEvalReportSummary();

                expect(result.suites[0].passed).toBe(true);
            });

            it('should limit failed cases to 8 per suite', async () => {
                const manyFailedCases = Array.from({ length: 15 }, (_, i) => ({
                    id: `case${i}`,
                    score: 0.3,
                    failedChecks: ['check1'],
                }));

                fs.readFile.mockImplementation((filePath) => {
                    if (filePath.includes('cv-parse-eval')) {
                        return Promise.resolve(JSON.stringify({
                            average: 0.3,
                            casesRun: 15,
                            results: manyFailedCases,
                            thresholds: { minAverage: 0.7, failBelow: 0.6 },
                        }));
                    }
                    return Promise.resolve(null);
                });

                const result = await buildEvalReportSummary();

                expect(result.suites[0].failedCases).toHaveLength(8);
            });

            it('should limit overall failed cases to 20', async () => {
                const manyFailedCases = Array.from({ length: 30 }, (_, i) => ({
                    id: `case${i}`,
                    score: 0.3,
                    failedChecks: ['check1'],
                }));

                fs.readFile.mockImplementation(() => {
                    return Promise.resolve(JSON.stringify({
                        average: 0.3,
                        casesRun: 30,
                        results: manyFailedCases,
                        thresholds: { minAverage: 0.7, failBelow: 0.6 },
                    }));
                });

                fs.readdir.mockResolvedValue(['suite1.latest.json', 'suite2.latest.json']);

                const result = await buildEvalReportSummary();

                expect(result.failedCases.length).toBeLessThanOrEqual(20);
            });
        });

        describe('threshold validation', () => {
            beforeEach(() => {
                fs.stat.mockResolvedValue({ isDirectory: () => true });
                fs.readdir.mockResolvedValue(['test-suite.latest.json']);
            });

            it('should pass when average meets minAverage threshold', async () => {
                fs.readFile.mockResolvedValue(JSON.stringify({
                    average: 0.75,
                    casesRun: 5,
                    results: [{ id: 'case1', score: 0.75, failedChecks: [] }],
                    thresholds: { minAverage: 0.7, failBelow: 0.6 },
                }));

                const result = await buildEvalReportSummary();
                expect(result.suites[0].passed).toBe(true);
            });

            it('should fail when average below minAverage threshold', async () => {
                fs.readFile.mockResolvedValue(JSON.stringify({
                    average: 0.65,
                    casesRun: 5,
                    results: [{ id: 'case1', score: 0.65, failedChecks: [] }],
                    thresholds: { minAverage: 0.7, failBelow: 0.6 },
                }));

                const result = await buildEvalReportSummary();
                expect(result.suites[0].passed).toBe(false);
            });

            it('should fail when any case below failBelow threshold', async () => {
                fs.readFile.mockResolvedValue(JSON.stringify({
                    average: 0.8,
                    casesRun: 5,
                    results: [
                        { id: 'case1', score: 0.9, failedChecks: [] },
                        { id: 'case2', score: 0.5, failedChecks: [] },
                    ],
                    thresholds: { minAverage: 0.7, failBelow: 0.6 },
                }));

                const result = await buildEvalReportSummary();
                expect(result.suites[0].passed).toBe(false);
            });

            it('should handle critical score thresholds', async () => {
                fs.readFile.mockResolvedValue(JSON.stringify({
                    average: 0.8,
                    criticalAverage: 0.9,
                    casesRun: 5,
                    results: [
                        { id: 'case1', score: 0.8, criticalScore: 0.9, failedChecks: [] },
                    ],
                    thresholds: {
                        minAverage: 0.7,
                        failBelow: 0.6,
                        minCriticalAverage: 0.85,
                        criticalFailBelow: 0.8,
                    },
                }));

                const result = await buildEvalReportSummary();
                expect(result.suites[0].passed).toBe(true);
            });

            it('should fail when critical average below threshold', async () => {
                fs.readFile.mockResolvedValue(JSON.stringify({
                    average: 0.8,
                    criticalAverage: 0.7,
                    casesRun: 5,
                    results: [
                        { id: 'case1', score: 0.8, criticalScore: 0.7, failedChecks: [] },
                    ],
                    thresholds: {
                        minAverage: 0.7,
                        failBelow: 0.6,
                        minCriticalAverage: 0.85,
                        criticalFailBelow: 0.8,
                    },
                }));

                const result = await buildEvalReportSummary();
                expect(result.suites[0].passed).toBe(false);
            });
        });

        describe('edge cases', () => {
            beforeEach(() => {
                fs.stat.mockResolvedValue({ isDirectory: () => true });
                fs.readdir.mockResolvedValue(['test-suite.latest.json']);
            });

            it('should handle missing thresholds gracefully', async () => {
                fs.readFile.mockResolvedValue(JSON.stringify({
                    average: 0.8,
                    casesRun: 5,
                    results: [],
                }));

                const result = await buildEvalReportSummary();
                expect(result.suites[0].passed).toBe(true);
            });

            it('should handle malformed JSON files', async () => {
                fs.readFile.mockResolvedValue('invalid json');

                const result = await buildEvalReportSummary();
                expect(result.totalSuites).toBe(0);
            });

            it('should handle unknown suite IDs', async () => {
                fs.readFile.mockResolvedValue(JSON.stringify({
                    average: 0.8,
                    casesRun: 5,
                    results: [],
                    thresholds: { minAverage: 0.7 },
                }));

                fs.readdir.mockResolvedValue(['unknown-suite-id.latest.json']);

                const result = await buildEvalReportSummary();
                expect(result.suites[0].group).toBe('reliability');
                expect(result.suites[0].label).toBe('unknown suite id');
            });

            it('should handle empty results array', async () => {
                fs.readFile.mockResolvedValue(JSON.stringify({
                    average: 0.8,
                    casesRun: 0,
                    results: [],
                    thresholds: { minAverage: 0.7 },
                }));

                const result = await buildEvalReportSummary();
                expect(result.suites[0].casesRun).toBe(0);
                expect(result.suites[0].failedCaseCount).toBe(0);
            });
        });
    });

    describe('buildRuntimeOpsSummary', () => {
        describe('when no sessions exist', () => {
            beforeEach(() => {
                SessionAnalysis.lean.mockResolvedValue([]);
                SessionReport.lean.mockResolvedValue([]);
            });

            it('should return empty overview', async () => {
                const result = await buildRuntimeOpsSummary();

                expect(result.overview.totalSessions).toBe(0);
                expect(result.overview.textSessions).toBe(0);
                expect(result.overview.voiceSessions).toBe(0);
                expect(result.overview.averageCoachingConfidence).toBe(0);
                expect(result.overview.averageReportQualityScore).toBe(0);
                expect(result.overview.runtimeQaPassRate).toBe(0);
                expect(result.overview.modelAssistedTurnRate).toBe(0);
            });

            it('should return empty latency metrics', async () => {
                const result = await buildRuntimeOpsSummary();

                expect(result.latency.traceSampleCount).toBe(0);
                expect(result.latency.voiceLatencySampleCount).toBe(0);
                expect(result.latency.voiceResponseLatencyMs).toBe(0);
                expect(result.latency.runtimeTraceTotalMs).toBe(0);
            });

            it('should return empty RAG metrics', async () => {
                const result = await buildRuntimeOpsSummary();

                expect(result.rag.activationRate).toBe(0);
                expect(result.rag.sourceUsage).toEqual({});
                expect(result.rag.degradedRetrievalRate).toBe(0);
                expect(result.rag.unsupportedEvidenceBlockedCount).toBe(0);
            });

            it('should return empty voice metrics', async () => {
                const result = await buildRuntimeOpsSummary();

                expect(result.voice.sessionsWithVoiceMetrics).toBe(0);
                expect(result.voice.averageWordsPerMinute).toBe(0);
                expect(result.voice.totalFillerCount).toBe(0);
                expect(result.voice.totalLongPauseCount).toBe(0);
                expect(result.voice.lowConfidenceDeliverySessions).toBe(0);
            });
        });

        describe('when sessions exist', () => {
            const mockAnalyses = [
                {
                    sessionId: 'session1',
                    userId: 'user1',
                    agentTraceEvents: [
                        {
                            mode: 'text',
                            retrievalSources: ['cv', 'jd'],
                            latencyBreakdown: {
                                voiceResponseLatencyMs: 2500,
                                totalTurnMs: 5000,
                                sttMs: 500,
                                retrievalMs: 800,
                                planningMs: 300,
                            },
                        },
                    ],
                    trajectoryRecords: [
                        { selectionSource: 'model_assisted' },
                        { selectionSource: 'deterministic' },
                    ],
                    reportArtifacts: [
                        {
                            qaResult: { coverageScore: 0.85, passed: true },
                            report: {
                                evidenceDiagnostics: {
                                    claimEvidence: {
                                        totalClaims: 10,
                                        downgradedClaims: 2,
                                        needsConfirmationClaims: 1,
                                    },
                                },
                            },
                        },
                    ],
                    latestVoiceDeliverySummary: {
                        averageWordsPerMinute: 150,
                        totalFillerCount: 5,
                        totalLongPauseCount: 2,
                        deliveryConfidence: 'high',
                    },
                },
            ];

            beforeEach(() => {
                SessionAnalysis.lean.mockResolvedValue(mockAnalyses);
                SessionReport.lean.mockResolvedValue([]);
            });

            it('should calculate overview metrics correctly', async () => {
                const result = await buildRuntimeOpsSummary();

                expect(result.overview.totalSessions).toBe(1);
                expect(result.overview.textSessions).toBe(1);
                expect(result.overview.voiceSessions).toBe(1);
                expect(result.overview.averageCoachingConfidence).toBe(0.85);
                expect(result.overview.runtimeQaPassRate).toBe(1);
                expect(result.overview.modelAssistedTurnRate).toBe(0.5);
            });

            it('should calculate latency metrics correctly', async () => {
                const result = await buildRuntimeOpsSummary();

                expect(result.latency.traceSampleCount).toBe(1);
                expect(result.latency.voiceLatencySampleCount).toBe(1);
                expect(result.latency.voiceResponseLatencyMs).toBe(2500);
                expect(result.latency.runtimeTraceTotalMs).toBe(5000);
                expect(result.latency.sttMs).toBe(500);
                expect(result.latency.retrievalMs).toBe(800);
                expect(result.latency.planningMs).toBe(300);
            });

            it('should calculate RAG metrics correctly', async () => {
                const result = await buildRuntimeOpsSummary();

                expect(result.rag.activationRate).toBe(1);
                expect(result.rag.sourceUsage).toEqual({ cv: 1, jd: 1 });
                expect(result.rag.degradedRetrievalRate).toBe(0.2);
                expect(result.rag.unsupportedEvidenceBlockedCount).toBe(1);
            });

            it('should calculate voice metrics correctly', async () => {
                const result = await buildRuntimeOpsSummary();

                expect(result.voice.sessionsWithVoiceMetrics).toBe(1);
                expect(result.voice.averageWordsPerMinute).toBe(150);
                expect(result.voice.totalFillerCount).toBe(5);
                expect(result.voice.totalLongPauseCount).toBe(2);
                expect(result.voice.lowConfidenceDeliverySessions).toBe(0);
            });

            it('should filter by userId when provided', async () => {
                await buildRuntimeOpsSummary({ userId: 'user1' });

                expect(SessionAnalysis.find).toHaveBeenCalledWith({ userId: 'user1' });
            });

            it('should handle multiple sessions', async () => {
                SessionAnalysis.lean.mockResolvedValue([
                    ...mockAnalyses,
                    {
                        sessionId: 'session2',
                        agentTraceEvents: [{ mode: 'voice' }],
                        trajectoryRecords: [],
                        reportArtifacts: [
                            { qaResult: { coverageScore: 0.75, passed: false } },
                        ],
                    },
                ]);

                const result = await buildRuntimeOpsSummary();

                expect(result.overview.totalSessions).toBe(2);
                expect(result.overview.runtimeQaPassRate).toBe(0.5);
            });
        });

        describe('latency resolution', () => {
            it('should resolve voice response latency from multiple sources', async () => {
                SessionAnalysis.lean.mockResolvedValue([
                    {
                        sessionId: 'session1',
                        agentTraceEvents: [
                            {
                                latencyBreakdown: {
                                    firstAudioSentMs: 2000,
                                    steps: [{ step: 'first_audio_sent', msFromStart: 2100 }],
                                },
                            },
                        ],
                        trajectoryRecords: [],
                        reportArtifacts: [],
                    },
                ]);

                const result = await buildRuntimeOpsSummary();

                expect(result.latency.voiceResponseLatencyMs).toBe(2000);
            });

            it('should handle alternative latency field names', async () => {
                SessionAnalysis.lean.mockResolvedValue([
                    {
                        sessionId: 'session1',
                        agentTraceEvents: [
                            {
                                realtimeLatency: {
                                    steps: [
                                        { name: 'adaptive.tts_first_audio', timestampMs: 1500 },
                                    ],
                                },
                            },
                        ],
                        trajectoryRecords: [],
                        reportArtifacts: [],
                    },
                ]);

                const result = await buildRuntimeOpsSummary();

                expect(result.latency.voiceResponseLatencyMs).toBe(1500);
            });

            it('should prioritize voiceResponseLatencyMs over other fields', async () => {
                SessionAnalysis.lean.mockResolvedValue([
                    {
                        sessionId: 'session1',
                        agentTraceEvents: [
                            {
                                latencyBreakdown: {
                                    voiceResponseLatencyMs: 1000,
                                    firstAudioSentMs: 2000,
                                    ttsFirstAudioMs: 3000,
                                },
                            },
                        ],
                        trajectoryRecords: [],
                        reportArtifacts: [],
                    },
                ]);

                const result = await buildRuntimeOpsSummary();

                expect(result.latency.voiceResponseLatencyMs).toBe(1000);
            });
        });

        describe('edge cases', () => {
            it('should handle missing agentTraceEvents', async () => {
                SessionAnalysis.lean.mockResolvedValue([
                    {
                        sessionId: 'session1',
                        trajectoryRecords: [],
                        reportArtifacts: [],
                    },
                ]);

                const result = await buildRuntimeOpsSummary();

                expect(result.overview.totalSessions).toBe(1);
                expect(result.latency.traceSampleCount).toBe(0);
            });

            it('should handle missing trajectoryRecords', async () => {
                SessionAnalysis.lean.mockResolvedValue([
                    {
                        sessionId: 'session1',
                        agentTraceEvents: [],
                        reportArtifacts: [],
                    },
                ]);

                const result = await buildRuntimeOpsSummary();

                expect(result.overview.modelAssistedTurnRate).toBe(0);
            });

            it('should handle missing reportArtifacts', async () => {
                SessionAnalysis.lean.mockResolvedValue([
                    {
                        sessionId: 'session1',
                        agentTraceEvents: [],
                        trajectoryRecords: [],
                    },
                ]);

                const result = await buildRuntimeOpsSummary();

                expect(result.overview.averageCoachingConfidence).toBe(0);
            });

            it('should handle SessionReport fallback for QA results', async () => {
                SessionAnalysis.lean.mockResolvedValue([
                    {
                        sessionId: 'session1',
                        agentTraceEvents: [],
                        trajectoryRecords: [],
                        reportArtifacts: [],
                    },
                ]);

                SessionReport.lean.mockResolvedValue([
                    {
                        sessionId: 'session1',
                        qaResult: { coverageScore: 0.9, passed: true },
                    },
                ]);

                const result = await buildRuntimeOpsSummary();

                expect(result.overview.averageCoachingConfidence).toBe(0.9);
                expect(result.overview.runtimeQaPassRate).toBe(1);
            });
        });
    });

    describe('buildOpsLiteSummary', () => {
        beforeEach(() => {
            SessionAnalysis.lean.mockResolvedValue([]);
            SessionReport.lean.mockResolvedValue([]);
            fs.stat.mockRejectedValue(new Error('ENOENT'));
        });

        it('should combine runtime and eval summaries', async () => {
            const result = await buildOpsLiteSummary();

            expect(result).toHaveProperty('overview');
            expect(result).toHaveProperty('latency');
            expect(result).toHaveProperty('rag');
            expect(result).toHaveProperty('voice');
            expect(result).toHaveProperty('evals');
            expect(result).toHaveProperty('agentEvaluation');
        });

        it('should merge eval metrics into overview', async () => {
            const result = await buildOpsLiteSummary();

            expect(result.overview).toHaveProperty('latestEvalPassRate');
            expect(result.overview).toHaveProperty('latestEvalAverageScore');
            expect(result.overview).toHaveProperty('totalEvalSuites');
            expect(result.overview).toHaveProperty('totalEvalCases');
            expect(result.overview).toHaveProperty('warningCaseCount');
        });

        it('should pass userId to runtime summary', async () => {
            await buildOpsLiteSummary({ userId: 'user1' });

            expect(SessionAnalysis.find).toHaveBeenCalledWith({ userId: 'user1' });
        });

        it('should handle both summaries being empty', async () => {
            const result = await buildOpsLiteSummary();

            expect(result.overview.totalSessions).toBe(0);
            expect(result.agentEvaluation.totalSuites).toBe(0);
        });

        it('should degrade instead of failing when runtime records cannot be read', async () => {
            SessionAnalysis.lean.mockRejectedValue(new Error('Sort exceeded memory limit'));

            const result = await buildOpsLiteSummary({ userId: 'user1' });

            expect(result.runtimeStatus).toEqual({
                ok: false,
                warning: 'Sort exceeded memory limit',
            });
            expect(result.overview.totalSessions).toBe(0);
            expect(result.agentEvaluation.totalSuites).toBe(0);
        });
    });
});

// Made with Bob
