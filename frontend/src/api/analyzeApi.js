import { apiClient } from './client.js';

export const paraphraseJD = (rawJD) => apiClient('/job-description/paraphrase', { method: 'POST', body: { rawJD } });
export const matchCV = (cvText, jdText, settings) => apiClient('/analyze/match', { method: 'POST', body: { cvText, jdText, settings } });
export const generateInterviewPlan = (cvText, jdText, settings, analysisResult) => apiClient('/analyze/interview-plan', { method: 'POST', body: { cvText, jdText, settings, analysisResult } });
