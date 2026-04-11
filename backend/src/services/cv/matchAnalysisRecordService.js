import crypto from 'crypto';
import { MatchAnalysisRecord } from '../../db/models/matchAnalysisRecordModel.js';

const buildEvidenceRefs = (cvDocument, matchData) => {
  const profileEvidence = (cvDocument.cvProfile?.evidenceMap || []).slice(0, 12).map((item) => ({
    sourceType: 'cv_profile',
    matchedSkill: item.label,
    sourceSection: item.sourceSection,
    sourceSnippet: item.sourceSnippet,
    confidence: item.confidence,
  }));

  const gapEvidence = (matchData.gaps || []).slice(0, 8).map((gap) => ({
    sourceType: 'match_gap',
    matchedSkill: gap,
    sourceSection: 'analysis_gap',
    sourceSnippet: '',
    confidence: 0.5,
  }));

  return [...profileEvidence, ...gapEvidence];
};

export const createMatchAnalysisRecord = async ({ userId, cvFileId, jdStructuredText = '', jdRubric = null, matchData, cvDocument }) => {
  const matchAnalysisId = crypto.randomUUID();
  const evidenceRefs = buildEvidenceRefs(cvDocument, matchData);
  await MatchAnalysisRecord.create({
    matchAnalysisId,
    userId,
    cvFileId,
    jdStructuredText,
    jdRubric: jdRubric || {},
    matchAnalysis: matchData,
    evidenceRefs,
    warnings: [...(cvDocument.parseWarnings || []), ...(matchData.warnings || [])],
    retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
  return { matchAnalysisId, evidenceRefs };
};
