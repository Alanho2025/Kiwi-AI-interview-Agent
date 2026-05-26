/**
 * File responsibility: Build UI-facing status objects for the voice interview panel.
 *
 * The voice session hook uses this helper to keep status shape consistent across
 * idle, listening, processing, playback, warning, and error states.
 */

const FALLBACK_TYPE = 'info';
const FALLBACK_TITLE = 'Voice status';
const FALLBACK_MESSAGE = 'Voice mode is updating.';

const NORMALISED_TYPES = new Set(['info', 'success', 'warning', 'error']);

const normaliseType = (type) => {
  if (NORMALISED_TYPES.has(type)) return type;
  return FALLBACK_TYPE;
};

const normaliseText = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

export function buildVoiceStatus(type = FALLBACK_TYPE, title = FALLBACK_TITLE, message = FALLBACK_MESSAGE) {
  return {
    type: normaliseType(type),
    title: normaliseText(title, FALLBACK_TITLE),
    message: normaliseText(message, FALLBACK_MESSAGE),
  };
}
