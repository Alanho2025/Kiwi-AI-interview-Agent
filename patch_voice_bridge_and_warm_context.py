from pathlib import Path

ROOT = Path.cwd()

def replace_exact(path: Path, old: str, new: str):
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Target block not found in {path}")
    path.write_text(text.replace(old, new), encoding="utf-8")
    print(f"patched: {path}")

def append_if_missing(path: Path, marker: str, content: str):
    text = path.read_text(encoding="utf-8")
    if marker in text:
        print(f"skip, already patched: {path}")
        return
    path.write_text(text.rstrip() + "\n\n" + content.strip() + "\n", encoding="utf-8")
    print(f"patched: {path}")

# 2. Patch voiceSessionConstants.js
constants_path = ROOT / "frontend/src/hooks/voice/voiceSessionConstants.js"
replace_exact(
    constants_path,
    """export const LATENCY_ACK_DELAY_MS = 650;
export const LATENCY_ACK_COOLDOWN_MS = 16000;""",
    """export const LATENCY_ACK_DELAY_MS = 1200;
export const LATENCY_ACK_COOLDOWN_MS = 12000;"""
)

# 2. Patch useVoiceLatencyController.js
latency_controller_path = ROOT / "frontend/src/hooks/voice/useVoiceLatencyController.js"

replace_exact(
    latency_controller_path,
    "import { useCallback, useMemo } from 'react';",
    "import { useCallback, useMemo, useRef } from 'react';"
)

replace_exact(
    latency_controller_path,
    """import {
  LATENCY_ACK_COOLDOWN_MS,
  LATENCY_ACK_DELAY_MS,
  SLOW_FIRST_AUDIO_MS,
  VAD_WARMUP_IGNORE_MS,
} from './voiceSessionConstants.js';""",
    """import {
  LATENCY_ACK_COOLDOWN_MS,
  LATENCY_ACK_DELAY_MS,
  SLOW_FIRST_AUDIO_MS,
  VAD_WARMUP_IGNORE_MS,
} from './voiceSessionConstants.js';

const BLOCKED_ACK_REASONS = new Set([
  'session_start',
  'session_complete',
  'transcript_confirmation',
  'transcript_rejected',
  'repair_prompt',
  'clear_follow_up',
]);

const CLEAR_NEXT_ACTIONS = new Set([
  'ASK_NEXT_PLANNED_QUESTION',
  'ASK_INTRO_QUESTION',
  'ASK_CLOSING_QUESTION',
]);

const shouldPlayInterviewerBridge = ({
  firstAudioSeen,
  autoLoopActive,
  recentlyPlayed,
  turnReason,
  answerWordCount,
  expectedNextAction,
}) => {
  if (!autoLoopActive) return false;
  if (firstAudioSeen) return false;
  if (recentlyPlayed) return false;
  if (answerWordCount > 0 && answerWordCount < 8) return false;
  if (BLOCKED_ACK_REASONS.has(turnReason)) return false;
  if (CLEAR_NEXT_ACTIONS.has(expectedNextAction)) return false;
  return true;
};"""
)

replace_exact(
    latency_controller_path,
    """    latencyAcknowledgementTimerRef,
    lastLatencyAcknowledgementAtRef,
  } = refs;""",
    """    latencyAcknowledgementTimerRef,
    lastLatencyAcknowledgementAtRef,
  } = refs;
  const latencyAcknowledgementUsedPhrasesRef = useRef(new Set());"""
)

replace_exact(
    latency_controller_path,
    """  const scheduleLatencyAcknowledgement = useCallback(() => {
    clearLatencyAcknowledgementTimer();
    latencyAcknowledgementTimerRef.current = window.setTimeout(() => {
      const now = Date.now();
      const recentlyPlayed = now - lastLatencyAcknowledgementAtRef.current < LATENCY_ACK_COOLDOWN_MS;
      if (recentlyPlayed || !autoLoopActiveRef.current || firstAudioChunkSeenRef.current) return;

      const played = playLatencyAcknowledgement({ index: voiceTurnSequenceRef.current });
      if (played) lastLatencyAcknowledgementAtRef.current = now;
    }, LATENCY_ACK_DELAY_MS);
  }, [
    autoLoopActiveRef,
    clearLatencyAcknowledgementTimer,
    firstAudioChunkSeenRef,
    lastLatencyAcknowledgementAtRef,
    latencyAcknowledgementTimerRef,
    voiceTurnSequenceRef,
  ]);""",
    """  const scheduleLatencyAcknowledgement = useCallback((context = {}) => {
    clearLatencyAcknowledgementTimer();

    latencyAcknowledgementTimerRef.current = window.setTimeout(() => {
      const now = Date.now();
      const recentlyPlayed = now - lastLatencyAcknowledgementAtRef.current < LATENCY_ACK_COOLDOWN_MS;

      const shouldPlay = shouldPlayInterviewerBridge({
        firstAudioSeen: firstAudioChunkSeenRef.current,
        autoLoopActive: autoLoopActiveRef.current,
        recentlyPlayed,
        turnReason: context.reason,
        answerWordCount: context.answerWordCount || 0,
        expectedNextAction: context.expectedNextAction || null,
      });

      if (!shouldPlay) return;

      const phrase = playLatencyAcknowledgement({
        usedPhrases: [...latencyAcknowledgementUsedPhrasesRef.current],
        expectedNextAction: context.expectedNextAction || null,
        currentSection: context.currentSection || null,
        questionType: context.questionType || null,
      });

      if (phrase) {
        latencyAcknowledgementUsedPhrasesRef.current.add(phrase);
        lastLatencyAcknowledgementAtRef.current = now;
      }
    }, LATENCY_ACK_DELAY_MS);
  }, [
    autoLoopActiveRef,
    clearLatencyAcknowledgementTimer,
    firstAudioChunkSeenRef,
    lastLatencyAcknowledgementAtRef,
    latencyAcknowledgementTimerRef,
  ]);"""
)

# 3. Patch useVoiceVadTurnController.js
vad_controller_path = ROOT / "frontend/src/hooks/voice/useVoiceVadTurnController.js"

replace_exact(
    vad_controller_path,
    "    scheduleLatencyAcknowledgement();",
    """    scheduleLatencyAcknowledgement({
      reason,
      answerWordCount: vadMetricsRef.current?.wordCount || 0,
    });"""
)

# 4. Patch backend ragRetrievalService.js
rag_path = ROOT / "backend/src/services/ragRetrievalService.js"

append_if_missing(
    rag_path,
    "export const retrieveForInterviewTurn",
    """
export const retrieveForInterviewTurn = async ({
  session,
  userId,
  currentQuestionId = null,
  topK = 6,
} = {}) => {
  const questions = [
    ...(session?.interviewPlan?.questionPool || []),
    ...(session?.interviewPlan?.questions || []),
  ];

  const currentQuestion = questions.find((question) => question.id === currentQuestionId) || null;

  const query = [
    session?.targetRole,
    session?.companyName,
    currentQuestion?.text,
    currentQuestion?.question,
    currentQuestion?.skill,
    currentQuestion?.competency,
    userId ? `user:${userId}` : null,
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'interview turn evidence';

  return retrieveEvidenceBundle({
    query,
    sessionId: session?.id,
    sourceTypes: ['cv', 'job_description', 'match_analysis', 'interview_plan'],
    topK,
  });
};
"""
)

print("\\nDone. Now run:")
print("  npm run lint")
print("  npm test")
print("  git diff")