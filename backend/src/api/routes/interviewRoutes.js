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
import { startInterview, replyInterview, replyInterviewWithVoice, replyInterviewWithRealtimeVoice, repeatQuestion, pauseInterview, resumeInterview, endInterview } from '../../controllers/interviewController.js';
import { voiceUploadMiddleware } from '../../middleware/voiceUploadMiddleware.js';

const router = express.Router();

router.post('/start', startInterview);
router.post('/reply', replyInterview);
router.post('/voice-reply', voiceUploadMiddleware, replyInterviewWithVoice);
router.post('/realtime-voice-turn', replyInterviewWithRealtimeVoice);
router.post('/repeat', repeatQuestion);
router.post('/pause', pauseInterview);
router.post('/resume', resumeInterview);
router.post('/end', endInterview);

export default router;
