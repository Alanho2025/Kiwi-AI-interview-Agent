import express from 'express';
import { saveSession, getSession, resumeSession } from '../controllers/sessionController.js';

const router = express.Router();

router.post('/save', saveSession);
router.get('/:sessionId', getSession);
router.post('/resume', resumeSession);

export default router;
