import express from 'express';
import {
  getMe,
  googleClientConfig,
  googleLogin,
  logout,
} from '../src/controllers/authController.js';

const router = express.Router();

router.get('/google/config', googleClientConfig);
router.post('/google', googleLogin);
router.get('/me', getMe);
router.post('/logout', logout);

export default router;
