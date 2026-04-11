/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionTranscriptService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { SessionTranscript } from '../../db/models/sessionTranscriptModel.js';
import { buildFullTranscript } from './sessionShared.js';

/**
 * Purpose: Execute the main responsibility for buildTranscriptTurn.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildTranscriptTurn = (turn) => ({
  role: turn.role,
  text: turn.text,
  timestamp: new Date(turn.timestamp || new Date()),
  questionId: turn.questionId,
  source: turn.source || 'app',
  durationSeconds: turn.durationSeconds,
  metadata: turn.metadata || {},
});

/**
 * Purpose: Execute the main responsibility for mapSavedTranscriptTurn.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const mapSavedTranscriptTurn = (turn) => ({
  role: turn.role,
  text: turn.text,
  timestamp: turn.timestamp.toISOString(),
  questionId: turn.questionId,
});

/**
 * Purpose: Execute the main responsibility for appendTranscriptTurn.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const appendTranscriptTurn = async (sessionId, turn) => {
  const transcript = await SessionTranscript.findOne({ sessionId });
  if (!transcript) {
    return null;
  }

  const nextTurn = buildTranscriptTurn(turn);
  transcript.turns.push(nextTurn);
  transcript.lastTurnOrder = transcript.turns.length;
  transcript.fullTranscript = buildFullTranscript(transcript.turns);
  transcript.redactedTranscript = transcript.fullTranscript;
  await transcript.save();

  return mapSavedTranscriptTurn(nextTurn);
};
