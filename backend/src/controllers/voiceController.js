/**
 * File responsibility: Voice smoke test HTTP controller.
 * Main responsibilities:
 * - Keep request parsing and response formatting separate from Azure adapter logic.
 * - Expose small endpoints for TTS and STT validation before interview integration.
 */

import { asyncHandler } from '../middleware/asyncHandler.js';
import { badRequest } from '../utils/appError.js';
import { formatSuccess } from '../utils/responseFormatter.js';
import { synthesizeSpeech, transcribeShortAudio } from '../services/voice/azureSpeechService.js';

export const testTextToSpeech = asyncHandler(async (req, res) => {
  const text = String(req.body?.text || '').trim();
  const voiceName = String(req.body?.voiceName || '').trim() || undefined;

  if (!text) {
    throw badRequest('Text is required', 'Send a text field in the JSON body');
  }

  const result = await synthesizeSpeech({ text, voiceName });
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', 'inline; filename="azure-voice-test.mp3"');
  return res.status(200).send(result.audioBuffer);
});

export const testSpeechToText = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw badRequest('Audio file is required', 'Upload a WAV file using the audio form-data field');
  }

  const language = String(req.body?.language || '').trim() || undefined;
  const result = await transcribeShortAudio({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname,
    language,
  });

  return res.status(200).json(formatSuccess('Speech transcribed', result));
});
