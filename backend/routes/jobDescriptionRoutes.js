import express from 'express';
import { paraphraseJD } from '../controllers/jobDescriptionController.js';

const router = express.Router();

router.post('/paraphrase', paraphraseJD);

export default router;
