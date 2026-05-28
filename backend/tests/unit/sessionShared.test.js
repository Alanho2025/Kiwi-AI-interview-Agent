/**
 * Unit tests for sessionShared.js
 *
 * Test coverage:
 * - buildFullTranscript: transcript formatting
 * - retentionDate: date calculation
 * - clampVarchar: string truncation
 * - titleCaseWords: title case conversion with acronyms
 * - cleanDisplayTitle: marketing prefix removal
 * - extractDisplayTitle: title extraction from various sources
 * - mapSessionRow: database row mapping
 * - buildCanonicalRoleMeta: role metadata construction
 * - buildQuestionPoolFromAnalysis: question generation
 * - normalizeAnalysisResult: analysis normalization
 * - buildInterviewPlanPayload: plan payload construction
 */

import { describe, it, expect } from 'vitest';
import * as sessionShared from '../../src/services/session/sessionShared.js';

describe('sessionShared', () => {
    describe('buildFullTranscript', () => {
        it('should format turns into transcript', () => {
            const turns = [
                { role: 'interviewer', text: 'Hello' },
                { role: 'candidate', text: 'Hi there' },
            ];
            const result = sessionShared.buildFullTranscript(turns);
            expect(result).toBe('INTERVIEWER: Hello\n\nCANDIDATE: Hi there');
        });

        it('should handle empty turns array', () => {
            const result = sessionShared.buildFullTranscript([]);
            expect(result).toBe('');
        });

        it('should uppercase role names', () => {
            const turns = [{ role: 'user', text: 'Test' }];
            const result = sessionShared.buildFullTranscript(turns);
            expect(result).toBe('USER: Test');
        });
    });

    describe('retentionDate', () => {
        it('should return date 90 days from now', () => {
            const before = Date.now();
            const result = sessionShared.retentionDate();
            const after = Date.now();

            const expectedMin = new Date(before + 90 * 24 * 60 * 60 * 1000);
            const expectedMax = new Date(after + 90 * 24 * 60 * 60 * 1000);

            expect(result.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
            expect(result.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
        });
    });

    describe('clampVarchar', () => {
        it('should return string as-is if under max length', () => {
            const result = sessionShared.clampVarchar('hello', 10);
            expect(result).toBe('hello');
        });

        it('should truncate string if over max length', () => {
            const result = sessionShared.clampVarchar('hello world', 5);
            expect(result).toBe('hello');
        });

        it('should use default max length of 255', () => {
            const longString = 'a'.repeat(300);
            const result = sessionShared.clampVarchar(longString);
            expect(result).toHaveLength(255);
        });

        it('should trim whitespace', () => {
            const result = sessionShared.clampVarchar('  hello  ', 10);
            expect(result).toBe('hello');
        });

        it('should use fallback for null/undefined', () => {
            expect(sessionShared.clampVarchar(null, 10, 'default')).toBe('default');
            expect(sessionShared.clampVarchar(undefined, 10, 'default')).toBe('default');
        });

        it('should convert non-string values to string', () => {
            expect(sessionShared.clampVarchar(123, 10)).toBe('123');
            expect(sessionShared.clampVarchar(true, 10)).toBe('true');
        });
    });

    describe('titleCaseWords', () => {
        it('should convert words to title case', () => {
            const result = sessionShared.titleCaseWords('hello world');
            expect(result).toBe('Hello World');
        });

        it('should preserve acronyms in uppercase', () => {
            const result = sessionShared.titleCaseWords('qa engineer');
            expect(result).toBe('QA Engineer');
        });

        it('should handle multiple acronyms', () => {
            const result = sessionShared.titleCaseWords('aws api sql developer');
            expect(result).toBe('AWS API SQL Developer');
        });

        it('should handle .NET specially', () => {
            const result = sessionShared.titleCaseWords('net developer');
            expect(result).toBe('.NET Developer');
            expect(sessionShared.titleCaseWords('.net developer')).toBe('.NET Developer');
        });

        it('should handle parenthetical acronyms', () => {
            const result = sessionShared.titleCaseWords('engineer (nz)');
            expect(result).toBe('Engineer (NZ)');
        });

        it('should handle parenthetical non-acronyms', () => {
            const result = sessionShared.titleCaseWords('engineer (remote)');
            expect(result).toBe('Engineer (Remote)');
        });

        it('should preserve all-caps technical terms', () => {
            const result = sessionShared.titleCaseWords('REST API');
            expect(result).toBe('REST API');
        });

        it('should handle empty string', () => {
            const result = sessionShared.titleCaseWords('');
            expect(result).toBe('');
        });

        it('should handle multiple spaces', () => {
            const result = sessionShared.titleCaseWords('hello   world');
            expect(result).toBe('Hello World');
        });
    });

    describe('cleanDisplayTitle', () => {
        it('should return title as-is if no marketing prefix', () => {
            const result = sessionShared.cleanDisplayTitle('Software Engineer');
            expect(result).toBe('Software Engineer');
        });

        it('should remove "Hiring:" prefix', () => {
            const result = sessionShared.cleanDisplayTitle('Hiring: Software Engineer');
            expect(result).toBe('Software Engineer');
        });

        it('should remove "We are hiring" prefix', () => {
            const result = sessionShared.cleanDisplayTitle('We are hiring Software Engineer');
            expect(result).toBe('Software Engineer');
        });

        it('should remove "Join us as" prefix', () => {
            const result = sessionShared.cleanDisplayTitle('Join us as a Software Engineer');
            expect(result).toBe('Software Engineer');
        });

        it('should remove "Open role:" prefix', () => {
            const result = sessionShared.cleanDisplayTitle('Open role: Software Engineer');
            expect(result).toBe('Software Engineer');
        });

        it('should not remove prefix if result is not a role', () => {
            const result = sessionShared.cleanDisplayTitle('Hiring: Great opportunity');
            expect(result).toBe('Hiring: Great opportunity');
        });

        it('should preserve hiring manager titles', () => {
            const result = sessionShared.cleanDisplayTitle('Hiring Manager');
            expect(result).toBe('Hiring Manager');
        });

        it('should trim trailing punctuation', () => {
            const result = sessionShared.cleanDisplayTitle('Software Engineer...');
            expect(result).toBe('Software Engineer');
        });

        it('should normalize whitespace', () => {
            const result = sessionShared.cleanDisplayTitle('Software   Engineer');
            expect(result).toBe('Software Engineer');
        });
    });

    describe('extractDisplayTitle', () => {
        it('should extract from "Job Title:" pattern', () => {
            const result = sessionShared.extractDisplayTitle('Job Title: Software Engineer');
            expect(result).toBe('Software Engineer');
        });

        it('should extract common role patterns', () => {
            const result = sessionShared.extractDisplayTitle('Looking for a Senior Software Engineer');
            expect(result).toBe('Senior Software Engineer');
        });

        it('should use first line if reasonable', () => {
            const result = sessionShared.extractDisplayTitle('Software Engineer\nFull time position');
            expect(result).toBe('Software Engineer');
        });

        it('should skip first line if it starts with "we"', () => {
            const result = sessionShared.extractDisplayTitle('We are looking\nSoftware Engineer');
            expect(result).toBe('Software Engineer');
        });

        it('should return fallback if no candidates', () => {
            const result = sessionShared.extractDisplayTitle('', null, undefined);
            expect(result).toBe('Interview Session');
        });

        it('should try multiple candidates', () => {
            const result = sessionShared.extractDisplayTitle('', 'Job Title: QA Engineer', '');
            expect(result).toBe('QA Engineer');
        });

        it('should extract from first sentence', () => {
            const result = sessionShared.extractDisplayTitle('Software Engineer position. Full time role.');
            expect(result).toBe('Software Engineer');
        });

        it('should handle long text by truncating', () => {
            const longText = 'a'.repeat(200);
            const result = sessionShared.extractDisplayTitle(longText);
            expect(result.length).toBeLessThanOrEqual(80);
        });
    });

    describe('mapSessionRow', () => {
        it('should map database row to session object', () => {
            const row = {
                id: '123',
                user_id: 'user1',
                status: 'active',
                mode: 'text',
                cv_file_id: 'cv1',
                target_role: 'Engineer',
                candidate_name: 'John',
                total_questions: 10,
                current_question_index: 5,
                elapsed_seconds: 300,
                control_mode: 'question_limited',
                question_type: 'technical',
                question_limit: 10,
                time_limit_seconds: 1800,
                completed_because: null,
                last_resumed_at: new Date(),
                started_at: new Date(),
                ended_at: null,
                duration_seconds: 300,
                overall_score: 75,
                summary_text: 'Good',
                created_at: new Date(),
                updated_at: new Date(),
                seniority_level: 'junior',
                focus_area: 'technical',
                enable_nz_culture_fit: true,
            };

            const result = sessionShared.mapSessionRow(row);

            expect(result.id).toBe('123');
            expect(result.userId).toBe('user1');
            expect(result.status).toBe('active');
            expect(result.mode).toBe('text');
            expect(result.settings.seniorityLevel).toBe('junior');
            expect(result.settings.focusArea).toBe('technical');
        });

        it('should use defaults for missing optional fields', () => {
            const row = {
                id: '123',
                user_id: 'user1',
                status: 'active',
                mode: 'text',
                total_questions: 10,
                current_question_index: 0,
                elapsed_seconds: 0,
            };

            const result = sessionShared.mapSessionRow(row);

            expect(result.controlMode).toBe('question_limited');
            expect(result.questionType).toBe('combined');
            expect(result.questionLimit).toBe(10);
            expect(result.timeLimitSeconds).toBeNull();
        });

        it('should calculate timeLimitMinutes from seconds', () => {
            const row = {
                id: '123',
                user_id: 'user1',
                time_limit_seconds: 1800,
                total_questions: 10,
                current_question_index: 0,
                elapsed_seconds: 0,
            };

            const result = sessionShared.mapSessionRow(row);

            expect(result.settings.timeLimitMinutes).toBe(30);
        });
    });

    describe('buildCanonicalRoleMeta', () => {
        it('should build role metadata from analysis', () => {
            const analysis = {
                jobTitle: 'Software Engineer',
                parsedJdProfile: {
                    roleCanonical: 'software_engineer',
                    title: 'Senior Software Engineer',
                    roleFamily: 'engineering',
                },
            };

            const result = sessionShared.buildCanonicalRoleMeta({
                resolvedTargetRole: 'Software Engineer',
                normalizedAnalysis: analysis,
                settings: { seniorityLevel: 'junior', focusArea: 'technical' },
            });

            expect(result.displayTitle).toBeTruthy();
            expect(result.canonicalRole).toBeTruthy();
            expect(result.seniorityKey).toBe('junior');
            expect(result.focusAreaKey).toBe('technical');
        });

        it('should handle missing analysis', () => {
            const result = sessionShared.buildCanonicalRoleMeta({
                resolvedTargetRole: 'Engineer',
                settings: {},
            });

            expect(result.displayTitle).toBeTruthy();
            expect(result.seniorityKey).toBe('junior');
            expect(result.focusAreaKey).toBe('combined');
        });

        it('should use fallback for empty role', () => {
            const result = sessionShared.buildCanonicalRoleMeta({});

            expect(result.canonicalRole).toBe('Interview Session');
            expect(result.displayTitle).toBe('Interview Session');
        });
    });

    describe('buildQuestionPoolFromAnalysis', () => {
        it('should generate question pool with opening and closing', () => {
            const analysis = {
                matchingDetails: {
                    questionPlanHints: {
                        mustProbeSkills: ['JavaScript', 'React'],
                        mustProbeBehavioural: ['teamwork', 'communication'],
                    },
                },
            };

            const result = sessionShared.buildQuestionPoolFromAnalysis(analysis, {});

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].type).toBe('self_intro');
            expect(result[result.length - 1].type).toBe('wrap_up');
        });

        it('should include company motivation question', () => {
            const analysis = {
                matchingDetails: {
                    questionPlanHints: {
                        mustProbeSkills: [],
                        mustProbeBehavioural: [],
                    },
                },
            };

            const result = sessionShared.buildQuestionPoolFromAnalysis(analysis, {});

            const motivationQ = result.find((q) => q.type === 'company_motivation');
            expect(motivationQ).toBeTruthy();
            expect(motivationQ.text).toContain('attracted');
        });

        it('should generate technical questions based on skills', () => {
            const analysis = {
                matchingDetails: {
                    questionPlanHints: {
                        mustProbeSkills: ['Python', 'Django'],
                        mustProbeBehavioural: [],
                    },
                },
            };

            const result = sessionShared.buildQuestionPoolFromAnalysis(analysis, {});

            const technicalQuestions = result.filter((q) => q.category === 'technical' || q.category === 'role_competency');
            expect(technicalQuestions.length).toBeGreaterThan(0);
        });

        it('should generate behavioural questions', () => {
            const analysis = {
                matchingDetails: {
                    questionPlanHints: {
                        mustProbeSkills: [],
                        mustProbeBehavioural: ['leadership', 'problem-solving'],
                    },
                },
            };

            const result = sessionShared.buildQuestionPoolFromAnalysis(analysis, {});

            const behaviouralQuestions = result.filter((q) => q.category === 'behavioural');
            expect(behaviouralQuestions.length).toBeGreaterThan(0);
        });

        it('should include follow-up questions', () => {
            const analysis = {
                matchingDetails: {
                    questionPlanHints: {
                        mustProbeSkills: ['Java'],
                        mustProbeBehavioural: ['teamwork'],
                    },
                },
            };

            const result = sessionShared.buildQuestionPoolFromAnalysis(analysis, {});

            const followUps = result.filter((q) => q.followUpDepth > 0);
            expect(followUps.length).toBeGreaterThan(0);
        });

        it('should use company name in opening if provided', () => {
            const analysis = {
                companyName: 'TechCorp',
                matchingDetails: {
                    questionPlanHints: {
                        mustProbeSkills: [],
                        mustProbeBehavioural: [],
                    },
                },
            };

            const result = sessionShared.buildQuestionPoolFromAnalysis(analysis, {});

            expect(result[0].text).toContain('TechCorp');
        });
    });

    describe('normalizeAnalysisResult', () => {
        it('should return null for null input', () => {
            const result = sessionShared.normalizeAnalysisResult(null);
            expect(result).toBeNull();
        });

        it('should normalize analysis with matchSummary', () => {
            const analysis = {
                matchSummary: { score: 85 },
                otherField: 'value',
            };

            const result = sessionShared.normalizeAnalysisResult(analysis);

            expect(result).toBeTruthy();
        });

        it('should call toObject if available', () => {
            const analysis = {
                toObject: () => ({ converted: true }),
                matchSummary: { score: 85 },
            };

            const result = sessionShared.normalizeAnalysisResult(analysis);

            expect(result).toBeTruthy();
        });
    });

    describe('buildInterviewPlanPayload', () => {
        it('should build complete interview plan', () => {
            const normalizedAnalysis = {
                schemaVersion: 'v3',
                matchScore: 85,
                decision: 'proceed',
                confidence: 0.9,
                requirementChecks: [],
                explanation: 'Good match',
                strengths: ['skill1'],
                gaps: ['skill2'],
                interviewFocus: ['technical'],
                planPreview: 'Preview text',
                matchingDetails: {
                    questionPlanHints: {
                        mustProbeSkills: ['JavaScript'],
                        mustProbeBehavioural: ['teamwork'],
                    },
                },
            };

            const result = sessionShared.buildInterviewPlanPayload({
                normalizedAnalysis,
                settings: { seniorityLevel: 'junior' },
                resolvedCandidateName: 'John Doe',
                resolvedTargetRole: 'Software Engineer',
            });

            expect(result.candidateName).toBe('John Doe');
            expect(result.jobTitle).toBe('Software Engineer');
            expect(result.matchScore).toBe(85);
            expect(result.questionPool).toBeTruthy();
            expect(result.questionPool.length).toBeGreaterThan(0);
        });

        it('should use defaults for missing fields', () => {
            const normalizedAnalysis = {
                decision: 'proceed',
                matchingDetails: {
                    questionPlanHints: {},
                },
            };

            const result = sessionShared.buildInterviewPlanPayload({
                normalizedAnalysis,
                settings: {},
                resolvedCandidateName: 'Test',
                resolvedTargetRole: 'Role',
            });

            expect(result.matchScore).toBe(0);
            expect(result.candidateName).toBe('Test');
            expect(result.jobTitle).toBe('Role');
        });
    });

});

// Made with Bob
