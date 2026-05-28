import crypto from 'crypto';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { ensureArray, normalizeText } from '../../utils/commonHelpers.js';

const buildLesson = ({ evaluatorState = {}, decisionContext = {}, trajectoryStep = {} } = {}) => {
  const topic = decisionContext.currentTopic || trajectoryStep.targetTopic || evaluatorState.currentTopic || 'role_fit';
  const section = trajectoryStep.section || decisionContext.sectionState?.sectionKey || decisionContext.currentStage || 'experience';

  if (evaluatorState.misunderstandingFlag) {
    return {
      pattern: 'candidate_misunderstood_question',
      lesson: `When probing ${topic}, narrow the scope to one concrete example and explicitly ask for role, action, and outcome.`,
      recommendedNextStrategy: 'rephrase_then_anchor_example',
      applicableSections: [section],
      confidence: 0.86,
    };
  }

  if ((evaluatorState.evidenceGainScore || 0) < 0.45) {
    return {
      pattern: 'low_evidence_gain',
      lesson: `The follow-up on ${topic} did not produce enough direct evidence. Ask for one real project, one owned decision, and one measurable result before switching topics.`,
      recommendedNextStrategy: 'probe_specific_example',
      applicableSections: [section],
      confidence: 0.82,
    };
  }

  if (evaluatorState.interactionStatus === 'verbose' || (evaluatorState.overallInteractionScore || 0) < 0.55) {
    return {
      pattern: 'interaction_needs_tightening',
      lesson: `The candidate response around ${topic} drifted or became too long. Keep the next question shorter and constrain it to one situation.`,
      recommendedNextStrategy: 'tight_scope_short_prompt',
      applicableSections: [section],
      confidence: 0.74,
    };
  }

  if (decisionContext.abductiveState?.shouldProbe) {
    return {
      pattern: 'hidden_gap_detected',
      lesson: `A hidden gap was inferred around ${decisionContext.abductiveState.hiddenGap}. Probe the underlying trade-off before moving to a new section.`,
      recommendedNextStrategy: 'abductive_probe_first',
      applicableSections: [section],
      confidence: 0.79,
    };
  }

  return {
    pattern: 'useful_progress',
    lesson: `The latest turn on ${topic} was usable. Keep building depth on owned decisions and measurable impact before closing the section.`,
    recommendedNextStrategy: 'deepen_then_shift',
    applicableSections: [section],
    confidence: 0.68,
  };
};

export const shouldWriteReflection = ({ evaluatorState = {}, decisionContext = {}, trajectoryStep = {} } = {}) => {
  if (evaluatorState.misunderstandingFlag) return true;
  if (evaluatorState.reflectionNeeded) return true;
  if ((evaluatorState.repetitionRisk || false) && (evaluatorState.evidenceGainScore || 0) < 0.55) return true;
  if (decisionContext.sectionState?.isSectionComplete) return true;
  if (trajectoryStep.isComplete) return true;
  return false;
};

export const buildReflectionRecord = ({ sessionId, userId, evaluatorState = {}, decisionContext = {}, trajectoryStep = {} } = {}) => {
  const core = buildLesson({ evaluatorState, decisionContext, trajectoryStep });
  return {
    reflectionId: crypto.randomUUID(),
    sessionId,
    userId,
    createdAt: new Date().toISOString(),
    topic: decisionContext.currentTopic || trajectoryStep.targetTopic || evaluatorState.currentTopic || 'role_fit',
    section: trajectoryStep.section || decisionContext.sectionState?.sectionKey || decisionContext.currentStage || 'experience',
    ...core,
    sourceSignals: {
      evidenceGainScore: evaluatorState.evidenceGainScore || 0,
      misunderstandingFlag: Boolean(evaluatorState.misunderstandingFlag),
      repetitionRisk: Boolean(evaluatorState.repetitionRisk),
      overallInteractionScore: evaluatorState.overallInteractionScore || 0,
    },
  };
};

export const getSessionReflectionMemory = async (sessionId) => {
  if (!sessionId) return [];
  const record = await SessionAnalysis.findOne({ sessionId }).lean();
  return ensureArray(record?.reflectionRecords).slice(-3);
};

export const persistReflectionRecord = async ({ sessionId, reflectionRecord = {}, maxRecords = 6 } = {}) => {
  if (!sessionId || !reflectionRecord?.reflectionId) return null;
  const existing = await SessionAnalysis.findOne({ sessionId }).lean();
  const current = ensureArray(existing?.reflectionRecords);
  const deduped = current.filter((item) => normalizeText(item.lesson) !== normalizeText(reflectionRecord.lesson));
  const nextRecords = [...deduped, reflectionRecord].slice(-maxRecords);
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        reflectionRecords: nextRecords,
        latestReflectionRecord: reflectionRecord,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return reflectionRecord;
};
