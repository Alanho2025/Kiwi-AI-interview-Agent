import express from 'express';
import { generateReport, getReport, qaReport } from '../../controllers/reportController.js';

const router = express.Router();

router.post('/generate', generateReport);
router.post('/qa', qaReport);
router.get('/:sessionId', getReport);

export default router;
