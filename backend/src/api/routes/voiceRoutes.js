/**
 * File responsibility: Route registration module.
 * Main responsibilities:
 * - Register isolated smoke test routes for Azure Speech.
 * - Keep upload middleware and controller wiring separate from business logic.
 */

import express from 'express';
import { testSpeechToText, testTextToSpeech } from '../../controllers/voiceController.js';
import { voiceUploadMiddleware } from '../../middleware/voiceUploadMiddleware.js';

const router = express.Router();

router.post('/test-tts', testTextToSpeech);
router.post('/test-stt', voiceUploadMiddleware, testSpeechToText);
export default router;
