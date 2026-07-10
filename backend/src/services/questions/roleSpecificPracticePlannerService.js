/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Generate pre-computed InterviewProofStrategy from role fit profile and evidence map.
 * - Enrich question pool items with Role-Fit metadata.
 */

export const buildInterviewProofStrategy = ({ roleFitProfile = {}, roleEvidenceMap = {} } = {}) => {
  const roleIntentProfileId = roleFitProfile.id || '';
  const roleEvidenceMapId = roleEvidenceMap.id || roleEvidenceMap.matchAnalysisId || '';
  
  const targetRoleIntentIds = (roleFitProfile.roleIntent?.items || [])
    .filter(item => item.priority === 'high')
    .map(item => item.id);
  
  const mustCover = [];
  const mapItems = roleEvidenceMap.items || [];
  const mapItemsByIntentId = new Map(mapItems.map(item => [item.roleIntentId, item]));
  
  targetRoleIntentIds.forEach((intentId) => {
    const mapItem = mapItemsByIntentId.get(intentId);
    const evidenceOptions = mapItem && mapItem.classification !== 'gap'
      ? (mapItem.sourceEvidence || []).map(ev => ev.evidenceId)
      : [];
      
    mustCover.push({
      coverageId: `cov-intent-${intentId}`,
      type: 'role_intent',
      roleIntentId: intentId,
      minQuestions: 1,
      evidenceOptions,
      allowAdjacentEvidence: true,
      status: 'pending',
    });
  });
  
  const gapItems = mapItems.filter(item => item.classification === 'gap');
  gapItems.forEach((gapItem) => {
    mustCover.push({
      coverageId: `cov-gap-${gapItem.roleIntentId}`,
      type: 'gap_validation',
      roleIntentId: gapItem.roleIntentId,
      minQuestions: 1,
      evidenceOptions: [],
      allowAdjacentEvidence: true,
      status: 'pending',
    });
  });
  
  if (mustCover.length === 0) {
    mustCover.push({
      coverageId: 'cov-fallback-generic',
      type: 'role_intent',
      roleIntentId: null,
      minQuestions: 1,
      evidenceOptions: [],
      allowAdjacentEvidence: true,
      status: 'pending',
    });
  }

  return {
    schemaVersion: 'interview_proof_strategy_v1',
    roleIntentProfileId,
    roleEvidenceMapId,
    targetRoleIntentIds,
    mustCover,
    avoidOveruse: {
      maxSameEvidenceRoot: 2,
      maxSameAngle: 1,
    },
    voiceInterviewPolicy: {
      doNotShowRecommendedEvidenceDuringInterview: true,
      storeReasoningForReport: true,
    },
    artifactStatus: 'ready',
    degradedReason: null,
  };
};

export const addRoleFitMetadataToQuestionPool = ({ poolItems = [], roleEvidenceMap = {}, roleFitProfile = {} } = {}) => {
  const mapItems = roleEvidenceMap.items || [];
  const targetRoleIntentIds = new Set(
    (roleFitProfile.roleIntent?.items || [])
      .filter(item => item.priority === 'high')
      .map(item => item.id)
  );

  return poolItems.map((question) => {
    let matchedIntent = null;
    const reqIds = (question.linkedJdRequirement || []).map(r => r.requirementId || r.id).filter(Boolean);
    if (question.requirementId) reqIds.push(question.requirementId);
    
    for (const mapItem of mapItems) {
      if (
        reqIds.includes(mapItem.roleIntentId) || 
        reqIds.includes(mapItem.requirementStatus) || 
        (question.topic && mapItem.roleIntent && mapItem.roleIntent.toLowerCase().includes(question.topic.toLowerCase()))
      ) {
        matchedIntent = mapItem;
        break;
      }
    }

    if (!matchedIntent && mapItems.length > 0) {
      matchedIntent = mapItems.find(item => 
        question.topic && item.roleIntent && item.roleIntent.toLowerCase().includes(question.topic.toLowerCase())
      ) || mapItems[0];
    }

    const roleIntentId = matchedIntent ? matchedIntent.roleIntentId : null;
    const isHighPriority = roleIntentId && targetRoleIntentIds.has(roleIntentId);
    const isGap = matchedIntent && matchedIntent.classification === 'gap';

    const proofPointId = isGap ? `cov-gap-${roleIntentId}` : `cov-intent-${roleIntentId}`;
    const testedRoleIntentIds = roleIntentId ? [roleIntentId] : [];
    const recommendedEvidenceIds = matchedIntent && matchedIntent.classification !== 'gap'
      ? (matchedIntent.sourceEvidence || []).map(ev => ev.evidenceId)
      : [];
    
    const coveragePriority = isHighPriority ? 'must_cover' : isGap ? 'should_cover' : 'optional';
    const evidenceAngle = question.questionIntent === 'behavioural_star' ? 'behavioural' : 'technical_ownership';
    
    const roleFitReason = isGap 
      ? `Probes potential gap in ${matchedIntent?.roleIntent || question.topic || 'role fit'}.`
      : `Validates candidate's experience for ${matchedIntent?.roleIntent || question.topic || 'role fit'}.`;

    return {
      ...question,
      proofPointId,
      testedRoleIntentIds,
      recommendedEvidenceIds,
      evidenceAngle,
      coveragePriority,
      roleFitReason,
    };
  });
};
