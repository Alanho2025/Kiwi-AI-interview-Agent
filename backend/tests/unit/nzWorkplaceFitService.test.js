import { describe, it, expect, vi } from 'vitest';

// Mock the KB data
vi.mock('../../src/data/nzWorkplaceCultureKB.js', () => ({
    findValueById: vi.fn((id) => ({
        whyItMatters: `Why ${id} matters`,
        exampleAnswer: `Example for ${id}`,
        interviewSignals: [`Signal for ${id}`],
    })),
}));

const { buildNzWorkplaceFit } = await import('../../src/services/nzWorkplaceFitService.js');

describe('nzWorkplaceFitService', () => {
    describe('buildNzWorkplaceFit', () => {
        describe('when NZ culture fit is disabled', () => {
            it('should return disabled status with null score', () => {
                const session = {
                    settings: { enableNZCultureFit: false },
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.enabled).toBe(false);
                expect(result.score).toBe(null);
                expect(result.summary).toBe('NZ workplace communication coaching was not enabled for this session.');
                expect(result.dimensionScores).toEqual([]);
                expect(result.strengths).toEqual([]);
                expect(result.gaps).toEqual([]);
                expect(result.evidence).toEqual([]);
                expect(result.suggestedRewrite).toBe(null);
            });

            it('should return enabled by default when settings are missing', () => {
                const session = {};
                const result = buildNzWorkplaceFit({ session });
                expect(result.enabled).toBe(true);
            });
        });

        describe('when transcript is too short', () => {
            it('should return zero score with gap feedback', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'Yes' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.enabled).toBe(true);
                expect(result.score).toBe(0);
                expect(result.summary).toBe('There was not enough candidate transcript evidence to assess NZ workplace communication fit.');
                expect(result.dimensionScores).toHaveLength(8);
                expect(result.dimensionScores.every(d => d.score === 0)).toBe(true);
                expect(result.strengths).toEqual([]);
                expect(result.gaps).toEqual(['Give at least one specific example with context, action, collaboration, and result.']);
            });

            it('should handle empty transcript', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [],
                };

                const result = buildNzWorkplaceFit({ session });
                expect(result.score).toBe(0);
            });
        });

        describe('dimension scoring', () => {
            describe('friendly_professional dimension', () => {
                it('should detect positive signals', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'Thanks for the question. I appreciate the opportunity to explain my approach clearly and walk through the solution step by step.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'friendly_professional');
                    expect(dimension.observed).toBe(true);
                    expect(dimension.score).toBeGreaterThan(6);
                    expect(dimension.evidenceQuote).toBeTruthy();
                });

                it('should detect gap signals', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'Whatever, it was just simple. Obviously anyone could do it. Nah, nothing special about it.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'friendly_professional');
                    expect(dimension.riskDetected).toBe(true);
                    expect(dimension.riskQuote).toBeTruthy();
                    expect(dimension.score).toBeLessThan(5);
                });
            });

            describe('teamwork dimension', () => {
                it('should detect teamwork signals', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I collaborated with my team and worked closely with the product owner. We aligned on shared goals and reviewed the solution together with stakeholders.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'teamwork');
                    expect(dimension.observed).toBe(true);
                    expect(dimension.score).toBeGreaterThan(6);
                });

                it('should detect solo work as gap', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I did everything by myself. Built the full system myself without anyone else. Only me on the project.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'teamwork');
                    expect(dimension.riskDetected).toBe(true);
                });
            });

            describe('humility_confidence dimension', () => {
                it('should detect evidence-based confidence', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I led the implementation and was responsible for the outcome. The result improved performance by 40% and we measured the impact through validated metrics.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'humility_confidence');
                    expect(dimension.observed).toBe(true);
                    expect(dimension.score).toBeGreaterThan(6);
                });

                it('should detect over-claiming as gap', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I am the best expert in everything. It was perfect and obvious to me. I single-handedly did everything.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'humility_confidence');
                    expect(dimension.riskDetected).toBe(true);
                });
            });

            describe('initiative dimension', () => {
                it('should detect proactive behavior', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I identified a bottleneck and proactively proposed a solution. Without being asked, I took initiative to automate the process and improved the workflow.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'initiative');
                    expect(dimension.observed).toBe(true);
                    expect(dimension.score).toBeGreaterThan(6);
                });
            });

            describe('open_communication dimension', () => {
                it('should detect communication signals', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I discussed the approach with the team, asked for feedback, and clarified expectations. I documented the decision and made sure everyone was aligned.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'open_communication');
                    expect(dimension.observed).toBe(true);
                    expect(dimension.score).toBeGreaterThan(6);
                });
            });

            describe('manaakitanga dimension', () => {
                it('should detect care and respect signals', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I helped mentor new team members and supported the customer through the transition. I made the process more accessible and listened to user feedback.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'manaakitanga');
                    expect(dimension.observed).toBe(true);
                    expect(dimension.score).toBeGreaterThan(6);
                });
            });

            describe('whanaungatanga dimension', () => {
                it('should detect relationship building', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I built trust with stakeholders through regular check-ins. We worked closely to maintain shared understanding and kept the team aligned on our shared goal.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'whanaungatanga');
                    expect(dimension.observed).toBe(true);
                    expect(dimension.score).toBeGreaterThan(6);
                });
            });

            describe('wellbeing_awareness dimension', () => {
                it('should detect sustainable work practices', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I prioritized the scope to keep workload manageable. We timeboxed the work and set realistic deadlines to avoid burnout and maintain sustainable delivery.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'wellbeing_awareness');
                    expect(dimension.observed).toBe(true);
                    expect(dimension.score).toBeGreaterThan(5);
                });

                it('should detect overwork as gap', () => {
                    const session = {
                        settings: { enableNZCultureFit: true },
                        transcript: [
                            { role: 'user', text: 'I worked 24/7 all night every night. Never sleep, work nonstop, always overtime to get it done.' },
                        ],
                    };

                    const result = buildNzWorkplaceFit({ session });

                    const dimension = result.dimensionScores.find(d => d.id === 'wellbeing_awareness');
                    expect(dimension.riskDetected).toBe(true);
                });
            });
        });

        describe('overall scoring', () => {
            it('should calculate high score for strong answers', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'Thanks for asking. I led the project and collaborated with my team. We identified the issue proactively, discussed the approach openly, and supported each other throughout. The result improved user experience and we maintained sustainable delivery through realistic planning.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.score).toBeGreaterThan(6);
                expect(result.strengths.length).toBeGreaterThan(0);
            });

            it('should calculate medium score for partial signals', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I worked on the project and completed the tasks. The solution was implemented successfully.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.score).toBeGreaterThan(4);
                expect(result.score).toBeLessThan(8);
            });

            it('should calculate low score for weak answers', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'Whatever, I did it all myself. Obviously it was easy for me. Just simple stuff, nothing special.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.score).toBeLessThan(6);
                expect(result.gaps.length).toBeGreaterThan(0);
            });
        });

        describe('strengths and gaps', () => {
            it('should identify strengths from observed positive signals', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I collaborated with the team, took initiative to improve the process, and communicated openly with stakeholders. We built trust through regular alignment.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.strengths.length).toBeGreaterThan(0);
                expect(result.strengths.every(s => typeof s === 'string')).toBe(true);
            });

            it('should identify gaps from risk signals', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I did everything by myself without anyone. Obviously I am the best expert. Whatever, it was just simple.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.gaps.length).toBeGreaterThan(0);
                expect(result.gaps.every(g => typeof g === 'string')).toBe(true);
            });

            it('should limit strengths to 4 items', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'Thanks for asking. I collaborated with my team, took initiative proactively, discussed openly, helped mentor others, built trust with stakeholders, prioritized sustainable work, and supported users respectfully.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.strengths.length).toBeLessThanOrEqual(4);
            });

            it('should limit gaps to 4 items', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'Whatever, I did everything myself. Obviously I am perfect and the best expert. Just simple stuff, nothing special. I worked 24/7 nonstop.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.gaps.length).toBeLessThanOrEqual(4);
            });
        });

        describe('evidence collection', () => {
            it('should collect evidence quotes', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I collaborated with the team. Whatever, it was just simple.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.evidence.length).toBeGreaterThan(0);
                expect(result.evidence[0]).toHaveProperty('dimension');
                expect(result.evidence[0]).toHaveProperty('quote');
                expect(result.evidence[0]).toHaveProperty('signal');
            });

            it('should mark risk quotes correctly', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'Whatever, I did everything by myself. Obviously I am the best expert and single-handedly did everything perfectly.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                const riskEvidence = result.evidence.find(e => e.signal === 'risk');
                expect(riskEvidence).toBeTruthy();
            });

            it('should limit evidence to 6 items', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'Thanks for asking. I collaborated with my team, took initiative, discussed openly, helped others, built trust, prioritized work, and supported users. Whatever, I did everything myself obviously.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.evidence.length).toBeLessThanOrEqual(6);
            });
        });

        describe('suggested rewrite', () => {
            it('should suggest rewrite for teamwork risk', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I did everything by myself without anyone helping.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.suggestedRewrite).toBeTruthy();
                expect(result.suggestedRewrite.weak).toBeTruthy();
                expect(result.suggestedRewrite.better).toBeTruthy();
                expect(result.suggestedRewrite.reason).toBeTruthy();
            });

            it('should suggest rewrite for humility risk', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I am the best expert and single-handedly did everything perfectly.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.suggestedRewrite).toBeTruthy();
                expect(result.suggestedRewrite.reason).toContain('collaboration');
            });

            it('should suggest rewrite for generic teamwork claims', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I am a good team player and work well in teams. Communication is important.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.suggestedRewrite).toBeTruthy();
                expect(result.suggestedRewrite.reason).toContain('concrete');
            });

            it('should provide default suggestion for first sentence', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I completed the project successfully and delivered on time.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.suggestedRewrite).toBeTruthy();
                expect(result.suggestedRewrite.better).toContain('who I worked with');
            });
        });

        describe('transcript filtering', () => {
            it('should only process user turns', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'assistant', text: 'Tell me about your experience.' },
                        { role: 'user', text: 'I collaborated with my team and took initiative.' },
                        { role: 'assistant', text: 'Can you elaborate?' },
                        { role: 'user', text: 'We worked together to achieve shared goals.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.score).toBeGreaterThan(0);
                // Should only consider the two user turns
            });

            it('should handle mixed case roles', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'USER', text: 'I collaborated with the team.' },
                        { role: 'User', text: 'We achieved shared goals.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                expect(result.score).toBeGreaterThan(0);
            });
        });

        describe('edge cases', () => {
            it('should handle null session', () => {
                const result = buildNzWorkplaceFit({ session: null });
                expect(result.enabled).toBe(true);
            });

            it('should handle undefined transcript', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                };

                const result = buildNzWorkplaceFit({ session });
                expect(result.score).toBe(0);
            });

            it('should handle empty strings in transcript', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: '' },
                        { role: 'user', text: '   ' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });
                expect(result.score).toBe(0);
            });

            it('should handle transcript with only whitespace', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: '     \n\n\t\t     ' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });
                expect(result.score).toBe(0);
            });

            it('should handle transcript parameter override', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'Session transcript' },
                    ],
                };

                const transcript = [
                    { role: 'user', text: 'I collaborated with my team and worked closely with stakeholders to achieve our shared goal.' },
                ];

                const result = buildNzWorkplaceFit({ session, transcript });

                // Should use the override transcript
                const teamwork = result.dimensionScores.find(d => d.id === 'teamwork');
                expect(teamwork.observed).toBe(true);
            });
        });

        describe('cultural context integration', () => {
            it('should include cultural context from KB', () => {
                const session = {
                    settings: { enableNZCultureFit: true },
                    transcript: [
                        { role: 'user', text: 'I collaborated with my team and took initiative to improve the process.' },
                    ],
                };

                const result = buildNzWorkplaceFit({ session });

                const dimension = result.dimensionScores.find(d => d.observed);
                expect(dimension.culturalContext).toBeTruthy();
                expect(dimension.exampleAnswer).toBeTruthy();
                expect(dimension.interviewSignals).toBeInstanceOf(Array);
            });
        });
    });
});

// Made with Bob
