import express from 'express';
import { matchCV, generateInterviewPlan } from '../../controllers/analyzeController.js';

const router = express.Router();

router.post('/match', matchCV);
router.post('/interview-plan', generateInterviewPlan);

export default router;
