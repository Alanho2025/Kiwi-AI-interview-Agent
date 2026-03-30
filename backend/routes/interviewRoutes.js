import express from 'express';
import { startInterview, replyInterview, repeatQuestion, pauseInterview, resumeInterview, endInterview } from '../controllers/interviewController.js';

const router = express.Router();

router.post('/start', startInterview);
router.post('/reply', replyInterview);
router.post('/repeat', repeatQuestion);
router.post('/pause', pauseInterview);
router.post('/resume', resumeInterview);
router.post('/end', endInterview);

export default router;
