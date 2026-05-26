import express from 'express';
import { getOpsLiteSummary } from '../../controllers/opsLiteController.js';

const router = express.Router();

router.get('/summary', getOpsLiteSummary);

export default router;
