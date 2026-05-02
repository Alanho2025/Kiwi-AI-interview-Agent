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

const toTitleCase = (value = '') => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase())
  .trim();

export const buildInterviewDisplayModel = (session = {}, currentPlanItem = null) => {
  const rubric = session?.analysisResult?.parsedJdProfile || session?.analysisResult?.matchingDetails?.rubric || {};
  const focusLabel = normalizeFocus(session?.settings?.focusArea);
  const seniorityLabel = normalizeSeniority(session?.settings?.seniorityLevel);
  const exactRoleTitle = session?.displayTitle || rubric.title || session?.targetRole || 'Interview Session';
  const roleFamilyLabel = session?.roleFamily || session?.compactRoleLabel || rubric.roleFamily || session?.analysisResult?.matchingDetails?.questionPlanHints?.roleCanonical || 'Software Engineer';
  const companyName = session?.analysisResult?.parsedJdProfile?.companyName || session?.companyName || '';
  const matchedAreas = session?.analysisResult?.planPreview?.topMatchedAreas || session?.analysisResult?.matchingDetails?.topMatchedSkills || [];
  const title = companyName ? `${companyName} - ${exactRoleTitle}` : exactRoleTitle;
  const levelLabel = `${seniorityLabel} ${focusLabel}`;
  const controlMode = session?.controlMode || session?.settings?.controlMode || 'question_limited';
  const timeLimitSeconds = Number(session?.timeLimitSeconds || session?.settings?.timeLimitSeconds || 0);
  const modeLabel = controlMode === 'time_limited' ? `${timeLimitSeconds ? Math.round(timeLimitSeconds / 60) : 15}-minute ${focusLabel}` : focusLabel;
  const stageLabel = toTitleCase(currentPlanItem?.stage || 'opening');
  const promiseLabel = focusLabel === 'Technical'
    ? 'This session will stay technical, so explain tools, implementation choices, trade-offs, and results clearly.'
    : focusLabel === 'Behavioral'
      ? 'This session will stay behavioural, so keep each example concrete and structured.'
      : 'This session will test both behavioural and technical evidence, so keep examples concrete and role-specific.';

  const currentFocusLabel = currentPlanItem?.topic
    ? `Current focus: ${toTitleCase(currentPlanItem.topic)}`
    : `Current focus: ${stageLabel}`;

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
    modeLabel,
    controlMode,
    timeLimitSeconds,
    companyName,
    stageLabel,
    currentFocusLabel,
    promiseLabel,
    matchedAreas,
  };
};
