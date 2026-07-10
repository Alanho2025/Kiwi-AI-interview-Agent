import crypto from 'crypto';
import { MatchAnalysisRecord } from '../../db/models/matchAnalysisRecordModel.js';
import { buildRetentionExpiry } from '../retention/retentionPolicy.js';

const buildEvidenceRefs = (cvDocument, matchData) => {
  const profileEvidence = (matchData.roleEvidenceMap?.items || [])
    .filter((item) => ['direct', 'adjacent'].includes(item.classification))
    .flatMap((item) => (item.sourceEvidence || []).slice(0, 2).map((evidence) => ({
      sourceType: 'cv_profile',
      evidenceId: evidence.evidenceId,
      matchedSkill: item.roleIntent,
      sourceSection: evidence.sourceTrace?.section || '',
      sourceSnippet: evidence.text || '',
      confidence: Number(evidence.semanticScore || 0),
      classification: item.classification,
    })))
    .slice(0, 12);

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
    retentionUntil: buildRetentionExpiry(),
  });
  return { matchAnalysisId, evidenceRefs };
};
