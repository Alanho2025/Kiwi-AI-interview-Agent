/**
 * File responsibility: Route registration module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewRoutes should register endpoints and keep route wiring separate from controller logic.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import { startInterview, warmAdaptiveInterview, replyInterview, replyInterviewWithVoice, replyInterviewWithRealtimeVoice, replyInterviewWithRealtimeVoiceStream, repeatQuestion, pauseInterview, resumeInterview, endInterview, synthesizeInterviewText } from '../../controllers/interviewController.js';
import { voiceUploadMiddleware } from '../../middleware/voiceUploadMiddleware.js';

const router = express.Router();

router.post('/start', startInterview);
router.post('/warm-adaptive', warmAdaptiveInterview);
router.post('/reply', replyInterview);
router.post('/voice-reply', voiceUploadMiddleware, replyInterviewWithVoice);
router.post('/realtime-voice-turn', replyInterviewWithRealtimeVoice);
router.post('/realtime-voice-turn-stream', replyInterviewWithRealtimeVoiceStream);
router.post('/repeat', repeatQuestion);
router.post('/pause', pauseInterview);
router.post('/resume', resumeInterview);
router.post('/end', endInterview);
router.post('/synthesize', synthesizeInterviewText);

export default router;
