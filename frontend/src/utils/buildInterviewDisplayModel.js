const normalizeFocus = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'technical') return 'Technical';
  if (raw === 'behavioral' || raw === 'behavioural') return 'Behavioral';
  return 'Combined';
};

const normalizeSeniority = (value = '') => {
  const raw = String(value || '').trim();
  return raw || 'Junior/Grad';
};

export const buildInterviewDisplayModel = (session = {}, currentPlanItem = null) => {
  const rubric = session?.analysisResult?.parsedJdProfile || session?.analysisResult?.matchingDetails?.rubric || {};
  const focusLabel = normalizeFocus(session?.settings?.focusArea);
  const seniorityLabel = normalizeSeniority(session?.settings?.seniorityLevel);
  const exactRoleTitle = session?.displayTitle || rubric.title || session?.targetRole || 'Interview Session';
  const roleFamilyLabel = session?.compactRoleLabel || session?.analysisResult?.matchingDetails?.questionPlanHints?.roleCanonical || rubric.roleFamily || 'Software Engineer';
  const companyName = session?.analysisResult?.parsedJdProfile?.companyName || session?.companyName || '';
  const matchedAreas = session?.analysisResult?.planPreview?.topMatchedAreas || session?.analysisResult?.matchingDetails?.topMatchedSkills || [];
  const title = companyName ? `${companyName} - ${exactRoleTitle}` : `${exactRoleTitle} Interview`;
  const levelLabel = `${seniorityLabel} ${focusLabel}`;
  const stageLabel = String(currentPlanItem?.stage || 'opening').replace(/_/g, ' ');
  const promiseLabel = focusLabel === 'Technical'
    ? 'This session will stay technical, so explain tools, implementation choices, trade-offs, and results clearly.'
    : focusLabel === 'Behavioral'
      ? 'This session will stay behavioural, so keep each example concrete and structured.'
      : 'This session will test both behavioural and technical evidence, so keep examples concrete and role-specific.';

  return {
    brandName: 'KiwiCoach',
    interviewerName: 'KiwiCoach',
    title,
    exactRoleTitle,
    roleFamilyLabel,
    compactRoleLabel: roleFamilyLabel,
    levelLabel,
    seniorityLabel,
    focusLabel,
    stageLabel,
    promiseLabel,
    matchedAreas,
  };
};
