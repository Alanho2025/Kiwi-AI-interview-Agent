import { buildNormalizedJdRubric as buildJdContract } from '../jobDescription/jobDescriptionContractBuilder.js';
import { buildNormalizedCvProfile as buildCvContract } from '../cv/cvProfileContractBuilder.js';
import { buildMatchAnalysisContract } from '../match/matchAnalysisContractBuilder.js';

export const buildNormalizedJdRubric = (session = {}) => {
  const analysis = session.analysisResult || {};
  const parsedJd = analysis.parsedJdProfile || {};
  return buildJdContract(parsedJd, session);
};

export const buildNormalizedCvProfile = (session = {}) => {
  const analysis = session.analysisResult || {};
  const parsedCv = analysis.parsedCvProfile || session.cvProfile || {};
  return buildCvContract(parsedCv, session);
};

export const buildMatchAnalysis = (session = {}) => buildMatchAnalysisContract(session.analysisResult || {});
