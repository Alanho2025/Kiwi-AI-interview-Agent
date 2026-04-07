import express from 'express';
import { importBenchmarkDataset, importInterviewKnowledgeDataset, rebuildSessionIndex, retrieveRagContext } from '../../controllers/ragController.js';

const router = express.Router();

router.post('/import-benchmark', importBenchmarkDataset);
router.post('/import-interview-knowledge', importInterviewKnowledgeDataset);
router.post('/rebuild-session', rebuildSessionIndex);
router.post('/retrieve', retrieveRagContext);

export default router;
