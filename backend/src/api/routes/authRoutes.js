import express from 'express';
import {
  getMe,
  googleClientConfig,
  googleLogin,
  logout,
} from '../../controllers/authController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/google/config', googleClientConfig);
router.post('/google', googleLogin);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

export default router;
