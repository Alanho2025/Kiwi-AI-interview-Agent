import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { extractTextFromCV } from '../services/fileService.js';

let recentCVsList = [];

export const uploadCV = async (req, res, next) => {
  console.log('ENTERING uploadCV, file:', req.file?.originalname);
  try {
    if (!req.file) {
      return res.status(400).json(formatError('No file uploaded', 'MISSING_FILE', 'Please upload a PDF or DOCX file'));
    }

    console.log('Calling fileService extractTextFromCV');
    const text = await extractTextFromCV(req.file.buffer, req.file.mimetype);
    if (!text) {
      return res.status(400).json(formatError('Text extraction failed', 'EXTRACTION_FAILED', 'Could not extract readable text from the uploaded file'));
    }

    const sizeKB = (req.file.size / 1024).toFixed(1);
    const sizeStr = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + 'MB' : sizeKB + 'KB';
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const fileMetadata = {
      id: 'cv_' + Date.now(),
      name: req.file.originalname,
      size: sizeStr,
      updated: dateStr,
      type: req.file.mimetype,
      text: text
    };

    recentCVsList.unshift(fileMetadata);
    if (recentCVsList.length > 5) recentCVsList.pop();

    console.log('EXITING uploadCV successfully');
    res.json(formatSuccess('CV uploaded successfully', fileMetadata));
  } catch (error) {
    console.error('ERROR in uploadCV:', error.message, error.stack);
    next(error);
  }
};

export const getRecentCVs = async (req, res, next) => {
  console.log('ENTERING getRecentCVs');
  try {
    console.log('EXITING getRecentCVs successfully');
    res.json(formatSuccess('Recent CVs retrieved', recentCVsList));
  } catch (error) {
    console.error('ERROR in getRecentCVs:', error.message, error.stack);
    next(error);
  }
};

export const selectCV = async (req, res, next) => {
  console.log('ENTERING selectCV, cvId:', req.body?.cvId);
  try {
    const { cvId } = req.body;
    if (!cvId) {
      return res.status(400).json(formatError('Missing cvId', 'MISSING_PARAM', 'Please provide a cvId'));
    }

    const selectedCV = recentCVsList.find((cv) => cv.id === cvId);
    if (!selectedCV) {
      return res.status(404).json(formatError('CV not found', 'NOT_FOUND', 'The selected CV does not exist'));
    }

    console.log('EXITING selectCV successfully');
    res.json(formatSuccess('CV selected successfully', selectedCV));
  } catch (error) {
    console.error('ERROR in selectCV:', error.message, error.stack);
    next(error);
  }
};
