import express from 'express';
import { exportTranscript } from '../controllers/exportController.js';

const router = express.Router();

router.post('/transcript', exportTranscript);

export default router;
