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
import { startInterview, warmAdaptiveInterview, pauseInterview, resumeInterview, endInterview } from '../../controllers/interviewLifecycleController.js';
import { replyInterview, repeatQuestion } from '../../controllers/interviewTurnController.js';
import { replyInterviewWithRealtimeVoice, replyInterviewWithRealtimeVoiceStream, synthesizeInterviewText } from '../../controllers/interviewVoiceController.js';
import { getHarnessRunDiagnostics, getQuestionDiagnostics } from '../../controllers/interviewDiagnosticsController.js';

const router = express.Router();

router.post('/start', startInterview);
router.post('/warm-adaptive', warmAdaptiveInterview);
router.post('/reply', replyInterview);
router.post('/realtime-voice-turn', replyInterviewWithRealtimeVoice);
router.post('/realtime-voice-turn-stream', replyInterviewWithRealtimeVoiceStream);
router.post('/repeat', repeatQuestion);
router.post('/pause', pauseInterview);
router.post('/resume', resumeInterview);
router.post('/end', endInterview);
router.post('/synthesize', synthesizeInterviewText);
router.get('/harness-runs', getHarnessRunDiagnostics);
router.get('/:sessionId/question-diagnostics', getQuestionDiagnostics);

export default router;
