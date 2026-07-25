/**
 * File responsibility: Convert internal Match progress into a candidate-safe SSE contract.
 */

const STAGES = [
  ['input_validation', 'Checking your inputs'],
  ['role_fit_gate', 'Reviewing role requirements'],
  ['cache_lookup', 'Checking saved Match work'],
  ['evidence_match', 'Matching your CV evidence'],
  ['quality_review', 'Quality-checking the match'],
  ['persistence', 'Saving your analysis'],
  ['question_filter', 'Finalising your Match'],
  ['complete', 'Match analysis complete'],
];

const STAGE_INDEX = new Map(STAGES.map(([id], index) => [id, index]));
const STAGE_LABEL = new Map(STAGES);

const TRACE_STAGE_RULES = [
  [/^role_fit_review_gate$/, 'role_fit_gate'],
  [/^match_cache_(read|hit|miss)$/, 'cache_lookup'],
  [/^(normalize_jd_rubric|semantic_role_profile|semantic_evidence|match_compare|match_score_build|role_evidence_map_build|match_result_build)/, 'evidence_match'],
  [/^match_(critic|recompare)/, 'quality_review'],
  [/^match_record_persist$/, 'persistence'],
  [/^jd_question_filter_build$/, 'question_filter'],
];

const resolveTraceStage = (step = '') => TRACE_STAGE_RULES
  .find(([pattern]) => pattern.test(String(step || '')))?.[1] || null;

const buildStage = (id, status) => ({
  id,
  label: STAGE_LABEL.get(id),
  status,
});

export const createMatchStreamReporter = ({
  requestId,
  writeEvent,
  now = () => new Date().toISOString(),
}) => {
  let sequence = 0;
  let activeStage = null;
  let highestStageIndex = -1;
  let terminalType = null;

  const emit = ({ type, stage = null, data = null }) => {
    if (terminalType) return null;
    const event = {
      schemaVersion: 'match_stream_event_v1',
      type,
      requestId,
      sequence: sequence + 1,
      occurredAt: now(),
      stage,
      data,
    };
    sequence += 1;
    writeEvent(event);
    if (type === 'match_completed' || type === 'match_failed') {
      terminalType = type;
    }
    return event;
  };

  const completeActiveStage = () => {
    if (!activeStage) return;
    emit({
      type: 'stage_progress',
      stage: buildStage(activeStage, 'completed'),
    });
    activeStage = null;
  };

  const stageStarted = (stageId) => {
    const stageIndex = STAGE_INDEX.get(stageId);
    if (stageIndex === undefined || stageIndex < highestStageIndex || terminalType) return;
    if (activeStage === stageId) return;
    if (activeStage) completeActiveStage();
    highestStageIndex = stageIndex;
    activeStage = stageId;
    emit({
      type: 'stage_progress',
      stage: buildStage(stageId, 'started'),
    });
  };

  const stageCompleted = (stageId, { failed = false, skipped = false } = {}) => {
    const stageIndex = STAGE_INDEX.get(stageId);
    if (stageIndex === undefined || stageIndex < highestStageIndex || terminalType) return;
    if (activeStage !== stageId) {
      stageStarted(stageId);
    }
    if (activeStage !== stageId) return;
    emit({
      type: 'stage_progress',
      stage: buildStage(stageId, failed ? 'failed' : skipped ? 'skipped' : 'completed'),
    });
    activeStage = null;
  };

  const observeTraceStep = ({ phase, step, ok = true } = {}) => {
    const stageId = resolveTraceStage(step);
    if (!stageId) return;
    if (phase === 'started') {
      stageStarted(stageId);
      return;
    }
    if (phase === 'completed') {
      stageCompleted(stageId, { failed: ok === false });
    }
  };

  const start = () => emit({
    type: 'match_started',
  });

  const complete = (data) => {
    if (terminalType) return;
    completeActiveStage();
    highestStageIndex = STAGE_INDEX.get('complete');
    emit({
      type: 'match_completed',
      stage: buildStage('complete', 'completed'),
      data,
    });
  };

  const fail = ({
    code = 'MATCH_FAILED',
    message = 'Match analysis could not finish. Try again.',
    retryable = true,
    failedStage = activeStage || 'evidence_match',
    repairTarget = null,
  } = {}) => {
    if (terminalType) return;
    if (activeStage) {
      stageCompleted(activeStage, { failed: true });
    }
    emit({
      type: 'match_failed',
      stage: STAGE_INDEX.has(failedStage) ? buildStage(failedStage, 'failed') : null,
      data: {
        code,
        message,
        retryable: Boolean(retryable),
        failedStage,
        repairTarget,
      },
    });
  };

  return {
    start,
    stageStarted,
    stageCompleted,
    observeTraceStep,
    complete,
    fail,
  };
};

export const createMatchSseWriter = (response) => (event = {}) => {
  const payload = {
    schemaVersion: event.schemaVersion || 'match_stream_event_v1',
    ...event,
  };
  response.write(`event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`);
};
