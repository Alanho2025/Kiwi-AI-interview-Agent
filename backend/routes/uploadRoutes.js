import express from 'express';
import { uploadCV, getRecentCVs, selectCV } from '../controllers/uploadController.js';
import { uploadMiddleware } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/cv', uploadMiddleware, uploadCV);
router.get('/recent-cvs', getRecentCVs);
router.post('/select-cv', selectCV);

export default router;
