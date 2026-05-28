/**
 * Configuration for OpsLite service
 * Contains constants for report directories, risk categories, and suite metadata
 */

import path from 'node:path';

/**
 * Candidate directories for eval reports
 * Checked in order to support both repo root and backend/ execution contexts
 */
export const REPORT_DIR_CANDIDATES = [
    path.resolve('eval/reports'),
    path.resolve('backend/eval/reports'),
];

/**
 * Plan risk categories tracked across eval suites
 * Used for risk coverage analysis
 */
export const PLAN_RISK_CATEGORIES = [
    'factual_grounding',
    'cv_jd_alignment',
    'star_completeness',
    'interview_control',
    'rag_quality',
    'multi_turn_adaptiveness',
    'voice_quality',
    'safety_boundary',
    'company_research_grounding',
    'report_quality',
];

/**
 * Metadata for each eval suite
 * Maps suite ID to group, label, and risk categories
 */
export const SUITE_META = Object.freeze({
    'cv-parse-eval': {
        group: 'analysisQuality',
        label: 'CV parse analysis',
        categories: ['cv_jd_alignment'],
    },
    'jd-parse-eval': {
        group: 'analysisQuality',
        label: 'JD parse analysis',
        categories: ['cv_jd_alignment'],
    },
    'jd-parse-seek-benchmark': {
        group: 'analysisQuality',
        label: 'Real SEEK JD parsing',
        categories: ['cv_jd_alignment', 'safety_boundary'],
    },
    'cv-jd-match-eval': {
        group: 'analysisQuality',
        label: 'CV-JD match analysis',
        categories: ['cv_jd_alignment', 'factual_grounding'],
    },
    'interview-controller-eval': {
        group: 'trajectoryQuality',
        label: 'Interview decision control',
        categories: ['interview_control', 'multi_turn_adaptiveness'],
    },
    'agent-trajectory-eval': {
        group: 'trajectoryQuality',
        label: 'Agent trajectory quality',
        categories: ['interview_control', 'multi_turn_adaptiveness', 'factual_grounding', 'star_completeness'],
    },
    'end-to-end-interview-eval': {
        group: 'trajectoryQuality',
        label: 'Fixed scenario E2E',
        categories: ['interview_control', 'report_quality', 'factual_grounding', 'star_completeness'],
    },
    'kiwi-green-agent-eval': {
        group: 'trajectoryQuality',
        label: 'Kiwi Green Agent benchmark',
        categories: ['interview_control', 'report_quality', 'factual_grounding', 'star_completeness'],
    },
    'retrieval-eval': {
        group: 'groundingSafety',
        label: 'RAG retrieval grounding',
        categories: ['rag_quality', 'factual_grounding'],
    },
    'report-qa-eval': {
        group: 'groundingSafety',
        label: 'Report QA grounding',
        categories: ['report_quality', 'factual_grounding', 'star_completeness'],
    },
    'company-research-eval': {
        group: 'groundingSafety',
        label: 'Company research grounding',
        categories: ['company_research_grounding', 'factual_grounding'],
    },
    'baseline-comparison-eval': {
        group: 'groundingSafety',
        label: 'Generic baseline comparison',
        categories: ['report_quality'],
    },
    'voice-quality-eval': {
        group: 'voiceQuality',
        label: 'Voice transcript coaching quality',
        categories: ['voice_quality', 'multi_turn_adaptiveness'],
    },
    'voice-robustness-eval': {
        group: 'voiceQuality',
        label: 'Voice robustness',
        categories: ['voice_quality'],
    },
    'stability-eval': {
        group: 'reliability',
        label: 'Multi-trial stability',
        categories: ['multi_turn_adaptiveness', 'safety_boundary'],
    },
    'plan-eval-suite': {
        group: 'reliability',
        label: 'Plan eval execution coverage',
        categories: ['safety_boundary'],
    },
});

/**
 * Default group structure for eval report summary
 */
export const DEFAULT_GROUPS = {
    analysisQuality: [],
    trajectoryQuality: [],
    groundingSafety: [],
    voiceQuality: [],
    reliability: [],
};

// Made with Bob
